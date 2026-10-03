import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors, fonts } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/forum/*`, kèm gate đăng nhập.
 *
 * Gate ở đây là BẮT BUỘC, không phải phòng xa. `app/(tabs)/_layout.tsx` có gate
 * của nó, nhưng nhánh này KHÔNG nằm dưới `(tabs)`: `app.json` khai
 * `"scheme": "skillswap"`, nên `skillswap://forum/<id>` và `/forum/compose` là
 * điểm vào trực tiếp — một thông báo đẩy hoặc một link dán tay đưa người chưa
 * đăng nhập vào thẳng đây, bỏ qua mọi gate khác.
 *
 * Và `GET /api/forum/posts/{id}` cùng `GET .../comments` là endpoint CÔNG KHAI
 * (`forum.md` §1.2), nên không có gate thì màn hình render đầy đủ, hiện cả ô
 * nhập bình luận lẫn nút Báo cáo — mọi thao tác ghi sau đó nhận 401 mà người
 * dùng không có đường nào để đăng nhập.
 *
 * Gate phải nằm ở `_layout` chứ không phải ở từng màn hình: `Redirect` của
 * expo-router gọi `router.replace()` bên trong `useFocusEffect`
 * (`node_modules/expo-router/build/link/Redirect.js`), nên nó chỉ chạy khi màn
 * đang focus. `_layout` của nhánh luôn focus khi một route con đang mở, nên đây
 * là chỗ duy nhất bắt được cả deep link nguội lẫn trường hợp phiên chết giữa
 * lúc người dùng đang đọc bài.
 */
export default function ForumLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ, giống `app/index.tsx` và
  // `app/(tabs)/_layout.tsx`. Đẩy về login ở trạng thái này thì một deep link
  // lúc khởi động sẽ bị bật ra ngoài rồi kẹt lại đó.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="forum-loading-indicator" color={colors.accent} />
      </View>
    );
  }

  // Tài khoản ADMIN/SYSTEM_ADMIN đi tới trạng thái cuối, KHÔNG về login — về
  // login sẽ tạo vòng lặp đẩy nhau vô hạn, xem `core/auth/authRoute.ts`.
  if (route.kind === 'unsupported') {
    return <Redirect href="/(auth)/unsupported-account" />;
  }
  if (route.kind !== 'tabs' || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Quay lại',
        /*
          Thanh trên cùng của `PostDetail.dc.html`: nền trắng, tiêu đề 17/700 màu
          `ink`, nút back màu `ink`. `headerShadowVisible: false` vì thiết kế dùng
          một đường viền 1px `line` chứ không phải bóng đổ — và mỗi màn hình chỉ
          được có một kiểu bóng (mục 2 của HANDOFF.md).

          `fontFamily` phải là tên file font thật, không dùng `fontWeight`: trên
          Android với font tuỳ biến `fontWeight` không có tác dụng và chữ lặng lẽ
          rơi về nét thường — xem ghi chú ở `fonts` trong `core/ui/theme.ts`.
        */
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
      }}
    >
      <Stack.Screen name="[postId]" options={{ headerTitle: 'Bài viết' }} />
      {/*
        Màn soạn bài tự vẽ thanh trên cùng của nó: nút quay lại ở đó phải hỏi
        trước khi vứt bản nháp, mà header của Stack thì không làm được việc đó
        bằng API công khai của expo-router 57.
      */}
      <Stack.Screen name="compose" options={{ headerShown: false }} />
    </Stack>
  );
}
