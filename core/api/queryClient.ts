/**
 * @file queryClient.ts
 * @description Cấu hình TanStack Query dùng chung. Chính sách retry bám theo
 * ApiClientError: lỗi do phía client (4xx) thì thử lại vô ích, lỗi mạng và 5xx
 * thì thử lại vài lần.
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiClientError } from '@/core/api/errors';

const MAX_RETRY = 2;

/** Quyết định có retry một query thất bại hay không */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRY;
}

/** Tạo QueryClient với cấu hình mặc định của app */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        // Dữ liệu đã tải vẫn phục vụ được khi mất mạng (spec §6).
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
