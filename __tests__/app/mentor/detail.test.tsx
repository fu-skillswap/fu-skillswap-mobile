import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorDetailScreen } from '@/features/mentor';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

/**
 * Spy điều hướng dựng BÊN TRONG factory rồi lấy ra qua `requireMock` — xem
 * JSDoc tương ứng ở `__tests__/app/(tabs)/mentors.test.tsx`.
 *
 * `canGoBack` là một `jest.fn()` riêng để từng test đặt được giá trị: luật
 * "`canGoBack() ? back() : replace('/(tabs)')`" chỉ kiểm được khi điều khiển
 * được cả hai nhánh.
 */
jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, replace, push, canGoBack }),
    __mockRouter: { back, replace, push, canGoBack },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock; canGoBack: jest.Mock };
}>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(content: unknown[], { page = 0, size = 10, last = true, total = content.length } = {}) {
  return {
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    last,
  };
}

/** Dịch vụ đúng hình dạng `MentorServiceResponse` */
function dichVu(
  serviceId: string,
  title: string,
  overrides: {
    isFree?: boolean;
    priceScoin?: number | null;
    isActive?: boolean;
    durationMinutes?: number;
  } = {},
) {
  return {
    serviceId,
    mentorUserId: 'm1',
    title,
    description: 'Mô tả dịch vụ.',
    expectedOutcome: 'Kết quả mong đợi.',
    durationMinutes: overrides.durationMinutes ?? 45,
    isFree: overrides.isFree ?? false,
    priceScoin: overrides.priceScoin === undefined ? 150_000 : overrides.priceScoin,
    isActive: overrides.isActive ?? true,
    maintainPostSessionChat: false,
    deliveryMode: 'ONE_TO_ONE',
    coverImageUrl: null,
    version: 1,
    // `LocalDateTime` KHÔNG offset — đúng như backend lên dây.
    createdAt: '2026-04-01T09:00:00',
    updatedAt: '2026-08-11T15:20:00',
  };
}

/**
 * Hồ sơ mentor đúng hình dạng `MentorDiscoveryDetailResponse`.
 *
 * `mentoring.supportLevels` LỒNG (card khai phẳng) và `availability.isAvailable`
 * là `Boolean` đóng hộp (card là `boolean` nguyên thuỷ) — hai chỗ detail lệch
 * card, và cũng là hai chỗ dễ chép sai nhất.
 */
function hoSo(overrides: {
  displayName?: string;
  headline?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  ratingState?: 'RATED' | 'NO_REVIEWS';
  ratingAverage?: number | null;
  reviewCount?: number;
  completedSessions?: number;
  services?: unknown[];
  supportLevels?: { foundation: number | null; outputReview: number | null; direction: number | null };
  semester?: number | null;
  alumni?: boolean | null;
  canRequestBooking?: boolean;
} = {}) {
  return {
    identity: {
      mentorUserId: 'm1',
      displayName: overrides.displayName ?? 'Trần Minh Quân',
      avatarUrl: null,
      headline: overrides.headline === undefined ? 'Backend Developer · Spring Boot' : overrides.headline,
      isVerified: overrides.isVerified ?? true,
      verifiedAt: '2026-05-02T08:30:00',
    },
    mentoring: {
      bio: overrides.bio === undefined ? 'Mình làm backend ba năm, chủ yếu Spring Boot.' : overrides.bio,
      expertiseDescription: 'Spring Boot, REST API và thiết kế cơ sở dữ liệu',
      supportLevels:
        overrides.supportLevels ?? { foundation: 3, outputReview: 4, direction: 2 },
    },
    services: overrides.services ?? [dichVu('sv1', 'Review CV 1:1')],
    evidence: {
      education: {
        campusId: 'c1',
        campusName: 'FPT University Hà Nội',
        programId: 'p1',
        programName: 'Công nghệ thông tin',
        specializationId: 's1',
        specializationName: 'Kỹ thuật phần mềm',
        semester: overrides.semester === undefined ? 7 : overrides.semester,
        alumni: overrides.alumni === undefined ? false : overrides.alumni,
      },
      subjectResults: [],
      featuredProjects: [],
      achievements: [],
      portfolioUrl: null,
      githubUrl: null,
      authorityContent: {
        publishedArticleCount: 0,
        latestPublishedAt: null,
        recentPublicArticles: [],
      },
    },
    reputation: {
      ratingState: overrides.ratingState ?? 'RATED',
      ratingAverage: overrides.ratingAverage === undefined ? 4.8 : overrides.ratingAverage,
      reviewCount: overrides.reviewCount ?? 13,
      completedSessions: overrides.completedSessions ?? 41,
    },
    availability: {
      isAvailable: true,
      suspendedUntil: null,
      canRequestBooking: overrides.canRequestBooking ?? true,
    },
  };
}

function danhGia(reviewId: string, ten: string, rating: number, comment: string | null, createdAt: string) {
  return {
    reviewId,
    reviewerUserId: `u-${reviewId}`,
    reviewerDisplayName: ten,
    reviewerAvatarUrl: null,
    rating,
    comment,
    createdAt,
  };
}

const hoSoOk = (data: unknown) =>
  http.get(`${BASE}/api/mentors/m1`, () => HttpResponse.json(envelope(data)));
const danhGiaOk = (items: unknown[], opts?: Parameters<typeof trang>[1]) =>
  http.get(`${BASE}/api/mentors/m1/reviews`, () => HttpResponse.json(envelope(trang(items, opts))));

const loi500 = (path: string) =>
  http.get(`${BASE}${path}`, () =>
    HttpResponse.json(
      { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
      { status: 500 },
    ),
  );

const server = setupServer();

let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  mockRouter.canGoBack.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

async function renderScreen(mentorUserId = 'm1') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorDetailScreen mentorUserId={mentorUserId} />
    </QueryClientProvider>,
  );
}

describe('MentorDetailScreen', () => {
  it('hiện tên, headline, bio, ba mức hỗ trợ và học vấn ở tab Giới thiệu', async () => {
    server.use(hoSoOk(hoSo()), danhGiaOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(screen.getByText('Backend Developer · Spring Boot')).toBeTruthy();
    expect(screen.getByText(/Mình làm backend ba năm/)).toBeTruthy();
    // `supportLevels` LỒNG ở detail; đọc trượt sang bản phẳng của card ra
    // `undefined` và cả ba nhãn biến mất mà không có lỗi kiểu nào chặn.
    expect(screen.getByText('Nền tảng 3/4')).toBeTruthy();
    expect(screen.getByText('Review bài 4/4')).toBeTruthy();
    expect(screen.getByText('Định hướng 2/4')).toBeTruthy();
    expect(screen.getByText('FPT University Hà Nội')).toBeTruthy();
    expect(screen.getByText('Kỳ 7')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('ba ô chỉ số hiện điểm, số lượt review và số buổi đã dạy', async () => {
    server.use(hoSoOk(hoSo({ reviewCount: 13, completedSessions: 41 })), danhGiaOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('o-diem-danh-gia')).toBeTruthy());
    expect(within(screen.getByTestId('o-diem-danh-gia')).getByText('4.8')).toBeTruthy();
    expect(within(screen.getByTestId('o-luot-review')).getByText('13')).toBeTruthy();
    expect(within(screen.getByTestId('o-buoi-da-day')).getByText('41')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('CHƯA có đánh giá thì KHÔNG hiện số sao nào, kể cả ở ô chỉ số', async () => {
    // Luật của `mentor-discovery.md` §2. Ô "Đánh giá" là chỗ dễ lọt nhất: nó nằm
    // ngoài `MentorCard` nên test của component không che được nó.
    server.use(
      hoSoOk(
        hoSo({
          ratingState: 'NO_REVIEWS',
          ratingAverage: null,
          reviewCount: 0,
          completedSessions: 0,
        }),
      ),
      danhGiaOk([]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('o-diem-danh-gia')).toBeTruthy());
    expect(within(screen.getByTestId('o-diem-danh-gia')).getByText('Chưa có đánh giá')).toBeTruthy();
    expect(screen.queryByTestId('diem-danh-gia-diem')).toBeNull();
    expect(screen.queryByText('5.0')).toBeNull();
    expect(screen.queryByText('0.0')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('bio null và headline null thì bỏ hẳn hai khối, không để dòng trống', async () => {
    server.use(hoSoOk(hoSo({ bio: null, headline: null })), danhGiaOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(screen.queryByText(/Mình làm backend/)).toBeNull();
    expect(screen.queryByText('Backend Developer · Spring Boot')).toBeNull();
    // Chuyên môn vẫn còn, nên tab Giới thiệu không rỗng ruột.
    expect(screen.getByText(/Spring Boot, REST API/)).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('tab Dịch vụ hiện thời lượng và giá, dịch vụ miễn phí hiện "Miễn phí"', async () => {
    server.use(
      hoSoOk(
        hoSo({
          services: [
            dichVu('sv1', 'Review CV 1:1', { priceScoin: 150_000, durationMinutes: 45 }),
            dichVu('sv2', 'Buổi làm quen', { isFree: true, priceScoin: null, durationMinutes: 20 }),
          ],
        }),
      ),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-dich-vu'));

    expect(screen.getByText('Review CV 1:1')).toBeTruthy();
    expect(screen.getByText('45 phút · 1:1')).toBeTruthy();
    expect(screen.getByTestId('gia-sv1').props.children).toBe('150.000');
    // "0 S-COINS" cho một buổi miễn phí khiến người dùng tưởng giá tính sai.
    expect(screen.getByTestId('gia-sv2').props.children).toBe('Miễn phí');
    await donHangDoiDanhSach();
  });

  it('dịch vụ đã ĐÓNG (isActive=false) KHÔNG được hiện', async () => {
    // Mentor đã đóng một dịch vụ mà vẫn hiện ra là mời người dùng vào một thứ
    // không đặt được.
    server.use(
      hoSoOk(
        hoSo({
          services: [
            dichVu('sv1', 'Review CV 1:1'),
            dichVu('sv3', 'Mock interview đã đóng', { isActive: false }),
          ],
        }),
      ),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-dich-vu'));

    expect(screen.getByTestId('dich-vu-sv1')).toBeTruthy();
    expect(screen.queryByTestId('dich-vu-sv3')).toBeNull();
    expect(screen.queryByText('Mock interview đã đóng')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('mentor chưa mở dịch vụ nào thì nói thẳng, không để tab trống', async () => {
    server.use(hoSoOk(hoSo({ services: [] })), danhGiaOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-dich-vu'));

    expect(screen.getByTestId('chua-mo-dich-vu')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('CTA "Đặt lịch" ở thanh dưới mang giá dịch vụ đầu tiên và mở bước chọn lịch', async () => {
    server.use(
      hoSoOk(hoSo({ services: [dichVu('sv1', 'Review CV 1:1'), dichVu('sv2', 'Mock interview')] })),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-dat-lich')).toBeTruthy());

    expect(screen.getByText('Đặt lịch · 150.000 S-coins')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nut-dat-lich'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/[mentorUserId]',
      params: { mentorUserId: 'm1', serviceId: 'sv1' },
    });
    await donHangDoiDanhSach();
  });

  it('chạm vào một thẻ dịch vụ thì mở bước chọn lịch với ĐÚNG dịch vụ đó', async () => {
    server.use(
      hoSoOk(hoSo({ services: [dichVu('sv1', 'Review CV 1:1'), dichVu('sv2', 'Mock interview')] })),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('tab-ho-so-dich-vu'));
    await fireEvent.press(screen.getByLabelText('Đặt lịch Mock interview'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/[mentorUserId]',
      params: { mentorUserId: 'm1', serviceId: 'sv2' },
    });
    await donHangDoiDanhSach();
  });

  it('mentor tạm ngưng nhận lịch thì KHÔNG có nút đặt lịch nào và nói rõ lý do', async () => {
    server.use(
      hoSoOk(hoSo({ canRequestBooking: false, services: [dichVu('sv1', 'Review CV 1:1')] })),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('tab-ho-so-dich-vu'));

    expect(screen.queryByTestId('nut-dat-lich')).toBeNull();
    expect(screen.queryByLabelText('Đặt lịch Review CV 1:1')).toBeNull();
    expect(screen.getByTestId('tam-ngung-nhan-lich')).toBeTruthy();
    // Không có endpoint lưu mentor, không có URL công khai để chia sẻ.
    expect(screen.queryByLabelText('Lưu mentor')).toBeNull();
    expect(screen.queryByLabelText('Chia sẻ')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('tab Đánh giá hiện danh sách đánh giá kèm ngày KHÔNG lệch múi giờ', async () => {
    server.use(
      hoSoOk(hoSo()),
      danhGiaOk([
        // Mốc sát nửa đêm: `new Date()` đọc chuỗi không offset thành giờ địa
        // phương, nên một bản cài đặt qua `Date` sẽ in ra 29/09 ở múi giờ âm.
        danhGia('rv1', 'Ngô Bảo Châu', 5, 'Anh chỉ rất sát.', '2026-09-28T23:30:00'),
        danhGia('rv2', 'Đinh Khánh Linh', 4, null, '2026-09-27T10:00:00'),
      ]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-danh-gia'));

    await waitFor(() => expect(screen.getByTestId('danh-gia-rv1')).toBeTruthy());
    expect(within(screen.getByTestId('danh-gia-rv1')).getByText('28/09/2026')).toBeTruthy();
    expect(screen.getByText('Anh chỉ rất sát.')).toBeTruthy();
    // Đánh giá không có nhận xét vẫn hiện người và số sao.
    expect(within(screen.getByTestId('danh-gia-rv2')).getByText('4/5')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('đánh giá chỉ là dữ liệu của danh sách khi tab Đánh giá đang mở', async () => {
    // Để nguyên `data` ở hai tab kia thì các đánh giá render ngay dưới phần nội
    // dung tab đang xem — hai nội dung khác nhau dính vào nhau trên một màn.
    server.use(
      hoSoOk(hoSo()),
      danhGiaOk([danhGia('rv1', 'Ngô Bảo Châu', 5, 'Anh chỉ rất sát.', '2026-09-28T10:00:00')]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    // Tab mặc định là Giới thiệu.
    expect(screen.queryByTestId('danh-gia-rv1')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-ho-so-danh-gia'));
    await waitFor(() => expect(screen.getByTestId('danh-gia-rv1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-gioi-thieu'));
    expect(screen.queryByTestId('danh-gia-rv1')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('mentor chưa có đánh giá thì tab Đánh giá nói rỗng, không báo lỗi', async () => {
    server.use(
      hoSoOk(hoSo({ ratingState: 'NO_REVIEWS', ratingAverage: null, reviewCount: 0 })),
      danhGiaOk([]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tab-ho-so-danh-gia'));

    // Khẳng định theo DÒNG MÔ TẢ của EmptyState, không theo tiêu đề "Chưa có
    // đánh giá": ô chỉ số của mentor `NO_REVIEWS` cũng mang đúng chữ đó, nên
    // `getByText` sẽ ném vì khớp hai node và test đỏ vì một lý do sai.
    await waitFor(() =>
      expect(screen.getByText('Mentor này chưa nhận được đánh giá nào.')).toBeTruthy(),
    );
    expect(screen.queryByText('Thử lại')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('cuộn tới cuối danh sách đánh giá thì tải trang kế, và KHÔNG gọi trùng', async () => {
    // Chốt chặn đồng bộ nằm trong `useMentorReviews` (`useChotChanTrangKe`); màn
    // hình chỉ nối `taiTrangKe()` vào `onEndReached`, không dựng lại `useRef`.
    const pageDaGui: (string | null)[] = [];
    server.use(
      hoSoOk(hoSo()),
      http.get(`${BASE}/api/mentors/m1/reviews`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pageDaGui.push(page);
        if (page === '0') {
          return HttpResponse.json(
            envelope(
              trang([danhGia('rv1', 'Ngô Bảo Châu', 5, 'Trang một.', '2026-09-28T10:00:00')], {
                size: 1,
                last: false,
                total: 2,
              }),
            ),
          );
        }
        // Chậm có chủ ý: giữ `isFetchingNextPage` bật đủ lâu để lần bắn thứ hai
        // rơi vào đúng lúc guard phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(
          envelope(
            trang([danhGia('rv2', 'Đinh Khánh Linh', 4, 'Trang hai.', '2026-09-27T10:00:00')], {
              page: 1,
              size: 1,
              total: 2,
            }),
          ),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('tab-ho-so')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('tab-ho-so-danh-gia'));
    await waitFor(() => expect(screen.getByText('Trang một.')).toBeTruthy());

    const onEndReached = screen.getByTestId('danh-sach-danh-gia').props.onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('Trang hai.')).toBeTruthy());
    expect(pageDaGui).toEqual(['0', '1']);
    await donHangDoiDanhSach();
  });

  it('hồ sơ lỗi 500 thì hiện ErrorView, và nút quay lại VẪN còn', async () => {
    // Lúc lỗi mới là lúc người dùng cần đường ra nhất, mà đó đúng là lúc card hồ
    // sơ (chỗ thiết kế đặt nút back) không được render.
    server.use(loi500('/api/mentors/m1'), danhGiaOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByTestId('nut-quay-lai')).toBeTruthy();
    await donHangDoiDanhSach();
  }, 15_000);

  it('hồ sơ 404 thì hiện lỗi chứ KHÔNG để màn trắng', async () => {
    // `MentorDiscoveryService.java:423` ném `ErrorCode.NOT_FOUND` = `SYS_0003`
    // cho mentor không tồn tại hoặc đã ngừng công khai.
    server.use(
      http.get(`${BASE}/api/mentors/m1`, () =>
        HttpResponse.json(
          { timestamp: '', status: 404, code: 'SYS_0003', message: 'Không tìm thấy mentor', data: null },
          { status: 404 },
        ),
      ),
      danhGiaOk([]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('man-hinh-ho-so-mentor')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('tab-ho-so')).toBeNull());
    expect(screen.getByTestId('nut-quay-lai')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('MẤT MẠNG thì nói mất kết nối, KHÔNG nói mentor chưa mở dịch vụ nào', async () => {
    onlineManager.setOnline(false);
    try {
      server.use(hoSoOk(hoSo()), danhGiaOk([]));

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByTestId('chua-mo-dich-vu')).toBeNull();
      expect(screen.queryByText('Mentor này chưa nhận được đánh giá nào.')).toBeNull();
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('bấm quay lại khi còn stack thì back(), KHÔNG replace', async () => {
    server.use(hoSoOk(hoSo()), danhGiaOk([]));
    mockRouter.canGoBack.mockReturnValue(true);

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-quay-lai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('bấm quay lại khi stack RỖNG (deep link) thì replace về (tabs)', async () => {
    // `skillswap://mentor/m1` mở app từ trạng thái nguội thì stack rỗng và
    // `back()` là no-op: người dùng bấm quay lại rồi ngồi nhìn đúng màn cũ.
    server.use(hoSoOk(hoSo()), danhGiaOk([]));
    mockRouter.canGoBack.mockReturnValue(false);

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-quay-lai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    expect(mockRouter.back).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('mentorUserId rỗng thì KHÔNG gửi request nào — tránh GET /api/mentors/ cụt', async () => {
    // Route có thể render một nhịp trước khi có tham số. `enabled` của `useMentor`
    // và `useMentorReviews` chặn chuyện đó; không có chốt thì một request vào
    // đường dẫn cụt rời máy và `onUnhandledRequest: 'error'` làm test này đỏ.
    await renderScreen('');

    expect(screen.getByTestId('man-hinh-ho-so-mentor')).toBeTruthy();
    await donHangDoiDanhSach();
  });
});
