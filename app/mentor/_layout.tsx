import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/mentor/*`, kèm gate đăng nhập.
 *
 * Gate ở đây là BẮT BUỘC, không phải phòng xa. `app/(tabs)/_layout.tsx` có gate
 * của nó, nhưng nhánh này KHÔNG nằm dưới `(tabs)`: `app.json` khai
 * `"scheme": "skillswap"`, nên `skillswap://mentor/<id>` là điểm vào trực tiếp —
 * một thông báo đẩy hoặc một link dán tay đưa người chưa đăng nhập vào thẳng
 * đây, bỏ qua mọi gate khác.
 *
 * Và `GET /api/mentors/{id}` cùng `GET .../reviews` là endpoint CÔNG KHAI
 * (`SecurityConfig.java:112-114` cho cả hai vào danh sách không cần token), nên
 * không có gate thì màn hình render đầy đủ cho khách vãng lai. Mọi thao tác sau
 * đó — đặt lịch, nhắn tin — đều cần phiên, và người dùng sẽ gặp 401 ở một chỗ
 * không có đường nào để đăng nhập.
 *
 * Gate phải nằm ở `_layout` chứ KHÔNG phải ở từng màn hình: `Redirect` của
 * expo-router gọi `router.replace()` bên trong `useFocusEffect`
 * (`node_modules/expo-router/build/link/Redirect.js`), nên nó chỉ chạy khi màn
 * đang focus. `_layout` của nhánh luôn focus khi một route con đang mở, nên đây
 * là chỗ duy nhất bắt được cả deep link nguội lẫn trường hợp phiên chết giữa lúc
 * người dùng đang đọc hồ sơ.
 */
export default function MentorLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ, giống `app/index.tsx`,
  // `app/(tabs)/_layout.tsx` và `app/forum/_layout.tsx`. Đẩy về login ở trạng
  // thái này thì một deep link lúc khởi động sẽ bị bật ra ngoài rồi kẹt lại đó.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="mentor-loading-indicator" color={colors.accent} />
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
        /*
          `MentorDetail.dc.html` KHÔNG có thanh trên cùng: nút quay lại là một nút
          tròn 44 nền trắng nằm đè lên dải nền `surface-tint` cao 210, và card hồ
          sơ trượt lên dưới nó. Một header của Stack sẽ chen vào giữa và phá hẳn
          bố cục đó, nên màn hình tự vẽ nút quay lại của nó.
        */
        headerShown: false,
      }}
    />
  );
}

