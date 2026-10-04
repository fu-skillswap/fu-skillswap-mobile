import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  useMyMentorProfile,
  useMyMentorWallet,
} from '@/features/mentorMode/hooks/useMentorModeQueries';
import {
  taoHoSoMentor,
  taoHoSoMentorRong,
  taoViMentor,
} from '@/features/mentorMode/mocks/mentorModeFixture';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

/** Envelope lỗi đúng khuôn backend — `ApiClientError` đọc `status`/`code` từ đây */
function loi(status: number, code: string, message: string) {
  return HttpResponse.json(
    { timestamp: '2026-10-04T00:00:00Z', status, code, message, data: null },
    { status },
  );
}

const server = setupServer();

/** Một QueryClient cho mỗi test — xem mục 6 của quy ước. */
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

describe('useMyMentorProfile', () => {
  it('gọi đúng endpoint hồ sơ mentor của CHÍNH MÌNH', async () => {
    // `/api/me/mentor-profile` là hồ sơ phẳng nhìn từ phía chủ sở hữu, khác hẳn
    // `/api/mentors/{id}` (hồ sơ công khai, có section lồng và `@JsonIgnore`).
    const duongDan: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, ({ request }) => {
        duongDan.push(new URL(request.url).pathname);
        return HttpResponse.json(envelope(taoHoSoMentor()));
      }),
    );

    const { result } = await renderHook(() => useMyMentorProfile(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(duongDan).toEqual(['/api/me/mentor-profile']);
  });

  it('`exists: false` là THÀNH CÔNG, không phải lỗi', async () => {
    // Backend trả 200 kèm `MentorProfileResponse.empty()` khi chưa có hồ sơ. Coi
    // nó là lỗi sẽ làm một mentor vừa được cấp quyền thấy ErrorView thay vì lời
    // mời điền hồ sơ.
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () =>
        HttpResponse.json(envelope(taoHoSoMentorRong())),
      ),
    );

    const { result } = await renderHook(() => useMyMentorProfile(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.exists).toBe(false);
    // Và các trường mà hai màn hình đọc đều là `null`, không phải `undefined`:
    // hình dạng đó mới là hình dạng backend trả.
    expect(result.current.data?.mentorStatus).toBeNull();
    expect(result.current.data?.completedSessions).toBeNull();
  });

  it('403 vẫn là lỗi thật và KHÔNG bị retry (4xx)', async () => {
    let soLan = 0;
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () => {
        soLan += 1;
        return loi(403, 'SYS_0005', 'Không có quyền');
      }),
    );

    const { result } = await renderHook(() => useMyMentorProfile(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    // `shouldRetryQuery` không retry 4xx — một 403 retry hai lần nữa chỉ làm
    // người dùng chờ lâu hơn để nhận cùng một câu trả lời.
    expect(soLan).toBe(1);
  });
});

describe('useMyMentorWallet', () => {
  it('gọi đúng endpoint ví settlement của mentor', async () => {
    const duongDan: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/mentor-wallet`, ({ request }) => {
        duongDan.push(new URL(request.url).pathname);
        return HttpResponse.json(envelope(taoViMentor()));
      }),
    );

    const { result } = await renderHook(() => useMyMentorWallet(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    // KHÔNG phải `/api/me/credit-wallet` — đó là ví của mentee, và endpoint đó
    // mang `@PreAuthorize("hasRole('MENTEE')")`.
    expect(duongDan).toEqual(['/api/me/mentor-wallet']);
    expect(result.current.data?.availableScoin).toBe(1215000);
  });

  it('`enabled: false` thì KHÔNG gọi API', async () => {
    // Endpoint mang `@PreAuthorize("hasRole('MENTOR')")`, nên gọi nó ở chế độ
    // Mentee sẽ nhận 403 và cái 403 đó nằm lại trong cache như một lỗi thật
    // (`shouldRetryQuery` không retry 4xx).
    let soLan = 0;
    server.use(
      http.get(`${BASE}/api/me/mentor-wallet`, () => {
        soLan += 1;
        return HttpResponse.json(envelope(taoViMentor()));
      }),
    );

    const { result } = await renderHook(() => useMyMentorWallet({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(soLan).toBe(0);
  });

  it('403 không làm vỡ gì — màn Tổng quan chỉ bỏ ô số dư', async () => {
    server.use(
      http.get(`${BASE}/api/me/mentor-wallet`, () =>
        loi(403, 'SYS_0005', 'Không có quyền mentor'),
      ),
    );

    const { result } = await renderHook(() => useMyMentorWallet(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });

  it('hai query dùng KHOÁ CACHE khác nhau', async () => {
    // Gộp chung khoá thì một cái 403 ở ví sẽ xoá luôn hồ sơ khỏi màn hình.
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () =>
        HttpResponse.json(envelope(taoHoSoMentor())),
      ),
      http.get(`${BASE}/api/me/mentor-wallet`, () => loi(403, 'SYS_0005', 'Không có quyền')),
    );

    const { result } = await renderHook(
      () => ({ hoSo: useMyMentorProfile(), vi: useMyMentorWallet() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.vi.isError).toBe(true));
    // Hồ sơ vẫn còn nguyên dù ví hỏng.
    expect(result.current.hoSo.data?.exists).toBe(true);
  });
});
