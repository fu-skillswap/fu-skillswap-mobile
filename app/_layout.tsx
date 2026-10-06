import '../global.css';

import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from '@expo-google-fonts/montserrat';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { startMockServerIfEnabled } from '@/core/dev/mockServer';
import { setupFocusManager } from '@/core/net/appFocus';
import { setupOnlineManager } from '@/core/net/onlineStatus';
import { RoleModeProvider } from '@/core/roleMode/RoleModeProvider';
import { colors } from '@/core/ui/theme';

// Bật TRƯỚC khi bất cứ component nào render, và cố ý ở tầng module chứ không
// trong `useEffect`: `AuthProvider` gọi `POST /api/auth/refresh` ngay trong
// effect khởi động của nó, nên MSW phải chặn được từ request đầu tiên. Hàm tự
// no-op khi chế độ mock tắt — xem `core/dev/mockServer.ts`.
startMockServerIfEnabled();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  /**
   * Montserrat là font bắt buộc của thiết kế (`HANDOFF.md` mục 2).
   *
   * Nạp đủ CẢ NĂM nét: trên Android, React Native KHÔNG suy ra được nét đậm từ
   * `fontWeight` với font tuỳ biến — thiếu file nét nào thì chữ ở nét đó lặng lẽ
   * rơi về nét thường, và giao diện trông "gần đúng" theo cách rất khó truy.
   * Vì vậy code dùng `fonts.bold` của `core/ui/theme.ts`, không dùng `fontWeight`.
   */
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  useEffect(() => setupOnlineManager(), []);
  // Xuống nền thì dừng polling, quay lại thì tải lại dữ liệu cũ — xem `core/net/appFocus.ts`.
  useEffect(() => setupFocusManager(), []);

  // Chưa nạp xong thì giữ một nền trống đúng màu `surface-page` thay vì render
  // cây với font hệ thống rồi nhảy sang Montserrat — người dùng sẽ thấy chữ
  // đổi hình một nhịp. `fontError` cũng cho đi tiếp: thà xấu font còn hơn app
  // không bao giờ mở được vì một file font hỏng.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.surfacePage }} />;
  }

  return (
    /**
     * `SafeAreaProvider` PHẢI có, và phải ở ngoài cùng.
     *
     * `SafeAreaView` cùng `useSafeAreaInsets()` của `react-native-safe-area-context`
     * lấy số đo từ context này. Không có provider thì inset về 0 **trong im lặng**:
     * không lỗi, không cảnh báo, chỉ là mọi `Screen` mất phần chừa cho thanh
     * trạng thái. Gặp thật trên máy ảo 04/10/2026 — tiêu đề "Bảng tin"/"Hồ sơ"
     * nằm đè lên đồng hồ và icon pin.
     *
     * Trước đây app mượn vùng an toàn của native stack nên trông "gần đúng", và
     * `useSafeAreaInsets()` thì NÉM lỗi khi thiếu provider — hai dấu hiệu dễ bị
     * đọc nhầm thành "thư viện hỏng" thay vì "thiếu provider".
     */
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/*
            `RoleModeProvider` nằm BÊN TRONG `AuthProvider`: chế độ vai trò được
            quy từ `user.roles` của phiên đăng nhập, nên nó phải đọc được
            `useAuth()`. Đặt ngược lại sẽ ném "useAuth phải được dùng bên trong
            <AuthProvider>" ngay lúc khởi động.

            Và nó ở ĐÂY chứ không ở `app/(tabs)/_layout.tsx`: màn Hồ sơ của
            Mentee cũng có lối chuyển sang chế độ Mentor, nên cả hai nhánh route
            phải nhìn thấy cùng một context. Dựng hai provider ở hai chỗ sẽ cho
            hai state riêng, và lựa chọn bấm ở bên này không có tác dụng ở bên
            kia cho tới lần mở app sau.
          */}
          <RoleModeProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </RoleModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
