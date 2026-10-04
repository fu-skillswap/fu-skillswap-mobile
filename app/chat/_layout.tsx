import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Stack riêng cho nhánh `/chat/*`, kèm gate đăng nhập.
 *
 * Bắt buộc như nhánh `/booking`: thông báo "tin nhắn mới" sẽ mở thẳng
 * `skillswap://chat/<id>`, đi vòng qua gate của `(tabs)`, và mọi API chat đều cần
 * phiên. Gate ở `_layout` chứ không ở màn — xem `app/mentor/_layout.tsx`.
 */
export default function ChatLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập — chỉ chờ, giống `app/index.tsx`,
  // `app/(tabs)/_layout.tsx` và `app/forum/_layout.tsx`. Đẩy về login ở trạng
  // thái này thì một deep link lúc khởi động sẽ bị bật ra ngoài rồi kẹt lại đó.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="chat-loading-indicator" color={colors.accent} />
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
        // Màn chat tự vẽ thanh trên (`ChatDetail.dc.html`).
        headerShown: false,
      }}
    />
  );
}

