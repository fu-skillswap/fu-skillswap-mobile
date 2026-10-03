import { CalendarDays, Home, MessageSquare, Search, User } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { resolveTabs } from '@/core/config/tabs';
import type { TabIconName } from '@/core/config/tabs';
import { colors, controlHeight, fonts } from '@/core/ui/theme';

/**
 * Ánh xạ tên icon Lucide (kebab-case, như trong `Main.dc.html`) sang component.
 *
 * `Record<TabIconName, …>` chứ không phải `Record<string, …>`: thêm một tab vào
 * `core/config/tabs.ts` mà quên nối icon ở đây là lỗi đỏ của `tsc`. Trước đây
 * `icon` là `string` và chỗ này phải `as any` để đưa vào `Ionicons` — cái `any`
 * đó biến mọi tên icon sai thành một ô trống im lặng trên máy thật.
 */
const ICON: Record<TabIconName, LucideIcon> = {
  home: Home,
  search: Search,
  'calendar-days': CalendarDays,
  'message-square': MessageSquare,
  user: User,
};

export default function TabsLayout() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập: nếu điều hướng thẳng về login ở
  // trạng thái này, một deep link vào /(tabs) lúc khởi động sẽ bị bật ra
  // ngoài rồi kẹt lại đó ngay khi status resolve thành 'authenticated' (màn
  // login không tự điều hướng tiếp). Chỉ chờ, giống app/index.tsx.
  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator testID="tabs-loading-indicator" color={colors.accent} />
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
        // Mọi màn tab trong thiết kế tự vẽ phần đầu trang của nó (lời chào ở
        // Bảng tin, tiêu đề 26/700 ở Hồ sơ), nên header mặc định của
        // react-navigation sẽ là một thanh thứ hai chồng lên trên.
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        // Thanh tab cao 84 với viền trên 1px `line`, đúng `Main.dc.html`.
        tabBarStyle: {
          height: controlHeight.tabBar,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        },
      }}
    >
      {resolveTabs(user.roles).map((tab) => {
        const Icon = ICON[tab.icon];
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color }) => <Icon color={color} size={24} strokeWidth={2} />,
              /*
                Nhãn đi qua hàm render chứ không qua `tabBarLabelStyle`: thiết kế
                đổi NÉT chữ giữa mục chọn (700) và mục thường (500), mà nét của
                font tuỳ biến phải là tên file font — `fontWeight` trên Android
                không có tác dụng và chữ lặng lẽ rơi về nét thường (xem `fonts`
                trong `core/ui/theme.ts`). Một `tabBarLabelStyle` duy nhất thì
                không phân biệt được hai trạng thái.
              */
              tabBarLabel: ({ focused, color }) => (
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 14,
                    color: typeof color === 'string' ? color : colors.inkMuted,
                    fontFamily: focused ? fonts.bold : fonts.medium,
                  }}
                >
                  {tab.title}
                </Text>
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
