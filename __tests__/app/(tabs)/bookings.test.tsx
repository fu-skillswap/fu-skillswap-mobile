import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Linking } from 'react-native';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MyBookingsScreen } from '@/features/booking';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock`.
 *
 * `useRouter: () => ({ push: jest.fn() })` tạo một hàm giả MỚI mỗi lần component
 * gọi `useRouter()`, nên không có spy nào giữ lại được để assert. Và không thể
 * tham chiếu một `const` ngoài factory: Jest hoist `jest.mock` lên trên mọi
 * khai báo.
 */
jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }), __mockPush: push };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

/**
 * `expo-crypto` cần native module nên `randomUUID()` không chạy trong Jest. Mutation
 * hủy lịch gọi nó để sinh `Idempotency-Key`.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'khoa-test-0001' }));

const { __mockPush: mockPush } = jest.requireMock<{ __mockPush: jest.Mock }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(
  content: unknown[],
  { page = 0, size = 10, last = true, total = content.length } = {},
) {
  return {
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    last,
  };
}

const server = setupServer();

/**
 * Một QueryClient cho mỗi test, KHÔNG phải mỗi lần gọi renderScreen: mỗi client
 * bỏ lại bộ hẹn giờ `gcTime` giữ event loop sống và Jest báo "A worker process
 * has failed to exit gracefully".
 */
let queryClient: QueryClient;
let moLink: jest.SpyInstance;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockPush.mockClear();
  moLink = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => {
  moLink.mockRestore();
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/** `render` của RNTL 14 là HÀM ASYNC — phải await, nếu không act scope rò ra. */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MyBookingsScreen />
    </QueryClientProvider>,
  );
}

describe('MyBookingsScreen', () => {
  it('mở tab thì gọi dashboard — KHÔNG gửi status, và hiện thẻ lịch hẹn', async () => {
    // "Không có status" là một endpoint khác về ngữ nghĩa (dashboard 7 ngày
    // trước → 90 ngày tới, xếp theo việc cần làm). Gửi `status=` rỗng sẽ thành
    // 400 vì `BookingListRequest.status` là enum.
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(
          envelope(trang([taoBooking({ bookingId: 'b1' })], { total: 7 })),
        );
      }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(urlDaGui[0]).not.toContain('status');
    expect(urlDaGui[0]).toContain('role=MENTEE');
    expect(screen.getByText('7 buổi')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('bấm chip lọc thì gửi ĐÚNG giá trị BookingStatus legacy lên backend', async () => {
    // Hàng chip chỉ là trang trí nếu nó không đổi tham số thật. Và giá trị phải
    // là enum LEGACY (`PENDING`), không phải `BookingLifecycleStatus`
    // (`REQUESTED`) — gửi sai thì backend trả 400.
    const statusDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        statusDaGui.push(status);
        return HttpResponse.json(
          envelope(
            trang([
              taoBooking({
                bookingId: 'b2',
                mentorDisplayName: 'Lê Thu Hà',
                status: 'PENDING',
                bookingStatus: 'REQUESTED',
                displayState: 'PENDING_MENTOR_RESPONSE',
              }),
            ]),
          ),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('danh-sach-lich-hen')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('loc-lich-hen-PENDING'));

    await waitFor(() => expect(screen.getByText('Lê Thu Hà')).toBeTruthy());
    expect(statusDaGui).toEqual([null, 'PENDING']);
    await donHangDoiDanhSach();
  });

  it('hàng chip KHÔNG có chip nào gộp nhiều trạng thái', async () => {
    /*
      `BookingListRequest.status` nhận MỘT giá trị enum. Chip "Đã hủy" của thiết
      kế cần hai (`CANCELLED_BY_MENTEE` + `CANCELLED_BY_MENTOR`) nên không lấy
      được bằng một request, và chip "Đang diễn ra" thì không có enum nào để lọc
      (`IN_SESSION` là `displayState`). Test này tồn tại để một lần "thêm lại cho
      giống thiết kế" không lặng lẽ đi qua.
    */
    server.use(
      http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('loc-lich-hen')).toBeTruthy());

    expect(screen.queryByTestId('loc-lich-hen-CANCELLED')).toBeNull();
    expect(screen.queryByTestId('loc-lich-hen-IN_SESSION')).toBeNull();
    expect(screen.queryByText('Đã hủy')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('KHÔNG có nút sắp xếp — backend bỏ qua sortBy ở tab mặc định', async () => {
    /*
      `bookingPriorityPageable()` dựng `PageRequest.of(page, size)` KHÔNG kèm
      `Sort` khi không có `status`, nên một nút "Gần nhất" sẽ im lặng không làm gì
      ở đúng tab đang mở. Xoá test này khi backend tôn trọng `sortBy` ở chế độ
      dashboard.
    */
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(envelope(trang([taoBooking()])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText('Gần nhất')).toBeNull();
    expect(screen.queryByLabelText(/Sắp xếp/)).toBeNull();
    expect(urlDaGui[0]).not.toContain('sortBy');
    await donHangDoiDanhSach();
  });

  it('bấm "Vào phòng học" MỞ ĐÚNG link mentor gửi', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(
            trang([
              taoBooking({
                bookingId: 'b1',
                displayState: 'IN_SESSION',
                canJoin: true,
                meetingLink: 'https://meet.google.com/abc-defg-hij',
              }),
            ]),
          ),
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đang diễn ra')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-vao-phong-hoc-b1'));

    expect(moLink).toHaveBeenCalledWith('https://meet.google.com/abc-defg-hij');
    await donHangDoiDanhSach();
  });

  it('mở link THẤT BẠI thì NÓI RA, không im lặng', async () => {
    // `openURL` bị từ chối khi máy chưa cài app tương ứng hoặc link mentor dán
    // vào không mở được. Nuốt lỗi sẽ cho một nút không làm gì và không nói gì —
    // đúng lúc người dùng đang đứng trước giờ học.
    moLink.mockRejectedValue(new Error('no activity found'));
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(
            trang([
              taoBooking({
                bookingId: 'b1',
                displayState: 'IN_SESSION',
                canJoin: true,
                meetingLink: 'zoomus://zoom.us/join?confno=123',
              }),
            ]),
          ),
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-vao-phong-hoc-b1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-vao-phong-hoc-b1'));

    await waitFor(() => expect(screen.getByTestId('loi-mo-phong-hoc')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('hủy lịch gửi ĐÚNG lý do kèm Idempotency-Key, rồi đóng hộp', async () => {
    const khoaDaGui: (string | null)[] = [];
    const lyDoDaGui: unknown[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(trang([taoBooking({ bookingId: 'b2', canCancel: true })])),
        ),
      ),
      http.post(`${BASE}/api/me/bookings/b2/cancel`, async ({ request }) => {
        khoaDaGui.push(request.headers.get('Idempotency-Key'));
        lyDoDaGui.push(((await request.json()) as { cancelReason?: unknown }).cancelReason);
        return HttpResponse.json(
          envelope(taoBooking({ bookingId: 'b2', bookingStatus: 'CANCELED_BY_MENTEE' })),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-huy-lich-b2')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-huy-lich-b2'));
    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), 'Em có lịch thi đột xuất.');
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-huy'));

    await waitFor(() => expect(screen.queryByTestId('hop-thoai-huy-lich')).toBeNull());
    expect(lyDoDaGui).toEqual(['Em có lịch thi đột xuất.']);
    expect(khoaDaGui).toEqual(['khoa-test-0001']);
    await donHangDoiDanhSach();
  });

  it('hủy lịch THẤT BẠI thì hộp VẪN MỞ và hiện lỗi', async () => {
    // Đóng hộp ngay lúc bấm sẽ làm người dùng tin là đã hủy xong trong khi
    // request vừa thất bại, và khối lỗi trong hộp thì không ai còn thấy.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(trang([taoBooking({ bookingId: 'b2', canCancel: true })])),
        ),
      ),
      http.post(`${BASE}/api/me/bookings/b2/cancel`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 409,
            code: 'BOOKING_4090',
            message: 'Booking không ở trạng thái có thể hủy',
            data: null,
          },
          { status: 409 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-huy-lich-b2')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-huy-lich-b2'));
    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), 'Em xin hủy');
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-huy'));

    await waitFor(() => expect(screen.getByTestId('loi-huy-lich')).toBeTruthy());
    expect(screen.getByTestId('hop-thoai-huy-lich')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('nhóm rỗng thì hiện EmptyState kèm lối sang tab Mentor, không phải lỗi', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có lịch nào ở đây')).toBeTruthy());
    expect(screen.queryByText('Thử lại')).toBeNull();

    await fireEvent.press(screen.getByText('Tìm Mentor'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/mentors');
    await donHangDoiDanhSach();
  });

  it('mô tả trạng thái rỗng đổi theo tab, không nói một câu chung cho mọi tab', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))),
    );

    await renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/đặt buổi đầu tiên/)).toBeTruthy(),
    );

    await fireEvent.press(screen.getByTestId('loc-lich-hen-PENDING'));

    await waitFor(() =>
      expect(screen.getByText('Không có yêu cầu nào đang chờ mentor phản hồi.')).toBeTruthy(),
    );
    await donHangDoiDanhSach();
  });

  it('cuộn tới cuối thì tải trang kế, và KHÔNG gọi trùng', async () => {
    // Chốt chặn đồng bộ nằm trong `useMyBookings` (`useChotChanTrangKe`). Hai lần
    // bắn trong CÙNG một tick là điều FlatList thật sự làm khi người dùng quăng
    // nhanh tới cuối.
    const pageDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pageDaGui.push(page);
        if (page === '0') {
          return HttpResponse.json(
            envelope(trang([taoBooking({ bookingId: 'b1' })], { size: 1, last: false, total: 2 })),
          );
        }
        // Chậm có chủ ý: giữ `isFetchingNextPage` bật đủ lâu để lần bắn thứ hai
        // rơi vào đúng lúc guard phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(
          envelope(
            trang([taoBooking({ bookingId: 'b2', mentorDisplayName: 'Mentor trang hai' })], {
              page: 1,
              size: 1,
              total: 2,
            }),
          ),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    const onEndReached = screen.getByTestId('danh-sach-lich-hen').props.onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('Mentor trang hai')).toBeTruthy());
    expect(pageDaGui).toEqual(['0', '1']);
    await donHangDoiDanhSach();
  });

  it('lỗi 500 thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
          { status: 500 },
        ),
      ),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    await donHangDoiDanhSach();
  }, 15_000);

  it('MẤT MẠNG lúc mở tab thì nói mất kết nối, KHÔNG nói chưa có lịch nào', async () => {
    // `isLoading` KHÔNG bật khi mất mạng: với networkMode 'online' (mặc định),
    // query ở status 'pending' + fetchStatus 'paused', mà
    // `isLoading = isPending && isFetching` nên nó là false. Màn hình chỉ hỏi
    // `isLoading` sẽ rơi xuống nhánh rỗng và báo "Chưa có lịch nào ở đây" trong
    // khi chưa hề gọi được API.
    onlineManager.setOnline(false);
    try {
      server.use(
        http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))),
      );

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByText('Chưa có lịch nào ở đây')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('KHÔNG có lối nạp tiền hay thanh toán nào trên màn này — mục 4.1 của quy ước', async () => {
    // Bản mobile là consumption-only. Một nút dẫn tới nạp tiền là thứ làm app bị
    // gỡ khỏi Google Play, và `canPay` của backend vẫn đúng ở trạng thái này.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(
            trang([
              taoBooking({
                bookingId: 'b3',
                bookingStatus: 'WAITING_PAYMENT',
                displayState: 'PAYMENT_REQUIRED',
                paymentStatus: 'PENDING',
                canPay: true,
                nextAction: 'PAY_NOW',
              }),
            ]),
          ),
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chờ thanh toán')).toBeTruthy());

    expect(screen.queryByText(/Thanh toán/)).toBeNull();
    expect(screen.queryByText(/Nạp/)).toBeNull();
    await donHangDoiDanhSach();
  });
});
