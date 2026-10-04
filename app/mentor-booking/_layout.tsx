import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/mentor-booking/*` (mentor xử lý một lịch đặt), kèm gate
 * đăng nhập. Thông báo "có yêu cầu đặt lịch mới" mở thẳng vào đây, nên gate phải
 * ở `_layout` — xem `app/mentor/_layout.tsx`. Quyền MENTOR do backend kiểm (403
 * khi người gọi không phải mentor của booking), màn hình hiện lỗi đó như mọi lỗi.
 */
export default function MentorBookingLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ, giống `app/index.tsx`,
  // `app/(tabs)/_layout.tsx` và `app/forum/_layout.tsx`. Đẩy về login ở trạng
  // thái này thì một deep link lúc khởi động sẽ bị bật ra ngoài rồi kẹt lại đó.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="mentor-booking-loading-indicator" color={colors.accent} />
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
        // Màn chi tiết tự vẽ header (`MentorBookingDetail.dc.html`).
        headerShown: false,
      }}
    />
  );
}

