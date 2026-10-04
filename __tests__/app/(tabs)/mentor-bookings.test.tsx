import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Linking } from 'react-native';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorBookingsScreen } from '@/features/booking';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import type { BookingResponse } from '@/features/booking/types';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

/**
 * `expo-router` phải được giả dù `MentorBookingsScreen` KHÔNG dùng router.
 *
 * Lý do: test import qua barrel `@/features/booking`, và barrel đó cũng kéo
 * `MyBookingsScreen` — màn đó có dùng `useRouter`. Bản thật của `expo-router`
 * kéo theo `standard-navigation`, một module ESM nằm ngoài
 * `transformIgnorePatterns` của repo, nên Jest không parse được.
 *
 * Việc màn này không điều hướng đi đâu là CÓ CHỦ Ý: `MentorBookingDetail` chưa
 * tồn tại, nên thẻ booking không phải một lối đi. Test cuối cùng của file khoá
 * điều đó lại.
 */
jest.mock('expo-router', () => {
  const push = jest.fn();
  const replace = jest.fn();
  return {
    useRouter: () => ({ push, replace }),
    __mockPush: push,
    __mockReplace: replace,
  };
});

const { __mockPush: mockPush } = jest.requireMock<{ __mockPush: jest.Mock }>('expo-router');

/**
 * `expo-crypto` cần native module nên `randomUUID()` không chạy trong Jest.
 * Mutation check-in gọi nó để sinh `Idempotency-Key`.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'khoa-test-0001' }));

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

/** Một booking đang trong giờ học, mentor được check-in và có link để mở */
function dangDenGio(ghiDe: Partial<BookingResponse> = {}): BookingResponse {
  return taoBooking({
    bookingId: 'mb1',
    menteeDisplayName: 'Nguyễn Thu Hà',
    bookingStatus: 'CONFIRMED',
    displayState: 'IN_SESSION',
    canJoin: true,
    meetingPlatform: 'GOOGLE_MEET',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    attendance: {
      mentorCheckedInAt: null,
      menteeCheckedInAt: null,
      summary: 'NONE',
      currentUserCheckedIn: false,
      canCheckIn: true,
      checkInOpensAt: '2026-10-04T20:15:00+07:00',
      checkInClosesAt: '2026-10-04T21:45:00+07:00',
    },
    ...ghiDe,
  });
}

const server = setupServer();

/** Một QueryClient cho mỗi test — xem mục 6 của quy ước. */
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
      <MentorBookingsScreen />
    </QueryClientProvider>,
  );
}

describe('MentorBookingsScreen', () => {
  it('mở tab thì gọi role=MENTOR và KHÔNG gửi status (chế độ dashboard)', async () => {
    // `role=MENTOR` là tham số quan trọng nhất của màn này: thiếu nó thì backend
    // mặc định MENTEE và màn hình hiện các buổi mentor đã ĐẶT với người khác.
    // Và gửi `status=` rỗng sẽ thành 400 vì `BookingListRequest.status` là enum.
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(
          envelope(trang([dangDenGio({ attendance: taoBooking().attendance })], { total: 9 })),
        );
      }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Nguyễn Thu Hà')).toBeTruthy());
    expect(urlDaGui[0]).toContain('role=MENTOR');
    expect(urlDaGui[0]).not.toContain('status');
    expect(screen.getByText('9 buổi')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('hiện tiêu đề "Lịch đặt" và hàng chip lọc', async () => {
    server.use(http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))));

    await renderScreen();

    expect(screen.getByText('Lịch đặt')).toBeTruthy();
    expect(screen.getByTestId('loc-booking-mentor')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('bấm chip lọc thì gửi ĐÚNG giá trị BookingStatus legacy', async () => {
    // Hàng chip chỉ là trang trí nếu nó không đổi tham số thật. Và giá trị phải
    // là enum LEGACY (`PENDING`), không phải `BookingLifecycleStatus`
    // (`REQUESTED`) — gửi sai thì backend trả 400.
    const statusDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        statusDaGui.push(new URL(request.url).searchParams.get('status'));
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(statusDaGui).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('loc-booking-mentor-PENDING'));
    await waitFor(() => expect(statusDaGui).toContain('PENDING'));

    await donHangDoiDanhSach();
  });

  it('chip "Chờ bạn xác nhận" của MENTOR là AWAITING_MENTOR_COMPLETION', async () => {
    // Đây là chỗ hai phía dễ bị dùng lẫn chip của nhau. Cả hai giá trị quy về
    // `BookingLifecycleStatus.CONFIRMED` nên nhãn trạng thái không phân biệt
    // được, nhưng chúng là việc của HAI người khác nhau: cái này chờ MENTOR đánh
    // dấu buổi đã xong, `AWAITING_MENTEE_CONFIRMATION` chờ mentee xác nhận.
    const statusDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        statusDaGui.push(new URL(request.url).searchParams.get('status'));
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(statusDaGui).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('loc-booking-mentor-AWAITING_MENTOR_COMPLETION'));
    await waitFor(() => expect(statusDaGui).toContain('AWAITING_MENTOR_COMPLETION'));

    expect(statusDaGui).not.toContain('AWAITING_MENTEE_CONFIRMATION');
    await donHangDoiDanhSach();
  });

  it('bấm Check-in thì POST đúng endpoint kèm Idempotency-Key', async () => {
    const khoaDaGui: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
      http.post(`${BASE}/api/me/bookings/mb1/check-in`, ({ request }) => {
        khoaDaGui.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json(
          envelope({
            ...dangDenGio(),
            attendance: { ...dangDenGio().attendance, currentUserCheckedIn: true, canCheckIn: false },
          }),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-check-in-mb1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-check-in-mb1'));
    await waitFor(() => expect(khoaDaGui).toHaveLength(1));

    expect(khoaDaGui[0]).toMatch(/^[A-Za-z0-9._~-]{1,100}$/);
    await donHangDoiDanhSach();
  });

  it('check-in lỗi 409 thì hiện khối lỗi nói đúng việc cần làm, KHÔNG có nút thử lại', async () => {
    // Lỗi hay gặp nhất là 409 "chưa đến giờ / đã hết giờ"; bấm lại ngay vẫn hỏng
    // y như vậy, nên một nút "Thử lại" ở đây là một nút nói dối.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
      http.post(`${BASE}/api/me/bookings/mb1/check-in`, () =>
        HttpResponse.json(
          { timestamp: 'x', status: 409, code: 'SYS_0004', message: 'Chưa đến giờ', data: null },
          { status: 409 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-check-in-mb1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-check-in-mb1'));

    await waitFor(() => expect(screen.getByTestId('loi-check-in')).toBeTruthy());
    expect(screen.queryByText('Thử lại')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('đổi tab thì DỌN khối lỗi check-in của tab trước', async () => {
    // Khối lỗi nằm trên đầu danh sách, nên để nó dính lại là báo lỗi về một
    // booking người dùng không còn nhìn thấy.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
      http.post(`${BASE}/api/me/bookings/mb1/check-in`, () =>
        HttpResponse.json(
          { timestamp: 'x', status: 409, code: 'SYS_0004', message: 'Chưa đến giờ', data: null },
          { status: 409 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-check-in-mb1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-check-in-mb1'));
    await waitFor(() => expect(screen.getByTestId('loi-check-in')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('loc-booking-mentor-COMPLETED'));

    await waitFor(() => expect(screen.queryByTestId('loi-check-in')).toBeNull());
    await donHangDoiDanhSach();
  });

  it('bấm Mở phòng học thì gọi Linking với đúng link của backend', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-mo-phong-hoc-mb1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-mo-phong-hoc-mb1'));

    expect(moLink).toHaveBeenCalledWith('https://meet.google.com/abc-defg-hij');
    await donHangDoiDanhSach();
  });

  it('mở link THẤT BẠI thì nói ra, không nuốt lỗi', async () => {
    // `openURL` có thể bị từ chối (máy chưa cài app, hoặc link mentor dán vào
    // không mở được). Nuốt lỗi cho một nút không làm gì và không nói gì — đúng
    // lớp lỗi tệ nhất, vì mentor đang đứng trước giờ dạy.
    moLink.mockRejectedValue(new Error('không mở được'));
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-mo-phong-hoc-mb1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-mo-phong-hoc-mb1'));

    await waitFor(() => expect(screen.getByTestId('loi-mo-phong-hoc-mentor')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('danh sách rỗng hiện EmptyState có mô tả RIÊNG theo tab', async () => {
    server.use(http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))));

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Chưa có booking nào ở đây')).toBeTruthy(),
    );
    expect(
      screen.getByText('Chưa có mentee nào đặt lịch trong khoảng 7 ngày trước đến 90 ngày tới.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('loc-booking-mentor-PENDING'));
    await waitFor(() =>
      expect(screen.getByText('Không có yêu cầu nào đang chờ bạn phản hồi.')).toBeTruthy(),
    );
    await donHangDoiDanhSach();
  });

  it('trạng thái rỗng KHÔNG có nút hành động nào', async () => {
    // TEST CANH. Thiết kế không vẽ nút nào ở đây, và mọi màn có thể nhận nút đó
    // (MentorServices để mở thêm dịch vụ, MentorSchedule để mở thêm khung giờ)
    // đều chưa tồn tại.
    server.use(http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có booking nào ở đây')).toBeTruthy());

    expect(screen.queryByText('Thêm dịch vụ')).toBeNull();
    expect(screen.queryByText('Mở khung giờ')).toBeNull();
    expect(screen.queryByText('Tìm Mentor')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('mất mạng (query bị hoãn) thì nói mất kết nối, KHÔNG nói "chưa có booking"', async () => {
    // `isLoading` KHÔNG bật khi mất mạng (xem `core/api/queryState.ts`), nên một
    // màn hình chỉ hỏi `isLoading` sẽ rơi xuống nhánh rỗng và nói dối.
    onlineManager.setOnline(false);
    try {
      server.use(
        http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))),
      );

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByText('Chưa có booking nào ở đây')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await. Thiếu khối này thì Jest báo
      // "did not exit one second after the test run has completed".
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('lỗi 500 thì hiện ErrorView kèm nút thử lại, không hiện danh sách rỗng', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          { timestamp: 'x', status: 500, code: 'SYS_0001', message: 'Lỗi', data: null },
          { status: 500 },
        ),
      ),
    );

    await renderScreen();

    // `shouldRetryQuery` thử lại 2 lần với 5xx nên chỗ này phải chờ lâu hơn mặc
    // định của `waitFor`.
    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    expect(screen.queryByText('Chưa có booking nào ở đây')).toBeNull();
    await donHangDoiDanhSach();
  }, 15_000);

  it('KHÔNG dựng nút sắp xếp "Gần nhất" của thiết kế', async () => {
    // TEST CANH. `bookingPriorityPageable()` dựng `PageRequest.of(page, size)`
    // KHÔNG kèm `Sort` khi không có `status`, nên `sortBy` bị bỏ qua ở đúng tab
    // mặc định — một nút sắp xếp im lặng không làm gì ở một trong năm tab.
    server.use(http.get(`${BASE}/api/me/bookings`, () => HttpResponse.json(envelope(trang([])))));

    await renderScreen();

    expect(screen.queryByText('Gần nhất')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('KHÔNG gửi sortBy lên backend', async () => {
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(urlDaGui).toHaveLength(1));

    expect(urlDaGui[0]).not.toContain('sortBy');
    expect(urlDaGui[0]).not.toContain('direction');
    await donHangDoiDanhSach();
  });

  it('KHÔNG dựng nút Xác nhận / Từ chối, kể cả với booking PENDING của backend', async () => {
    // TEST CANH — cùng lý do như trong `MentorBookingCard.test.tsx`, nhưng kiểm ở
    // tầng màn hình để không ai thêm chúng vào `ListHeaderComponent` hay một
    // hàng nút riêng ngoài thẻ.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(
          envelope(
            trang([
              taoBooking({
                bookingId: 'mb2',
                menteeDisplayName: 'Lê Ngọc Anh',
                status: 'PENDING',
                bookingStatus: 'REQUESTED',
                displayState: 'PENDING_MENTOR_RESPONSE',
                canAccept: true,
                canReject: true,
                nextAction: 'ACCEPT_OR_REJECT',
              }),
            ]),
          ),
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Lê Ngọc Anh')).toBeTruthy());

    // Tìm theo testID của nhãn, không theo chữ: "Đang chờ" cũng là nhãn của một
    // chip lọc, nên `getByText` khớp hai phần tử và ném.
    expect(screen.getByTestId('trang-thai-mentor-mb2')).toHaveTextContent('Đang chờ');
    expect(screen.queryByText('Xác nhận')).toBeNull();
    expect(screen.queryByText('Từ chối')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('thẻ booking KHÔNG dẫn đi đâu — MentorBookingDetail chưa tồn tại', async () => {
    // TEST CANH. Thiết kế cho mỗi thẻ dẫn sang `MentorBookingDetail.dc.html`;
    // màn đó chưa thuộc đợt này, nên thẻ chỉ là thông tin chứ không phải lối đi.
    server.use(
      http.get(`${BASE}/api/me/bookings`, () =>
        HttpResponse.json(envelope(trang([dangDenGio()]))),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Nguyễn Thu Hà')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('the-booking-mentor-mb1'));

    expect(mockPush).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });
});
