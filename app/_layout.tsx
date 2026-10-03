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

import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { startMockServerIfEnabled } from '@/core/dev/mockServer';
import { setupOnlineManager } from '@/core/net/onlineStatus';
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

  // Chưa nạp xong thì giữ một nền trống đúng màu `surface-page` thay vì render
  // cây với font hệ thống rồi nhảy sang Montserrat — người dùng sẽ thấy chữ
  // đổi hình một nhịp. `fontError` cũng cho đi tiếp: thà xấu font còn hơn app
  // không bao giờ mở được vì một file font hỏng.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.surfacePage }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
