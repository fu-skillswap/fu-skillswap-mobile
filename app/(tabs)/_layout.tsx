import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { resolveTabs } from '@/core/config/tabs';
import { colors } from '@/core/ui/theme';

export default function TabsLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập: nếu điều hướng thẳng về login ở
  // trạng thái này, một deep link vào /(tabs) lúc khởi động sẽ bị bật ra
  // ngoài rồi kẹt lại đó ngay khi status resolve thành 'authenticated' (màn
  // login không tự điều hướng tiếp). Chỉ chờ, giống app/index.tsx.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator testID="tabs-loading-indicator" color={colors.primary} />
      </View>
    );
  }

  // Tài khoản ADMIN/SYSTEM_ADMIN (route === 'unsupported') KHÔNG được redirect
  // về login — trước đây redirect về login khiến login lại redirect ngược sang
  // (tabs) (status đã 'authenticated'), hai màn hình đẩy nhau vô hạn (Critical,
  // đợt review cuối). Đưa thẳng sang màn hình "không hỗ trợ", một trạng thái
  // cuối không redirect tiếp — xem core/auth/authRoute.ts.
  if (route.kind === 'unsupported') {
    return <Redirect href="/(auth)/unsupported-account" />;
  }
  if (route.kind !== 'tabs' || !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      {resolveTabs(user.roles).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // Ionicons nhận tên icon dạng chuỗi; cấu hình tab giữ kiểu string để không phụ thuộc thư viện icon.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tên icon đã kiểm soát trong core/config/tabs.ts
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon as any} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
