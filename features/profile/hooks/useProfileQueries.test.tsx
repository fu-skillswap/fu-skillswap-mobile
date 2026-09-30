import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import { useStudentProfile } from '@/features/profile/hooks/useProfileQueries';
import { profileKeys } from '@/features/profile/queryKeys';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-09-30T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const server = setupServer();

/** Một QueryClient cho mỗi test — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useStudentProfile', () => {
  it('tải được hồ sơ', async () => {
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(envelope({ studentCode: 'HE180001' })),
      ),
    );

    const { result } = await renderHook(() => useStudentProfile(), { wrapper });

    await waitFor(() => expect(result.current.data?.studentCode).toBe('HE180001'));
  });

  it("cache dưới đúng khoá ['profile', 'student']", async () => {
    // Khoá lệch thì invalidate ở nơi khác (ví dụ sau khi lưu hồ sơ) sẽ không
    // chạm tới entry này và màn hình giữ mãi dữ liệu cũ.
    //
    // Khoá mong đợi phải viết THẲNG ra chứ không lấy lại từ
    // `profileKeys.studentProfile()`: lấy lại thì hai bên của phép so sánh cùng
    // đổi khi khoá đổi, và test không bao giờ đỏ.
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(envelope({ studentCode: 'HE180001' })),
      ),
    );

    const { result } = await renderHook(() => useStudentProfile(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(profileKeys.studentProfile()).toEqual(['profile', 'student']);
    expect(queryClient.getQueryData(['profile', 'student'])).toEqual({
      studentCode: 'HE180001',
    });
  });

  it('chưa có hồ sơ thì data là null và KHÔNG phải trạng thái lỗi', async () => {
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(
          { timestamp: '', status: 404, code: 'PROFILE_4041', message: 'Chưa có', data: null },
          { status: 404 },
        ),
      ),
    );

    const { result } = await renderHook(() => useStudentProfile(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });
});
