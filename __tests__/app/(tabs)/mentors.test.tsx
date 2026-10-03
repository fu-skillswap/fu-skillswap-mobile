import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorDiscoveryScreen } from '@/features/mentor';
import { DO_TRE_TIM_KIEM_MS } from '@/features/mentor/screens/MentorDiscoveryScreen';
import { donHangDoiDanhSach, nhuongChoDebounce } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock`.
 *
 * `useRouter: () => ({ push: jest.fn() })` tạo một hàm giả MỚI mỗi lần component
 * gọi `useRouter()`, nên không có spy nào giữ lại được để assert — việc điều
 * hướng trở thành không thể kiểm. Và không thể tham chiếu một `const` ngoài
 * factory: Jest hoist `jest.mock` lên trên mọi khai báo.
 */
jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }), __mockPush: push };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

const { __mockPush: mockPush } = jest.requireMock<{ __mockPush: jest.Mock }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(content: unknown[], { page = 0, size = 12, last = true, total = content.length } = {}) {
  return {
    content,
    page,
    size,
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    last,
  };
}

/**
 * Thẻ mentor đúng hình dạng DTO thật: mọi trường nằm trong section LỒNG.
 *
 * Bản phẳng `mentorUserId`/`displayName`/`ratingState`/`matchScore` bị
 * `@JsonIgnore` nên KHÔNG có trong JSON — một fixture viết phẳng sẽ làm test xanh
 * trên một hình dạng backend không bao giờ trả.
 */
function mentor(
  mentorUserId: string,
  displayName: string,
  overrides: {
    headline?: string | null;
    ratingState?: 'RATED' | 'NO_REVIEWS';
    ratingAverage?: number | null;
    reviewCount?: number;
    score?: number | null;
  } = {},
) {
  return {
    identity: {
      mentorUserId,
      displayName,
      avatarUrl: null,
      headline: overrides.headline ?? 'Backend engineer, Spring Boot',
      isVerified: true,
      verifiedAt: '2026-05-01T09:00:00',
    },
    mentoring: {
      expertiseDescription: 'Spring Boot, SQL',
      foundationSupportLevel: 3,
      outputReviewSupportLevel: 3,
      directionSupportLevel: 2,
    },
    evidence: {
      campusId: 'c1',
      campusName: 'FPT University Hà Nội',
      programId: 'p1',
      programName: 'Công nghệ thông tin',
      specializationId: 's1',
      specializationName: 'Kỹ thuật phần mềm',
      subjectHighlights: [],
      featuredProjects: [],
      achievements: [],
    },
    reputation: {
      ratingState: overrides.ratingState ?? 'RATED',
      ratingAverage: overrides.ratingAverage === undefined ? 4.6 : overrides.ratingAverage,
      reviewCount: overrides.reviewCount ?? 12,
      completedSessions: 30,
    },
    availability: { isAvailable: true },
    match: { score: overrides.score === undefined ? 95.5 : overrides.score },
  };
}

const QUAN = mentor('m1', 'Trần Minh Quân');
const HA = mentor('m2', 'Lê Thu Hà');

/** Handler gợi ý dùng lại ở mọi test — màn hình luôn gọi nó khi mở. */
const goiYOk = (items: { mentor: unknown; matchScore: number | null; matchReasons: string[] }[]) =>
  http.get(`${BASE}/api/mentors/recommendations`, () => HttpResponse.json(envelope(items)));

const server = setupServer();

/**
 * Một QueryClient cho mỗi test, KHÔNG phải mỗi lần gọi renderScreen: mỗi client
 * bỏ lại bộ hẹn giờ `gcTime` giữ event loop sống và Jest báo "A worker process
 * has failed to exit gracefully".
 */
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
      <MentorDiscoveryScreen />
    </QueryClientProvider>,
  );
}

describe('MentorDiscoveryScreen', () => {
  it('chưa tìm gì thì hiện danh sách GỢI Ý kèm lý do, KHÔNG gọi /api/mentors', async () => {
    // Gợi ý và tìm kiếm là hai endpoint khác nhau. Gọi cả hai lúc mở tab là một
    // request lãng phí mỗi lần mở, và `enabled` của `useMentorSearch` tồn tại
    // đúng để chặn điều đó.
    let soLanGoiTimKiem = 0;
    server.use(
      goiYOk([
        { mentor: QUAN, matchScore: 95.5, matchReasons: ['Cùng chuyên ngành Kỹ thuật phần mềm'] },
      ]),
      http.get(`${BASE}/api/mentors`, () => {
        soLanGoiTimKiem += 1;
        return HttpResponse.json(envelope(trang([])));
      }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(screen.getByText('Cùng chuyên ngành Kỹ thuật phần mềm')).toBeTruthy();
    expect(screen.getByText('1 mentor gợi ý cho bạn')).toBeTruthy();
    expect(soLanGoiTimKiem).toBe(0);
    await donHangDoiDanhSach();
  });

  it('gõ từ khoá thì chuyển sang /api/mentors và CHỈ gửi giá trị cuối', async () => {
    // Không debounce thì mỗi phím gõ là một query key mới: "spring" = 6 request
    // và 6 entry cache sống hết gcTime, kèm một lần nháy spinner sau mỗi ký tự.
    const tuKhoaDaGui: string[] = [];
    server.use(
      goiYOk([{ mentor: QUAN, matchScore: 95.5, matchReasons: ['Cùng chuyên ngành'] }]),
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        tuKhoaDaGui.push(new URL(request.url).searchParams.get('keyword') ?? '');
        return HttpResponse.json(envelope(trang([mentor('m9', 'Kết quả tìm kiếm')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    const o = screen.getByLabelText('Tìm mentor');
    await fireEvent.changeText(o, 's');
    await fireEvent.changeText(o, 'sp');
    await fireEvent.changeText(o, 'spring');
    // Hạn debounce phải tới khi còn ở TRONG act; để nó rơi vào khe giữa thân test
    // và afterEach gỡ cây thì React in cảnh báo act() — xem `nhuongChoDebounce`.
    await nhuongChoDebounce(DO_TRE_TIM_KIEM_MS);

    await waitFor(() => expect(screen.getByText('Kết quả tìm kiếm')).toBeTruthy(), {
      timeout: 3_000,
    });
    expect(tuKhoaDaGui).toEqual(['spring']);
    await donHangDoiDanhSach();
  });

  it('dòng đếm dùng totalElements của backend, không phải số thẻ đang có trong tay', async () => {
    // Mới tải một trang 2 thẻ mà ghi "2 mentor phù hợp" là nói sai về số kết quả.
    server.use(
      goiYOk([]),
      http.get(`${BASE}/api/mentors`, () =>
        HttpResponse.json(envelope(trang([QUAN, HA], { size: 2, last: false, total: 37 }))),
      ),
    );

    await renderScreen();
    const o = screen.getByLabelText('Tìm mentor');
    await fireEvent.changeText(o, 'spring');
    await nhuongChoDebounce(DO_TRE_TIM_KIEM_MS);

    await waitFor(() => expect(screen.getByText('37 mentor phù hợp')).toBeTruthy(), {
      timeout: 3_000,
    });
    await donHangDoiDanhSach();
  });

  it('bấm chip sắp xếp thì gửi sortBy lên /api/mentors, không còn dùng gợi ý', async () => {
    // Chip "Gợi ý cho bạn" là chip mặc định và KHÔNG gọi `/api/mentors`; mọi chip
    // khác phải thật sự đổi tham số, nếu không hàng chip chỉ là trang trí.
    const sortDaGui: (string | null)[] = [];
    server.use(
      goiYOk([{ mentor: QUAN, matchScore: 95.5, matchReasons: ['Cùng chuyên ngành'] }]),
      http.get(`${BASE}/api/mentors`, ({ request }) => {
        sortDaGui.push(new URL(request.url).searchParams.get('sortBy'));
        return HttpResponse.json(envelope(trang([mentor('m8', 'Mentor điểm cao')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('sap-xep-ratingAverage'));

    await waitFor(() => expect(screen.getByText('Mentor điểm cao')).toBeTruthy());
    expect(sortDaGui).toEqual(['ratingAverage']);
    await donHangDoiDanhSach();
  });

  it('kết quả tìm kiếm KHÔNG mang lý do gợi ý sang', async () => {
    // Dán lý do của `/recommendations` lên kết quả tìm kiếm là gán cho backend
    // một lời giải thích nó không đưa ra — và lý do đó nói về ngành học, không
    // nói gì về từ khoá người dùng vừa gõ.
    server.use(
      goiYOk([{ mentor: QUAN, matchScore: 95.5, matchReasons: ['Cùng chuyên ngành của bạn'] }]),
      http.get(`${BASE}/api/mentors`, () => HttpResponse.json(envelope(trang([QUAN])))),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Cùng chuyên ngành của bạn')).toBeTruthy());

    const o = screen.getByLabelText('Tìm mentor');
    await fireEvent.changeText(o, 'quân');
    await nhuongChoDebounce(DO_TRE_TIM_KIEM_MS);

    /*
      Chờ theo DÒNG ĐẾM, không chờ theo `ly-do-goi-y` biến mất: trong lúc truy
      vấn tìm kiếm còn đang tải, màn hình hiện spinner nên danh sách không được
      render và `ly-do-goi-y` vắng mặt vì một lý do hoàn toàn khác. Chờ như vậy
      thì test xanh ngay cả với một màn hình vẫn dán lý do lên kết quả tìm kiếm.
      "mentor phù hợp" là chữ CHỈ xuất hiện ở chế độ tìm kiếm và chỉ khi đã có dữ
      liệu.
    */
    await waitFor(() => expect(screen.getByText('1 mentor phù hợp')).toBeTruthy(), {
      timeout: 3_000,
    });
    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    expect(screen.queryByTestId('ly-do-goi-y')).toBeNull();
    expect(screen.queryByText('Cùng chuyên ngành của bạn')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('mentor CHƯA có đánh giá thì KHÔNG hiện số sao nào trên danh sách', async () => {
    // Luật quan trọng nhất của nhánh này, kiểm ở mức màn hình chứ không chỉ ở
    // component: một màn hình tự dựng lại khối điểm sẽ vượt qua được
    // `MentorCard.test.tsx` mà vẫn nói dối người dùng.
    server.use(
      goiYOk([
        {
          mentor: mentor('m3', 'Phạm Gia Bảo', {
            ratingState: 'NO_REVIEWS',
            ratingAverage: null,
            reviewCount: 0,
          }),
          matchScore: null,
          matchReasons: [],
        },
      ]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Phạm Gia Bảo')).toBeTruthy());
    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
    expect(screen.queryByTestId('diem-danh-gia-diem')).toBeNull();
    expect(screen.queryByText('5.0')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('match.score null vẫn render đủ thẻ — danh sách không phụ thuộc điểm khớp', async () => {
    server.use(
      goiYOk([
        { mentor: mentor('m4', 'Vũ Khánh Linh', { score: null }), matchScore: null, matchReasons: [] },
      ]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Vũ Khánh Linh')).toBeTruthy());
    expect(screen.getByTestId('the-mentor-m4')).toBeTruthy();
    expect(screen.getByTestId('tinh-trang-nhan-hoc')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('cuộn tới cuối kết quả tìm kiếm thì tải trang kế, và KHÔNG gọi trùng', async () => {
    // Chốt chặn đồng bộ nằm trong `useMentorSearch` (`useChotChanTrangKe`). Hai
    // lần bắn trong CÙNG một tick là điều FlatList thật sự làm khi người dùng
    // quăng nhanh tới cuối, và là tình huống duy nhất mà guard theo state render
    // không chặn nổi.
    const pageDaGui: (string | null)[] = [];
    server.use(
      goiYOk([]),
      http.get(`${BASE}/api/mentors`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pageDaGui.push(page);
        if (page === '0') {
          return HttpResponse.json(envelope(trang([QUAN], { size: 1, last: false, total: 2 })));
        }
        // Chậm có chủ ý: giữ `isFetchingNextPage` bật đủ lâu để lần bắn thứ hai
        // rơi vào đúng lúc guard phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(
          envelope(trang([mentor('m7', 'Mentor trang hai')], { page: 1, size: 1, total: 2 })),
        );
      }),
    );

    await renderScreen();
    const o = screen.getByLabelText('Tìm mentor');
    await fireEvent.changeText(o, 'spring');
    await nhuongChoDebounce(DO_TRE_TIM_KIEM_MS);
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy(), {
      timeout: 3_000,
    });

    const onEndReached = screen.getByTestId('danh-sach-mentor').props.onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('Mentor trang hai')).toBeTruthy());
    expect(pageDaGui).toEqual(['0', '1']);
    await donHangDoiDanhSach();
  });

  it('gợi ý rỗng thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(goiYOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có gợi ý nào')).toBeTruthy());
    expect(screen.queryByText('Thử lại')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('gợi ý lỗi 500 thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/mentors/recommendations`, () =>
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

  it('MẤT MẠNG lúc mở tab thì nói mất kết nối, KHÔNG nói chưa có gợi ý nào', async () => {
    // `isLoading` KHÔNG bật khi mất mạng: với networkMode 'online' (mặc định),
    // query ở status 'pending' + fetchStatus 'paused', mà
    // `isLoading = isPending && isFetching` nên nó là false. Màn hình chỉ hỏi
    // `isLoading` sẽ rơi xuống nhánh rỗng và báo "Chưa có gợi ý nào" trong khi
    // chưa hề gọi được API.
    onlineManager.setOnline(false);
    try {
      server.use(goiYOk([]));

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByText('Chưa có gợi ý nào')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('bấm một mentor thì điều hướng sang hồ sơ của ĐÚNG mentor đó', async () => {
    server.use(
      goiYOk([
        { mentor: QUAN, matchScore: 95.5, matchReasons: [] },
        { mentor: HA, matchScore: 88, matchReasons: [] },
      ]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Lê Thu Hà')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Xem hồ sơ Lê Thu Hà'));

    expect(mockPush).toHaveBeenCalledWith('/mentor/m2');
    await donHangDoiDanhSach();
  });

  it('KHÔNG có nút đặt lịch nào trên tab tìm mentor ở giai đoạn này', async () => {
    // Màn `Booking` chưa dựng; thiết kế có nút gradient "Đặt lịch" ở chân mỗi
    // thẻ. Xoá test này khi luồng đặt lịch có thật.
    server.use(goiYOk([{ mentor: QUAN, matchScore: 95.5, matchReasons: [] }]));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText(/Đặt lịch/)).toBeNull();
    await donHangDoiDanhSach();
  });
});
