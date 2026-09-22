import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
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
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

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
  });

  it('feed rỗng thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bài viết nào')).toBeTruthy());
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
  });
});
