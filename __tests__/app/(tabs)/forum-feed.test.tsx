import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { ForumFeedScreen } from '@/features/forum';

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
/**
 * Màn hình này KHÔNG dùng phiên đăng nhập, nhưng nó được lấy qua barrel
 * `@/features/forum` — barrel kéo theo `PostDetailScreen`, file đó import
 * `@/core/auth/AuthProvider`, và AuthProvider import `@react-native-google-signin`
 * vốn gọi `TurboModuleRegistry.getEnforcing` ngay lúc nạp module: không có
 * native module trong Jest nên test nổ ngay ở bước import.
 *
 * Mock giữ đúng hình dạng thật của `AuthContextValue`; `user: null` là khách
 * vãng lai, đủ cho mọi test trong file này.
 */
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  }),
}));



const { __mockPush: mockPush } = jest.requireMock<{ __mockPush: jest.Mock }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function cursorPage(items: unknown[], nextCursor: string | null = null) {
  return {
    items,
    nextCursor,
    prevCursor: null,
    hasNext: nextCursor !== null,
    hasPrev: false,
    limit: 20,
  };
}

function post(postId: string, title: string) {
  return {
    postId,
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorProgram: null,
    forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
    title,
    content: 'Nội dung',
    status: 'PUBLISHED',
    commentCount: 0,
    reactionCount: 0,
    reportCount: 0,
    lastActivityAt: '2026-09-22T00:00:00Z',
    reactedByCurrentUser: false,
    myReactionType: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
  };
}

const POST = post('p1', 'Học Spring Boot từ đâu?');
const TOPIC = { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 };

/** Handler chủ đề dùng lại ở mọi test — màn hình luôn gọi nó khi mở. */
const topicsOk = (topics: unknown[] = []) =>
  http.get(`${BASE}/api/forum/topics`, () => HttpResponse.json(envelope(topics)));

const server = setupServer();

/**
 * Một QueryClient cho mỗi test, KHÔNG phải mỗi lần gọi renderScreen.
 *
 * Đặt `createQueryClient()` ngay trong lời gọi render sẽ dựng client mới mỗi
 * lần, và mỗi client bỏ lại bộ hẹn giờ `gcTime` giữ event loop sống — Jest báo
 * "A worker process has failed to exit gracefully".
 */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockPush.mockClear();
});
afterEach(() => {
  // `clear()` một mình bỏ sót bộ hẹn giờ gcTime của mutation và Jest treo sau
  // khi test xong — xem JSDoc của `__resetQueryClientForTests`.
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/**
 * Để FlatList dọn xong hàng đợi của nó TRƯỚC khi test kết thúc.
 *
 * `VirtualizedList` gom việc render ô vào `_updateCellsToRenderBatcher`, một bộ
 * hẹn giờ ~50ms. Nếu test kết thúc trước khi nó nổ, React cập nhật ngoài phạm vi
 * act và in "An update to VirtualizedList inside a test was not wrapped in
 * act(...)". Cảnh báo này CHẬP CHỜN — chạy 6 lần chỉ bẩn 1–2 lần — nên rất dễ
 * bị kết luận nhầm là đã hết chỉ vì lần chạy gần nhất sạch.
 */
/**
 * Nhường một nhịp cho `VirtualizedList` dọn hàng đợi của nó, gọi ở CUỐI mỗi test
 * có render danh sách.
 *
 * FlatList gom việc render ô vào `_updateCellsToRenderBatcher` — một bộ hẹn giờ
 * ~50ms. Nếu nó nổ trong khoảng giữa lúc thân test kết thúc và lúc RNTL gỡ cây,
 * React cập nhật ngoài phạm vi act và in cảnh báo; chạy 6 lần mới bẩn 1 lần nên
 * rất dễ bị kết luận nhầm là đã hết.
 *
 * Phải gọi trong THÂN test chứ không đặt được vào `afterEach`: auto-cleanup của
 * RNTL đăng ký `afterEach` ngay lúc import và jest-circus chạy hook theo đúng
 * thứ tự khai báo, nên nó luôn gỡ cây trước mọi `afterEach` viết ở đây (kiểm
 * chứng: gọi `screen.unmount()` trong afterEach ném "`render` function has not
 * been called").
 */
async function donHangDoiDanhSach() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}


/**
 * `render` của @testing-library/react-native@14 là HÀM ASYNC — phải await.
 * Gọi mà không await sẽ để lần render đầu ra ngoài phạm vi act(), khiến React
 * cảnh báo "An update to ForumFeedScreen inside a test was not wrapped in act(...)".
 */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ForumFeedScreen />
    </QueryClientProvider>,
  );
}

describe('ForumFeedScreen', () => {
  it('hiện danh sách bài viết lấy từ newsfeed', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('feed rỗng thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bài viết nào')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('feed lỗi 500 ngay từ đầu thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () =>
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
  });

  it('tải lại HỎNG khi đã có dữ liệu thì GIỮ NGUYÊN danh sách, chỉ báo nhẹ', async () => {
    // `isError` của TanStack v5 bật cả khi query đã có data và chỉ lần refetch
    // nền thất bại. Nếu màn hình chỉ nhìn `isError` để quyết định hiện ErrorView
    // toàn màn hình, một lần kéo-để-tải-lại hụt sóng sẽ xoá sạch feed người dùng
    // đang đọc — trong khi dữ liệu cũ vẫn nằm nguyên trong cache. Spec §6 nói rõ
    // dữ liệu đã tải phải xem được tiếp.
    let lanGoi = 0;
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => {
        lanGoi += 1;
        if (lanGoi === 1) return HttpResponse.json(envelope(cursorPage([POST])));
        return HttpResponse.json(
          { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
          { status: 500 },
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent(screen.getByTestId('danh-sach-bai-viet'), 'refresh');

    await waitFor(() => expect(screen.getByTestId('loi-tai-lai-nen')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('gõ từ khoá thì chuyển sang /api/forum/posts và CHỈ gửi giá trị cuối', async () => {
    // Không debounce thì mỗi phím gõ là một query key mới: "spring" = 6 request
    // và 6 entry cache sống hết gcTime, kèm một lần nháy spinner toàn màn hình
    // sau mỗi ký tự.
    const tuKhoaDaGui: string[] = [];
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
      http.get(`${BASE}/api/forum/posts`, ({ request }) => {
        tuKhoaDaGui.push(new URL(request.url).searchParams.get('keyword') ?? '');
        return HttpResponse.json(envelope(cursorPage([post('p2', 'Kết quả tìm kiếm')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    const o = screen.getByLabelText('Tìm kiếm bài viết');
    await fireEvent.changeText(o, 's');
    await fireEvent.changeText(o, 'sp');
    await fireEvent.changeText(o, 'spring');

    await waitFor(() => expect(screen.getByText('Kết quả tìm kiếm')).toBeTruthy(), {
      timeout: 3_000,
    });
    expect(tuKhoaDaGui).toEqual(['spring']);
    await donHangDoiDanhSach();
  });

  it('bấm chip chủ đề thì gửi forumTopicId lên /api/forum/posts', async () => {
    let topicIdDaGui: string | null = null;
    server.use(
      topicsOk([TOPIC]),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
      http.get(`${BASE}/api/forum/posts`, ({ request }) => {
        topicIdDaGui = new URL(request.url).searchParams.get('forumTopicId');
        return HttpResponse.json(envelope(cursorPage([post('p3', 'Bài theo chủ đề')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Hỏi đáp', selected: false }));

    await waitFor(() => expect(screen.getByText('Bài theo chủ đề')).toBeTruthy());
    expect(topicIdDaGui).toBe('t1');
    await donHangDoiDanhSach();
  });

  it('cuộn tới cuối thì tải trang kế, và không gọi trùng khi đang tải', async () => {
    const cursorDaGui: (string | null)[] = [];
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, async ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursorDaGui.push(cursor);
        if (cursor === null) return HttpResponse.json(envelope(cursorPage([POST], 'c2')));
        // Chậm có chủ ý: giữ isFetchingNextPage bật đủ lâu để lần onEndReached
        // thứ hai rơi vào đúng lúc guard phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(envelope(cursorPage([post('p2', 'Bài trang hai')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    // Hai lần bắn phải nằm trong cùng MỘT tick: đó mới là tình huống FlatList gây
    // ra trên máy thật, và cũng là tình huống mà guard dựa trên state render
    // không chặn nổi.
    // Gọi thẳng `onEndReached` hai lần trong CÙNG một tick thay vì dùng fireEvent.
    //
    // Đây là điều FlatList thật sự làm khi người dùng quăng nhanh tới cuối danh
    // sách, và là tình huống duy nhất mà guard theo state render không chặn nổi.
    // Dùng `await fireEvent` hai lần thì React kịp render lại với
    // `isFetchingNextPage = true` giữa hai lần, và test không còn chứng minh được
    // là cần tới ref; bắn hai fireEvent song song thì hai act lồng nhau, React kêu
    // "overlapping act() calls" và làm hỏng test kế tiếp.
    const onEndReached = screen.getByTestId('danh-sach-bai-viet').props
      .onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('Bài trang hai')).toBeTruthy());
    expect(cursorDaGui).toEqual([null, 'c2']);
    await donHangDoiDanhSach();
  });

  it('bấm vào một bài thì điều hướng sang trang chi tiết của đúng bài đó', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent.press(screen.getByText('Học Spring Boot từ đâu?'));

    expect(mockPush).toHaveBeenCalledWith('/forum/p1');
    await donHangDoiDanhSach();
  });

  it('feed RỖNG vẫn có nút mở màn soạn bài, bấm vào thì sang /forum/compose', async () => {
    // Trạng thái rỗng là lúc người dùng cần nút đăng bài nhất; nếu nút nằm
    // trong `FlatList` thì đúng lúc đó nó biến mất.
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có bài viết nào')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-mo-soan-bai'));

    expect(mockPush).toHaveBeenCalledWith('/forum/compose');
    await donHangDoiDanhSach();
  });

  it('MẤT MẠNG lúc mở tab thì nói mất kết nối, KHÔNG nói chưa có bài viết nào', async () => {
    // `isLoading` KHÔNG bật khi mất mạng: với networkMode 'online' (mặc định),
    // query nằm ở status 'pending' + fetchStatus 'paused', mà
    // `isLoading = isPending && isFetching` nên nó là false. Màn hình rơi thẳng
    // xuống nhánh rỗng và báo "Chưa có bài viết nào" trong khi chưa hề gọi được
    // API — nói với người dùng rằng cả diễn đàn trống rỗng.
    onlineManager.setOnline(false);
    try {
      server.use(topicsOk(), http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))));

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByText('Chưa có bài viết nào')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('bấm tim trên thẻ bài viết thì đổi ngay và gửi PUT reaction', async () => {
    // Task 7 cố tình để ô lượt thích là View thường khi chưa có handler, để
    // không dựng nút chết. Task 9 nối `useTogglePostLike` vào thì nó mới thành
    // nút thật — không có bước này thì cả cập nhật lạc quan cũng vô dụng.
    let soPut = 0;
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () => {
        soPut += 1;
        return HttpResponse.json(
          envelope({ ...POST, reactedByCurrentUser: true, reactionCount: 1 }),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Thích'));

    await waitFor(() => expect(screen.getByLabelText('Bỏ thích')).toBeTruthy());
    expect(within(screen.getByTestId('so-luot-thich')).getByText('1')).toBeTruthy();
    expect(soPut).toBe(1);

    // FlatList gom việc tính lại ô hiển thị vào một hẹn giờ ~50ms
    // (`_updateCellsToRenderBatcher`). Test kết thúc trước khi nó nổ thì cú
    // setState đó rơi ra ngoài mọi act() và React kêu "not wrapped in act(...)"
    // — cảnh báo lại hiện ở một test khác vì nó nổ sau. Đợi cho nó nổ trong act.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    await donHangDoiDanhSach();
  });
});
