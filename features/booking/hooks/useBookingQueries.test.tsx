import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { useMyBookings } from '@/features/booking/hooks/useBookingQueries';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

/** Một `PageResponse<T>` tối giản — chỉ đủ field để hook đọc được */
function trang(content: unknown[], page: number, last: boolean) {
  return { content, page, size: 2, totalElements: 4, totalPages: 2, last };
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

describe('useMyBookings', () => {
  it('gộp nhiều trang offset thành một mảng phẳng', async () => {
    const trangDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const p = new URL(request.url).searchParams.get('page');
        trangDaGui.push(p);
        return HttpResponse.json(
          envelope(
            p === '1'
              ? trang([{ bookingId: 'b3' }, { bookingId: 'b4' }], 1, true)
              : trang([{ bookingId: 'b1' }, { bookingId: 'b2' }], 0, false),
          ),
        );
      }),
    );

    const { result } = await renderHook(() => useMyBookings({}), { wrapper });
    await waitFor(() => expect(result.current.bookings).toHaveLength(2));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.bookings).toHaveLength(4));
    expect(trangDaGui).toEqual(['0', '1']);
  });

  it('luôn gửi role=MENTEE — danh sách của mentor là một góc nhìn KHÁC', async () => {
    // Thiếu tham số này thì backend vẫn mặc định MENTEE, nhưng một ngày nào đó
    // đổi mặc định là màn Lịch hẹn của mentee lặng lẽ hiện booking mentor nhận
    // được.
    const roleDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        roleDaGui.push(new URL(request.url).searchParams.get('role'));
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMyBookings({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roleDaGui).toEqual(['MENTEE']);
  });

  it('KHÔNG gửi status khi bộ lọc để trống — đó là chế độ dashboard của backend', async () => {
    // `status=` rỗng và "không có status" là hai yêu cầu khác nhau với backend:
    // `BookingListRequest.status` là enum, một chuỗi rỗng sẽ thành 400.
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMyBookings({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(urlDaGui[0]).not.toContain('status');
  });

  it('gửi status khi bộ lọc có trạng thái, và status vào CẢ khoá cache', async () => {
    // Thiếu `status` trong khoá thì tab "Đang chờ" và tab "Đã hoàn thành" dùng
    // chung một ô cache, và tab mở sau nhận đúng dữ liệu của tab mở trước.
    const statusDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        statusDaGui.push(status);
        return HttpResponse.json(
          envelope(trang([{ bookingId: `cho-${status}` }], 0, true)),
        );
      }),
    );

    const dangCho = await renderHook(() => useMyBookings({ status: 'PENDING' }), { wrapper });
    await waitFor(() => expect(dangCho.result.current.bookings).toHaveLength(1));

    const hoanThanh = await renderHook(() => useMyBookings({ status: 'COMPLETED' }), {
      wrapper,
    });
    await waitFor(() =>
      expect(hoanThanh.result.current.bookings[0]).toEqual({ bookingId: 'cho-COMPLETED' }),
    );

    expect(statusDaGui).toEqual(['PENDING', 'COMPLETED']);
    expect(dangCho.result.current.bookings[0]).toEqual({ bookingId: 'cho-PENDING' });
  });

  it('taiTrangKe() chặn hai lần bắn trong CÙNG một tick — không nối trùng trang', async () => {
    // Chốt chặn nằm TRONG hook (`useChotChanTrangKe`). Hai lần bắn cùng tick là
    // điều FlatList thật sự làm khi người dùng quăng nhanh tới cuối, và là tình
    // huống duy nhất mà guard theo state render không chặn nổi.
    const trangDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, async ({ request }) => {
        const p = new URL(request.url).searchParams.get('page');
        trangDaGui.push(p);
        if (p === '0') {
          return HttpResponse.json(envelope(trang([{ bookingId: 'b1' }], 0, false)));
        }
        // Chậm có chủ ý: giữ `isFetchingNextPage` bật đủ lâu để lần bắn thứ hai
        // rơi vào đúng lúc guard phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(envelope(trang([{ bookingId: 'b2' }], 1, true)));
      }),
    );

    const { result } = await renderHook(() => useMyBookings({}), { wrapper });
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));

    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.bookings).toHaveLength(2));
    expect(trangDaGui).toEqual(['0', '1']);
  });

  it('taiTrangKe() không gửi gì khi đã hết trang', async () => {
    let soLanGoi = 0;
    server.use(
      http.get(`${BASE}/api/me/bookings`, () => {
        soLanGoi += 1;
        return HttpResponse.json(envelope(trang([{ bookingId: 'b1' }], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMyBookings({}), { wrapper });
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));

    await act(async () => {
      result.current.taiTrangKe();
    });

    expect(soLanGoi).toBe(1);
  });
});
