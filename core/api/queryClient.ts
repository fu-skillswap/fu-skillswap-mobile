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

/**
 * Dọn sạch một QueryClient sau mỗi test — CHỈ dùng trong test.
 *
 * `queryClient.clear()` một mình là chưa đủ: `QueryCache.clear()` có gọi
 * `query.destroy()` để gỡ bộ hẹn giờ `gcTime`, nhưng `MutationCache.clear()`
 * thì KHÔNG gọi `mutation.destroy()` — mutation bị xoá khỏi cache mà bộ hẹn giờ
 * dọn rác (mặc định 5 phút) vẫn nằm trong event loop của Node. Jest chạy xong
 * rồi treo và báo "Jest did not exit one second after the test run has
 * completed", hoặc "A worker process has failed to exit gracefully".
 */
export function __resetQueryClientForTests(queryClient: QueryClient): void {
  for (const mutation of queryClient.getMutationCache().getAll()) {
    mutation.destroy();
  }
  queryClient.clear();
}
