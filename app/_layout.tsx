import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { startMockServerIfEnabled } from '@/core/dev/mockServer';
import { setupOnlineManager } from '@/core/net/onlineStatus';

// Bật TRƯỚC khi bất cứ component nào render, và cố ý ở tầng module chứ không
// trong `useEffect`: `AuthProvider` gọi `POST /api/auth/refresh` ngay trong
// effect khởi động của nó, nên MSW phải chặn được từ request đầu tiên. Hàm tự
// no-op khi chế độ mock tắt — xem `core/dev/mockServer.ts`.
startMockServerIfEnabled();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => setupOnlineManager(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
