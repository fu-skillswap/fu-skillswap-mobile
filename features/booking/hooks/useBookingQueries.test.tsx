import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  useMentorBookingCount,
  useMentorBookings,
  useMyBookings,
} from '@/features/booking/hooks/useBookingQueries';

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

describe('useMentorBookings', () => {
  it('LUÔN gửi role=MENTOR', async () => {
    // Bỏ `role` thì backend mặc định `BookingViewRole.MENTEE` và màn hình mentor
    // sẽ hiện các buổi người đó đã ĐẶT với mentor khác — một danh sách hợp lệ,
    // có dữ liệu, trông hoàn toàn bình thường, và sai hoàn toàn.
    const roleDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        roleDaGui.push(new URL(request.url).searchParams.get('role'));
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    const { result } = await renderHook(() => useMentorBookings({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roleDaGui).toEqual(['MENTOR']);
  });

  it('chỗ gọi KHÔNG ghi đè được role', async () => {
    const roleDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        roleDaGui.push(new URL(request.url).searchParams.get('role'));
        return HttpResponse.json(envelope(trang([], 0, true)));
      }),
    );

    // `role` bị loại khỏi kiểu tham số, nên dòng dưới là lỗi biên dịch nếu viết
    // tường minh. Ở đây truyền qua một object rộng hơn để kiểm hành vi lúc chạy:
    // spread của hook đặt `role: 'MENTOR'` SAU `...filters`.
    const boLoc: Record<string, unknown> = { role: 'MENTEE', status: 'PENDING' };
    const { result } = await renderHook(() => useMentorBookings(boLoc), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(roleDaGui).toEqual(['MENTOR']);
  });

  it('khoá cache KHÁC useMyBookings — hai góc nhìn không dùng chung entry', async () => {
    // Dùng chung khoá thì mở tab Lịch hẹn rồi sang tab Booking sẽ hiện lại đúng
    // danh sách cũ, không gọi API, và không ai thấy gì bất thường.
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const role = new URL(request.url).searchParams.get('role');
        return HttpResponse.json(
          envelope(trang([{ bookingId: role === 'MENTOR' ? 'mb1' : 'b1' }], 0, true)),
        );
      }),
    );

    const { result } = await renderHook(
      () => ({ mentee: useMyBookings({}), mentor: useMentorBookings({}) }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.mentor.bookings).toHaveLength(1));
    await waitFor(() => expect(result.current.mentee.bookings).toHaveLength(1));

    expect(result.current.mentee.bookings[0]?.bookingId).toBe('b1');
    expect(result.current.mentor.bookings[0]?.bookingId).toBe('mb1');
  });

  it('vẫn gộp nhiều trang offset như useMyBookings', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const p = new URL(request.url).searchParams.get('page');
        return HttpResponse.json(
          envelope(
            p === '1'
              ? trang([{ bookingId: 'mb3' }, { bookingId: 'mb4' }], 1, true)
              : trang([{ bookingId: 'mb1' }, { bookingId: 'mb2' }], 0, false),
          ),
        );
      }),
    );

    const { result } = await renderHook(() => useMentorBookings({}), { wrapper });
    await waitFor(() => expect(result.current.bookings).toHaveLength(2));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.bookings).toHaveLength(4));
  });
});

describe('useMentorBookingCount', () => {
  it('xin size=1 và đọc totalElements, KHÔNG đếm trên mảng đã tải', async () => {
    // Đếm bằng `content.length` sẽ cho đúng `size` mãi mãi (10 mặc định) khi
    // mentor có nhiều hơn một trang — và con số này là lý do người dùng bấm vào
    // dải nhắc việc.
    const thamSo: { role: string | null; status: string | null; size: string | null }[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        thamSo.push({ role: p.get('role'), status: p.get('status'), size: p.get('size') });
        return HttpResponse.json(
          envelope({
            content: [{ bookingId: 'mb2' }],
            page: 0,
            size: 1,
            totalElements: 7,
            totalPages: 7,
            last: false,
          }),
        );
      }),
    );

    const { result } = await renderHook(() => useMentorBookingCount('PENDING'), { wrapper });
    await waitFor(() => expect(result.current.soLuong).toBe(7));

    expect(thamSo).toEqual([{ role: 'MENTOR', status: 'PENDING', size: '1' }]);
  });

  it('chưa tải xong thì soLuong là null, KHÔNG phải 0', async () => {
    // `0` nghĩa là "không có yêu cầu nào đang chờ" — một câu khẳng định. `null`
    // nghĩa là "chưa biết", và dải nhắc việc phải im lặng ở trạng thái đó chứ
    // không được nói "0 yêu cầu đang chờ bạn xác nhận".
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope({
            content: [],
            page: 0,
            size: 1,
            totalElements: 0,
            totalPages: 1,
            last: true,
          }),
        ),
      ),
    );

    const { result } = await renderHook(() => useMentorBookingCount('PENDING'), { wrapper });
    expect(result.current.soLuong).toBeNull();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.soLuong).toBe(0);
  });

  it('lỗi thì soLuong là null, không phải một con số bịa', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          { timestamp: '2026-10-04T00:00:00Z', status: 403, code: 'SYS_0005', message: 'x', data: null },
          { status: 403 },
        ),
      ),
    );

    const { result } = await renderHook(() => useMentorBookingCount('PENDING'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.soLuong).toBeNull();
  });

  it('khoá cache tách khỏi khoá DANH SÁCH', async () => {
    // Nếu phép đếm (`size: 1`) nằm dưới cùng tiền tố với danh sách, màn hình
    // danh sách có thể đọc một entry chỉ có 1 phần tử và hiện đúng một thẻ.
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const size = new URL(request.url).searchParams.get('size');
        return HttpResponse.json(
          envelope(
            size === '1'
              ? {
                  content: [{ bookingId: 'mb2' }],
                  page: 0,
                  size: 1,
                  totalElements: 5,
                  totalPages: 5,
                  last: false,
                }
              : trang([{ bookingId: 'mb1' }, { bookingId: 'mb2' }], 0, true),
          ),
        );
      }),
    );

    const { result } = await renderHook(
      () => ({
        dem: useMentorBookingCount('PENDING'),
        ds: useMentorBookings({ status: 'PENDING' }),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.dem.soLuong).toBe(5));
    await waitFor(() => expect(result.current.ds.bookings).toHaveLength(2));
  });
});
