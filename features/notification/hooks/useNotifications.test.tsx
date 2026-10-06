import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { useNotifications } from '@/features/notification/hooks/useNotifications';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useNotifications', () => {
  it('hai lần gọi taiTrangKe cùng một tick chỉ xin trang kế MỘT lần (chốt chặn trong hook)', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        const nextCursor = cursor === null ? 'trang-2' : null;
        return HttpResponse.json(
          envelope({ items: [], nextCursor, prevCursor: null, hasNext: nextCursor !== null, hasPrev: false, limit: 20 }),
        );
      }),
    );

    const { result } = await renderHook(() => useNotifications(false), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(cursors).toEqual([null, 'trang-2']);
  });
});
