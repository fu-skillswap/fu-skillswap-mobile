import {
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Search,
  User,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { allTabRouteNames, resolveTabs } from '@/core/config/tabs';
import type { TabIconName } from '@/core/config/tabs';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { colors, controlHeight, fonts } from '@/core/ui/theme';

/**
 * Ánh xạ tên icon Lucide (kebab-case, như trong các file `.dc.html`) sang component.
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
  'layout-dashboard': LayoutDashboard,
  'clipboard-list': ClipboardList,
  wallet: Wallet,
  menu: Menu,
};

export default function TabsLayout() {
  const { status, user } = useAuth();
  const { cheDo, dangTai: dangTaiCheDo } = useRoleMode();
  const route = resolveAuthRoute(status, user);

  // 'loading' KHÔNG phải là chưa đăng nhập: nếu điều hướng thẳng về login ở
  // trạng thái này, một deep link vào /(tabs) lúc khởi động sẽ bị bật ra
  // ngoài rồi kẹt lại đó ngay khi status resolve thành 'authenticated' (màn
  // login không tự điều hướng tiếp). Chỉ chờ, giống app/index.tsx.
  //
  // `dangTaiCheDo` cũng phải chờ ở ĐÚNG chỗ này: lựa chọn vai trò nằm trong
  // keystore nên việc đọc nó là bất đồng bộ. Vẽ thanh tab trước khi đọc xong sẽ
  // làm một mentor thuần thấy thanh Mentee nhấp một nhịp rồi mới đổi, và với tài
  // khoản hai vai thì cú nhấp đó còn mang người dùng về tab Bảng tin thay vì tab
  // họ đang làm việc. Xem `core/roleMode/RoleModeProvider.tsx`.
  if (route.kind === 'loading' || dangTaiCheDo) {
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

  /*
    Thanh tab của CHẾ ĐỘ đang xem. `cheDo` có thể là `null` trong một nhịp (và
    `resolveTabs` nhận `undefined` cho trường hợp đó), nhưng nó KHÔNG thể cho ra
    thanh rỗng: `resolveTabs` lùi về chế độ đầu tiên mà tài khoản thật sự có.
  */
  const tabDangXem = resolveTabs(user.roles, cheDo ?? undefined);
  const tenDangXem = new Set(tabDangXem.map((tab) => tab.name));

  return (
    <Tabs
      screenOptions={{
        // Mọi màn tab trong thiết kế tự vẽ phần đầu trang của nó (lời chào ở
        // Bảng tin, tiêu đề 26/700 ở Hồ sơ), nên header mặc định của
        // react-navigation sẽ là một thanh thứ hai chồng lên trên.
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        // Thanh tab cao 84 với viền trên 1px `line`, đúng `Main.dc.html` và
        // `<nav aria-label="Điều hướng mentor">`.
        tabBarStyle: {
          height: controlHeight.tabBar,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        },
      }}
    >
      {/*
        Khai `<Tabs.Screen>` cho MỌI route tab của CẢ HAI thanh, không chỉ thanh
        đang xem. expo-router đăng ký mọi file trong thư mục `(tabs)/` thành route
        dù có khai hay không, và route không khai sẽ hiện trong thanh tab với
        tuỳ chọn MẶC ĐỊNH — tức là thanh Mentee sẽ mọc thêm 5 mục mentor không
        tên, đúng dạng lỗi mà `allTabRouteNames()` tồn tại để chặn.

        Mục không thuộc thanh đang xem bị ẩn bằng `href: null`. Đó là đường chính
        thức của expo-router: `TabsClient` thấy `href === null` thì đặt
        `tabBarItemStyle: { display: 'none' }` và thay `tabBarButton` bằng một
        `View` không bấm được.
      */}
      {allTabRouteNames().map((name) => {
        const tab = tabDangXem.find((item) => item.name === name);
        if (!tab || !tenDangXem.has(name)) {
          return <Tabs.Screen key={name} name={name} options={{ href: null }} />;
        }
        const Icon = ICON[tab.icon];
        return (
          <Tabs.Screen
            key={name}
            name={name}
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
