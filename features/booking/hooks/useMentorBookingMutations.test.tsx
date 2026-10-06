import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  useAcceptBooking,
  useCancelBookingByMentor,
  useCheckInBooking,
  useCompleteBookingByMentor,
  useRejectBooking,
} from '@/features/booking/hooks/useBookingMutations';
import { bookingKeys } from '@/features/booking/queryKeys';
import { mentorModeKeys } from '@/features/mentorMode/queryKeys';

/**
 * @file useMentorBookingMutations.test.tsx
 * @description Thao tác ghi PHÍA MENTOR của `useBookingMutations.ts`: cái gì phải
 * làm mới sau khi mentor chấp nhận / từ chối / check-in / hoàn tất / huỷ.
 */

let demKhoa = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(demKhoa += 1)}` }));

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  demKhoa = 0;
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

/** Gieo cache: slot lịch dạy và chi tiết của một booking KHÁC cùng slot */
function gieoCache() {
  queryClient.setQueryData(mentorModeKeys.slots('2026-10-05', '2026-10-11'), []);
  queryClient.setQueryData(bookingKeys.detail('b-khac'), { bookingId: 'b-khac', bookingStatus: 'REQUESTED' });
}

function daCu(key: readonly unknown[]): boolean {
  return queryClient.getQueryState(key)?.isInvalidated === true;
}

describe('làm mới sau thao tác của mentor', () => {
  it('chấp nhận: làm mới slot lịch dạy VÀ chi tiết các yêu cầu khác (bị backend tự từ chối)', async () => {
    gieoCache();
    server.use(
      http.post(`${BASE}/api/mentor/bookings/b1/accept`, () =>
        HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'CONFIRMED' })),
      ),
    );

    const { result } = await renderHook(() => useAcceptBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', meetingPlatform: 'ZOOM', meetingLink: 'https://zoom.us/j/1' });
    });

    expect(daCu(mentorModeKeys.slots('2026-10-05', '2026-10-11'))).toBe(true);
    expect(daCu(bookingKeys.detail('b-khac'))).toBe(true);
  });

  it('từ chối: làm mới slot lịch dạy', async () => {
    gieoCache();
    server.use(
      http.post(`${BASE}/api/mentor/bookings/b1/reject`, () =>
        HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'REJECTED' })),
      ),
    );

    const { result } = await renderHook(() => useRejectBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', rejectReason: 'Bận' });
    });

    expect(daCu(mentorModeKeys.slots('2026-10-05', '2026-10-11'))).toBe(true);
  });

  it('check-in: làm mới slot lịch dạy', async () => {
    gieoCache();
    server.use(
      http.post(`${BASE}/api/me/bookings/b1/check-in`, () =>
        HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'CONFIRMED' })),
      ),
    );

    const { result } = await renderHook(() => useCheckInBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1' });
    });

    expect(daCu(mentorModeKeys.slots('2026-10-05', '2026-10-11'))).toBe(true);
  });
});

describe('useCompleteBookingByMentor', () => {
  it('POST /api/mentor/bookings/{id}/complete kèm Idempotency-Key, ghi chi tiết mới vào cache', async () => {
    const ghiNhan: { khoa: string | null } = { khoa: null };
    server.use(
      http.post(`${BASE}/api/mentor/bookings/b1/complete`, ({ request }) => {
        ghiNhan.khoa = request.headers.get('Idempotency-Key');
        return HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'AWAITING_MENTEE_CONFIRMATION' }));
      }),
    );

    const { result } = await renderHook(() => useCompleteBookingByMentor(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1' });
    });

    expect(ghiNhan.khoa).toBe('khoa-1');
    expect(queryClient.getQueryData(bookingKeys.detail('b1'))).toMatchObject({
      bookingStatus: 'AWAITING_MENTEE_CONFIRMATION',
    });
  });
});

describe('useCancelBookingByMentor', () => {
  it('đi nhánh /api/mentor (không phải /api/me) với lý do huỷ', async () => {
    const ghiNhan: { body: unknown } = { body: null };
    server.use(
      http.post(`${BASE}/api/mentor/bookings/b1/cancel`, async ({ request }) => {
        ghiNhan.body = await request.json();
        return HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'CANCELED_BY_MENTOR' }));
      }),
    );

    const { result } = await renderHook(() => useCancelBookingByMentor(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancelReason: 'Ốm' });
    });

    expect(ghiNhan.body).toEqual({ cancelReason: 'Ốm' });
  });
});
