import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import { MentorDashboardScreen } from '@/features/mentorMode';
import {
  taoHoSoMentor,
  taoHoSoMentorRong,
  taoViMentor,
} from '@/features/mentorMode/mocks/mentorModeFixture';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

/**
 * Phiên đăng nhập giả: `AuthProvider` import `@react-native-google-signin`,
 * package gọi `TurboModuleRegistry.getEnforcing` ngay lúc nạp module nên test
 * nổ ở bước import nếu không mock.
 */
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      publicId: 'mentor-0001',
      email: 'mentor@fpt.edu.vn',
      fullName: 'Trần Minh Quân',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: ['MENTEE', 'MENTOR'],
      profileCompleted: true,
      hasStudentProfile: true,
      googleCalendarConnected: false,
      googleCalendarSyncEnabled: false,
      googleCalendarNeedsReconnect: false,
    },
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  }),
}));

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock` —
 * `useRouter: () => ({ push: jest.fn() })` tạo một hàm giả MỚI mỗi lần component
 * gọi `useRouter()`, nên không có spy nào giữ lại được để assert.
 */
jest.mock('expo-router', () => {
  const push = jest.fn();
  const replace = jest.fn();
  return { useRouter: () => ({ push, replace }), __mockPush: push };
});

const { __mockPush: mockPush } = jest.requireMock<{ __mockPush: jest.Mock }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(content: unknown[], total = content.length) {
  return {
    content,
    page: 0,
    size: 3,
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / 3)),
    last: content.length >= total,
  };
}

/** Lỗi đúng khuôn envelope của backend */
function loi(status: number, code: string) {
  return HttpResponse.json(
    { timestamp: 'x', status, code, message: 'Lỗi', data: null },
    { status },
  );
}

/**
 * Handler cho CẢ BA nguồn dữ liệu của màn hình.
 *
 * `/api/me/bookings` bị gọi HAI lần với hai bộ tham số khác nhau (danh sách sắp
 * tới và phép đếm `size=1&status=PENDING`), nên một handler duy nhất phải phân
 * biệt được chúng — trả cùng một thứ cho cả hai sẽ làm dải nhắc việc và danh
 * sách nói hai chuyện khác nhau về cùng một dữ liệu.
 */
function duLieuDayDu({
  soDangCho = 2,
  sapToi = [taoBooking({ bookingId: 'mb1', menteeDisplayName: 'Nguyễn Thu Hà' })],
  hoSo = taoHoSoMentor(),
  vi = taoViMentor(),
}: {
  soDangCho?: number;
  sapToi?: unknown[];
  hoSo?: unknown;
  vi?: unknown;
} = {}) {
  return [
    http.get(`${BASE}/api/me/mentor-profile`, () => HttpResponse.json(envelope(hoSo))),
    http.get(`${BASE}/api/me/mentor-wallet`, () => HttpResponse.json(envelope(vi))),
    http.get(`${BASE}/api/me/bookings`, ({ request }) => {
      const p = new URL(request.url).searchParams;
      if (p.get('size') === '1' && p.get('status') === 'PENDING') {
        return HttpResponse.json(envelope(trang(soDangCho > 0 ? [{}] : [], soDangCho)));
      }
      return HttpResponse.json(envelope(trang(sapToi)));
    }),
  ];
}

/**
 * Chuông thông báo ở đầu trang luôn hỏi số chưa đọc khi màn mở. Đặt làm handler
 * GỐC của server (sống qua `resetHandlers`) để test nào cũng có, không phải nhắc.
 */
const soChuaDocMacDinh = http.get(`${BASE}/api/me/notifications/unread-count`, () =>
  HttpResponse.json(envelope({ unreadCount: 0 })),
);

const server = setupServer(soChuaDocMacDinh);

/** Một QueryClient cho mỗi test — xem mục 6 của quy ước. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockPush.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/** `render` của RNTL 14 là HÀM ASYNC — phải await, nếu không act scope rò ra. */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorDashboardScreen />
    </QueryClientProvider>,
  );
}

/** Đợi mọi query của màn hình ngã ngũ, gọi ở CUỐI mỗi test */
async function doiXong() {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  // `isFetching()` về 0 NGAY khi request xong, nhưng TanStack còn gom việc thông
  // báo cho subscriber vào một `setTimeout(0)` (`notifyManager`) — cú re-render
  // đó sẽ rơi ra ngoài act nếu không nhường thêm một nhịp macrotask.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('MentorDashboardScreen', () => {
  it('hiện lời chào và nhãn CHẾ ĐỘ MENTOR', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();

    expect(screen.getByText('CHẾ ĐỘ MENTOR')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Chào Trần Minh Quân')).toBeTruthy());
    await doiXong();
  });

  it('hiện SỐ DƯ khả dụng từ ví settlement, kèm đơn vị', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('o-so-du-gia-tri')).toHaveTextContent('1.215.000 S-coin'),
    );
    expect(screen.getByText('Số dư khả dụng')).toBeTruthy();
    await doiXong();
  });

  it('nhãn ô số dư KHÔNG nói "Thu nhập 7 ngày" — không có API cho con số đó', async () => {
    // TEST CANH. Thiết kế gắn nhãn "Thu nhập 7 ngày" lên ô này, nhưng backend
    // không có endpoint nào trả thu nhập theo khoảng thời gian. Gắn nhãn đó lên
    // số dư là nói sai về tiền.
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Số dư khả dụng')).toBeTruthy());

    expect(screen.queryByText('Thu nhập 7 ngày')).toBeNull();
    await doiXong();
  });

  it('hiện điểm đánh giá và số lượt từ hồ sơ mentor', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('o-danh-gia-gia-tri')).toHaveTextContent('4.8 / 87 lượt'),
    );
    await doiXong();
  });

  it('mentor chưa có đánh giá thì nói thẳng, KHÔNG tự hiện 5.0', async () => {
    server.use(
      ...duLieuDayDu({ hoSo: taoHoSoMentor({ ratingAverage: null, reviewCount: 0 }) }),
    );

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('o-danh-gia-gia-tri')).toHaveTextContent('Chưa có đánh giá'),
    );
    expect(screen.queryByText('5.0')).toBeNull();
    await doiXong();
  });

  it('hiện số BUỔI đã hoàn thành với đúng cái tên của nó', async () => {
    // `completedSessions` là số BUỔI, không phải số MENTEE. Dùng nó cho ô
    // "Mentee" của thiết kế sẽ đếm một mentee học 5 buổi thành 5 người.
    server.use(...duLieuDayDu());

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('o-buoi-hoan-thanh-gia-tri')).toHaveTextContent('124'),
    );
    expect(screen.getByText('Buổi đã hoàn thành')).toBeTruthy();
    expect(screen.queryByText('Mentee')).toBeNull();
    await doiXong();
  });

  it('hồ sơ chưa tạo (exists=false): KHÔNG in "0" cho các ô thiếu dữ liệu', async () => {
    // `MentorProfileResponse.empty()` để `completedSessions` và `ratingAverage`
    // là `null`. "0 buổi đã hoàn thành" và "chưa biết" là hai chuyện khác nhau.
    server.use(...duLieuDayDu({ hoSo: taoHoSoMentorRong() }));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có đánh giá')).toBeTruthy());

    expect(screen.queryByTestId('o-buoi-hoan-thanh')).toBeNull();
    await doiXong();
  });

  it('hồ sơ chưa tạo thì vẫn chào bằng tên từ phiên đăng nhập', async () => {
    // `displayName` là `null` khi `exists === false`; một lời chào "Chào " cụt
    // trông như lỗi giao diện.
    server.use(...duLieuDayDu({ hoSo: taoHoSoMentorRong() }));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chào Trần Minh Quân')).toBeTruthy());
    await doiXong();
  });

  it('ví lỗi 403 thì BỎ ô số dư, phần còn lại vẫn hiện', async () => {
    // `/api/me/mentor-wallet` là endpoint duy nhất đòi đúng vai trò MENTOR nên
    // nó dễ 403 nhất. In "0 S-coin" cho một lần gọi thất bại là nói với mentor
    // rằng họ không có tiền.
    // Handler ghi đè đứng TRƯỚC: `server.use()` của MSW v2 prepend từng handler
    // theo thứ tự tham số, nên tham số đầu được khớp trước.
    server.use(
      http.get(`${BASE}/api/me/mentor-wallet`, () => loi(403, 'SYS_0005')),
      ...duLieuDayDu(),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());
    expect(screen.queryByTestId('o-so-du')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    await doiXong();
  });

  it('dải nhắc việc hiện ĐÚNG số yêu cầu đang chờ, lấy từ totalElements', async () => {
    server.use(...duLieuDayDu({ soDangCho: 7 }));

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('7 yêu cầu đặt lịch đang chờ bạn xác nhận')).toBeTruthy(),
    );
    await doiXong();
  });

  it('bấm dải nhắc việc thì sang tab Booking của mentor', async () => {
    server.use(...duLieuDayDu({ soDangCho: 2 }));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('dai-yeu-cau-dang-cho')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('dai-yeu-cau-dang-cho'));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/mentor-bookings');
    await doiXong();
  });

  it('KHÔNG có yêu cầu nào thì KHÔNG hiện dải nhắc việc', async () => {
    // Một dải nói "0 yêu cầu đang chờ bạn xác nhận" là lời nhắc về việc không
    // tồn tại.
    server.use(...duLieuDayDu({ soDangCho: 0 }));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());

    expect(screen.queryByTestId('dai-yeu-cau-dang-cho')).toBeNull();
    await doiXong();
  });

  it('phép đếm lỗi thì KHÔNG hiện dải nhắc việc (chưa biết, không phải 0)', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        if (p.get('size') === '1') {
          return loi(403, 'SYS_0005');
        }
        return HttpResponse.json(envelope(trang([])));
      }),
      ...duLieuDayDu(),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());

    expect(screen.queryByTestId('dai-yeu-cau-dang-cho')).toBeNull();
    await doiXong();
  });

  it('hiện dải cảnh báo khi mentor đang bị treo quyền nhận booking', async () => {
    // `bookingSuspendedUntil` là `LocalDateTime` (KHÔNG offset) và backend tự áp
    // suspension khi mentor hủy sát giờ. Một mentor đang bị treo mà không được
    // nói gì sẽ thấy "không có booking mới" và kết luận là app hỏng.
    const xa = `${new Date().getUTCFullYear() + 2}-01-01T10:00:00`;
    server.use(...duLieuDayDu({ hoSo: taoHoSoMentor({ bookingSuspendedUntil: xa }) }));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('dai-canh-bao-treo')).toBeTruthy());
    // Mốc được in ra bằng helper của `LocalDateTime`, nên nó phải đọc được —
    // chuỗi có offset sẽ làm `docLocalDateTime()` trả `null` và câu này mất mốc.
    expect(screen.getByTestId('dai-canh-bao-treo')).toHaveTextContent(/01\/01\/\d{4} 10:00/);
    await doiXong();
  });

  it('mốc treo ĐÃ QUA thì không cảnh báo', async () => {
    server.use(
      ...duLieuDayDu({ hoSo: taoHoSoMentor({ bookingSuspendedUntil: '2020-01-01T10:00:00' }) }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());

    expect(screen.queryByTestId('dai-canh-bao-treo')).toBeNull();
    await doiXong();
  });

  it('hiện danh sách "Đặt chỗ sắp tới" và lối Xem tất cả', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('dong-sap-toi-mb1')).toBeTruthy());
    expect(screen.getByText('Nguyễn Thu Hà')).toBeTruthy();
    expect(screen.getByText('Đặt chỗ sắp tới')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('nut-xem-tat-ca-booking'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/mentor-bookings');
    await doiXong();
  });

  it('danh sách sắp tới gọi role=MENTOR', async () => {
    const urlDaGui: string[] = [];
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () =>
        HttpResponse.json(envelope(taoHoSoMentor())),
      ),
      http.get(`${BASE}/api/me/mentor-wallet`, () => HttpResponse.json(envelope(taoViMentor()))),
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        urlDaGui.push(request.url);
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(urlDaGui.length).toBeGreaterThanOrEqual(2));

    expect(urlDaGui.every((url) => url.includes('role=MENTOR'))).toBe(true);
    await doiXong();
  });

  it('chạm dòng "Đặt chỗ sắp tới" mở chi tiết booking của mentor', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('dong-sap-toi-mb1')).toBeTruthy());
    mockPush.mockClear();

    await fireEvent.press(screen.getByTestId('dong-sap-toi-mb1'));

    expect(mockPush).toHaveBeenCalledWith('/mentor-booking/mb1');
    await doiXong();
  });

  it('không có booking nào thì nói thẳng, không để khối trống', async () => {
    server.use(...duLieuDayDu({ sapToi: [] }));

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Chưa có mentee nào đặt lịch với bạn.')).toBeTruthy(),
    );
    await doiXong();
  });

  it('KHÔNG dựng biểu đồ 7 ngày của thiết kế', async () => {
    // TEST CANH. Backend không có endpoint nào trả chuỗi thời gian thu nhập của
    // mentor; `MentorWalletResponse.recentTransactions` là 15 giao dịch GẦN NHẤT
    // nên nó sẽ âm thầm thiếu dữ liệu với mentor nhiều việc — một biểu đồ đúng
    // với người ít việc và sai với người nhiều việc.
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());

    expect(screen.queryByText('Thu nhập — 7 ngày gần nhất')).toBeNull();
    expect(screen.queryByText('Thu nhập')).toBeNull();
    await doiXong();
  });

  it('KHÔNG dựng ô "Booking tuần này" — không có endpoint đếm theo tuần', async () => {
    // TEST CANH. `BookingListRequest` không nhận khoảng ngày, và chế độ dashboard
    // cố định 7 ngày trước → 90 ngày tới. Tự lọc "tuần này" trên một danh sách
    // CÓ PHÂN TRANG sẽ đếm thiếu ngay khi mentor có hơn một trang.
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());

    expect(screen.queryByText('Booking tuần này')).toBeNull();
    await doiXong();
  });

  it('có nút chuông dẫn sang màn Thông báo', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Đánh giá')).toBeTruthy());
    mockPush.mockClear();

    await fireEvent.press(screen.getByTestId('nut-thong-bao'));

    expect(mockPush).toHaveBeenCalledWith('/notifications');
    await doiXong();
  });

  it('KHÔNG có lối nạp tiền nào — mục 4.1 của quy ước', async () => {
    // TEST CANH. Bản mobile là consumption-only, và chính lối nạp là thứ làm app
    // bị gỡ khỏi Google Play.
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Số dư khả dụng')).toBeTruthy());

    expect(screen.queryByText('Nạp')).toBeNull();
    expect(screen.queryByText('Nạp S-coins')).toBeNull();
    expect(screen.queryByText('Thêm S-coins')).toBeNull();
    await doiXong();
  });

  it('KHÔNG có lối rút tiền — payout đang chờ quyết định của chủ sản phẩm', async () => {
    server.use(...duLieuDayDu());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Số dư khả dụng')).toBeTruthy());

    expect(screen.queryByText('Rút tiền')).toBeNull();
    expect(screen.queryByText('Yêu cầu rút')).toBeNull();
    await doiXong();
  });

  it('mất mạng thì nói mất kết nối, KHÔNG in số liệu bịa', async () => {
    onlineManager.setOnline(false);
    try {
      server.use(...duLieuDayDu());

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByTestId('o-so-du')).toBeNull();
      expect(screen.queryByTestId('o-danh-gia')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await doiXong();
  });

  it('hồ sơ lỗi 500 thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () => loi(500, 'SYS_0001')),
      ...duLieuDayDu(),
    );

    await renderScreen();

    // `shouldRetryQuery` thử lại 2 lần với 5xx nên chỗ này phải chờ lâu hơn mặc
    // định của `waitFor`.
    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    await doiXong();
  }, 15_000);
});
