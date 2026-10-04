import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/mentor-registration` (đăng ký làm mentor), kèm gate đăng nhập.
 *
 * Nhánh này nằm ngoài `(tabs)` (mục 3 của quy ước), nên gate của `(tabs)` không
 * che nó, và mọi API hồ sơ và xác thực mentor đều cần phiên. Gate ở `_layout` chứ không ở màn —
 * xem `app/chat/_layout.tsx`.
 */
export default function MentorRegistrationLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="mentor-registration-loading-indicator" color={colors.accent} />
      </View>
    );
  }

  // Tài khoản ADMIN/SYSTEM_ADMIN đi tới trạng thái cuối, KHÔNG về login — xem
  // `core/auth/authRoute.ts`.
  if (route.kind === 'unsupported') {
    return <Redirect href="/(auth)/unsupported-account" />;
  }
  if (route.kind !== 'tabs' || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Màn tự vẽ thanh trên (`MentorRegistration.dc.html`).
  return <Stack screenOptions={{ headerShown: false }} />;
}
