import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { isMobileSupportedAccount, resolveTabs } from '@/core/config/tabs';
import { colors } from '@/core/ui/theme';

export default function TabsLayout() {
  const { status, user } = useAuth();

  // 'loading' KHÔNG phải là chưa đăng nhập: nếu điều hướng thẳng về login ở
  // trạng thái này, một deep link vào /(tabs) lúc khởi động sẽ bị bật ra
  // ngoài rồi kẹt lại đó ngay khi status resolve thành 'authenticated' (màn
  // login không tự điều hướng tiếp). Chỉ chờ, giống app/index.tsx.
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator testID="tabs-loading-indicator" color={colors.primary} />
      </View>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isMobileSupportedAccount(user.roles)) {
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
