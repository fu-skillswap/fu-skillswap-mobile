import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { createQueryClient } from '@/core/api/queryClient';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { setupOnlineManager } from '@/core/net/onlineStatus';

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
