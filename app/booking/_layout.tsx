import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/booking/*` (chọn lịch, xác nhận đặt lịch), kèm gate
 * đăng nhập.
 *
 * Gate ở đây là BẮT BUỘC: nhánh này không nằm dưới `(tabs)`, nên một deep link
 * `skillswap://booking/<id>` vào thẳng đây mà không qua gate nào khác — và mọi
 * API của luồng đặt lịch (`availability-slots`, `quote`, `POST /api/bookings`)
 * đều cần phiên.
 *
 * Gate phải ở `_layout` chứ không ở từng màn: `Redirect` của expo-router chỉ
 * chạy khi màn đang focus (xem `app/mentor/_layout.tsx`).
 */
export default function BookingLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ, giống `app/index.tsx`,
  // `app/(tabs)/_layout.tsx` và `app/forum/_layout.tsx`. Đẩy về login ở trạng
  // thái này thì một deep link lúc khởi động sẽ bị bật ra ngoài rồi kẹt lại đó.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="booking-loading-indicator" color={colors.accent} />
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
        // Hai màn của luồng đặt lịch tự vẽ header (nút quay lại tròn 44 + tiêu
        // đề + thanh tiến trình) theo `Booking.dc.html`; header của Stack sẽ
        // chen vào trên đó.
        headerShown: false,
      }}
    />
  );
}

