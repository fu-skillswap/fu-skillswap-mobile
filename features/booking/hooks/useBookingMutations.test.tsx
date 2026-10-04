import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { useCancelBooking } from '@/features/booking/hooks/useBookingMutations';
import { bookingKeys } from '@/features/booking/queryKeys';

/**
 * `expo-crypto` phải được giả: bản thật cần native module nên `randomUUID()`
 * không chạy trong Jest. Trả key TĂNG DẦN để test phân biệt được "dùng lại key
 * cũ" và "sinh key mới" — một mock trả hằng số sẽ làm cả hai trường hợp giống
 * nhau và luật idempotency không còn kiểm được.
 */
let demKhoa = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `khoa-${(demKhoa += 1)}`,
}));

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

/** Handler hủy lịch thành công, ghi lại header và thân request để assert */
function huyOk(ghiNhan: { khoa: (string | null)[]; lyDo: unknown[] }) {
  return http.post(`${BASE}/api/me/bookings/:bookingId/cancel`, async ({ request }) => {
    ghiNhan.khoa.push(request.headers.get('Idempotency-Key'));
    ghiNhan.lyDo.push(((await request.json()) as { cancelReason?: unknown }).cancelReason);
    return HttpResponse.json(envelope({ bookingId: 'b1', bookingStatus: 'CANCELED_BY_MENTEE' }));
  });
}

describe('useCancelBooking', () => {
  it('gửi Idempotency-Key và lý do hủy lên đúng endpoint', async () => {
    // Thiếu header này thì backend trả 400 `IDEMPOTENCY_KEY_REQUIRED` ở MỌI lần
    // hủy — xem JSDoc của `bookingRepo.cancelBooking`.
    const ghiNhan = { khoa: [] as (string | null)[], lyDo: [] as unknown[] };
    server.use(huyOk(ghiNhan));

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancelReason: 'Em có lịch thi' });
    });

    expect(ghiNhan.khoa).toEqual(['khoa-1']);
    expect(ghiNhan.lyDo).toEqual(['Em có lịch thi']);
  });

  it('gửi lại sau LỖI MẠNG, cùng payload, thì dùng lại ĐÚNG key cũ', async () => {
    /*
      Đây là lý do tồn tại của `createIdempotencyStore`: lần gửi lại sau lỗi mạng
      phải để backend replay kết quả đã commit, thay vì thử hủy lần nữa và nhận
      409 "không ở trạng thái có thể hủy" — câu lỗi khiến người dùng tin là họ
      hủy thất bại trong khi booking ĐÃ bị hủy ở lần gửi hụt sóng.

      Lần đầu phải THẤT BẠI: key chỉ được quên khi thao tác kết thúc hẳn
      (`onSuccess` gọi `release`), nên hai lần gửi thành công liên tiếp là hai ý
      định khác nhau và đúng ra phải có hai key.
    */
    const ghiNhan = { khoa: [] as (string | null)[], lyDo: [] as unknown[] };
    let soLanGoi = 0;
    server.use(
      http.post(`${BASE}/api/me/bookings/:bookingId/cancel`, async ({ request }) => {
        soLanGoi += 1;
        ghiNhan.khoa.push(request.headers.get('Idempotency-Key'));
        if (soLanGoi === 1) {
          return HttpResponse.error();
        }
        return HttpResponse.json(
          envelope({ bookingId: 'b1', bookingStatus: 'CANCELED_BY_MENTEE' }),
        );
      }),
    );

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      result.current.mutate({ bookingId: 'b1', cancelReason: 'Em có lịch thi' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancelReason: 'Em có lịch thi' });
    });

    expect(ghiNhan.khoa).toEqual(['khoa-1', 'khoa-1']);
  });

  it('SỬA lý do rồi gửi lại thì sinh key MỚI — key cũ với payload khác bị trả 409', async () => {
    const ghiNhan = { khoa: [] as (string | null)[], lyDo: [] as unknown[] };
    server.use(
      http.post(`${BASE}/api/me/bookings/:bookingId/cancel`, async ({ request }) => {
        ghiNhan.khoa.push(request.headers.get('Idempotency-Key'));
        // Luôn lỗi để key chưa bị `release`, đúng tình huống người dùng sửa lý do
        // sau một lần gửi thất bại.
        return HttpResponse.error();
      }),
    );

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      result.current.mutate({ bookingId: 'b1', cancelReason: 'Lý do một' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    await act(async () => {
      result.current.mutate({ bookingId: 'b1', cancelReason: 'Lý do hai' });
    });
    await waitFor(() => expect(ghiNhan.khoa).toHaveLength(2));

    expect(ghiNhan.khoa).toEqual(['khoa-1', 'khoa-2']);
  });

  it('hai booking khác nhau dùng hai key khác nhau', async () => {
    // Dùng chung một key cho hai booking sẽ làm lần hủy thứ hai nhận lại kết quả
    // của lần thứ nhất: người dùng thấy "đã hủy" cho một buổi vẫn còn nguyên.
    const ghiNhan = { khoa: [] as (string | null)[], lyDo: [] as unknown[] };
    server.use(huyOk(ghiNhan));

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancelReason: 'Lý do' });
    });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b2', cancelReason: 'Lý do' });
    });

    expect(new Set(ghiNhan.khoa).size).toBe(2);
  });

  it('thành công thì làm mới MỌI danh sách lịch hẹn, không chỉ tab đang mở', async () => {
    // Booking vừa hủy phải rời tab trạng thái cũ và xuất hiện ở nhóm "Mentee
    // hủy". Invalidate đúng một khoá sẽ để các tab khác giữ dữ liệu đã cũ.
    const ghiNhan = { khoa: [] as (string | null)[], lyDo: [] as unknown[] };
    server.use(huyOk(ghiNhan));

    const khoaDaHuy: unknown[] = [];
    const spy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(async (filters) => {
        khoaDaHuy.push(filters?.queryKey);
      });

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancelReason: 'Lý do' });
    });

    expect(khoaDaHuy).toContainEqual(bookingKeys.listsAll());
    expect(khoaDaHuy).toContainEqual(bookingKeys.detail('b1'));
    spy.mockRestore();
  });

  it('MẤT MẠNG thì thất bại NGAY, không treo vô hạn — networkMode always', async () => {
    /*
      Với `networkMode: 'online'` (mặc định), TanStack HOÃN request khi mất mạng:
      `isPending` bật mãi nên nút "Xác nhận hủy" quay không dừng, `onSettled`
      không chạy, và người dùng không có cách nào biết yêu cầu của mình vẫn nằm
      chờ. Test này đỏ nếu ai đó bỏ `networkMode: 'always'`.
    */
    onlineManager.setOnline(false);
    try {
      server.use(
        http.post(`${BASE}/api/me/bookings/:bookingId/cancel`, () =>
          HttpResponse.error(),
        ),
      );

      const { result } = await renderHook(() => useCancelBooking(), { wrapper });
      await act(async () => {
        result.current.mutate({ bookingId: 'b1', cancelReason: 'Lý do' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.isPending).toBe(false);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
  });

  it('lỗi 429 giữ nguyên retryAfterSeconds của backend để giao diện nói ra', async () => {
    // Backend chặn 3 yêu cầu hủy / 1 giờ. Mất con số này thì hộp hủy chỉ nói
    // "thử lại sau" chung chung, trong khi người dùng cần biết là một tiếng.
    server.use(
      http.post(`${BASE}/api/me/bookings/:bookingId/cancel`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 429,
            code: 'SYS_0429',
            message: 'Bạn đang gửi yêu cầu hủy quá nhanh',
            data: null,
            retryAfterSeconds: 3600,
          },
          { status: 429 },
        ),
      ),
    );

    const { result } = await renderHook(() => useCancelBooking(), { wrapper });
    await act(async () => {
      result.current.mutate({ bookingId: 'b1', cancelReason: 'Lý do' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const loi = result.current.error;
    expect(loi).toBeInstanceOf(ApiClientError);
    expect((loi as ApiClientError).status).toBe(429);
    expect((loi as ApiClientError).retryAfterSeconds).toBe(3600);
  });
});
