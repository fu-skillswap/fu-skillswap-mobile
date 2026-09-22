import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import { PostDetailScreen } from '@/features/forum';

const BASE = 'https://api.skillswap.asia';

/**
 * `PostDetailScreen` tự nó không dùng expo-router, nhưng nó được lấy qua barrel
 * `@/features/forum` — barrel kéo theo `ForumFeedScreen`, file này import
 * `expo-router`, mà `expo-router` lại require `standard-navigation`: một package
 * ship ESM thô, không nằm trong `transformIgnorePatterns`, nên Jest nổ
 * "Cannot use import statement outside a module" ngay ở bước import.
 *
 * Mock giữ đúng hình dạng thật (`useRouter()` trả về object có `push`) để nếu
 * sau này màn hình chi tiết cần điều hướng thì mock không phải viết lại.
 */
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function loi500() {
  return HttpResponse.json(
    { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
    { status: 500 },
  );
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

function baseComment(commentId: string, overrides: Record<string, unknown> = {}) {
  return {
    commentId,
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorRole: 'MENTEE',
    content: `noi dung ${commentId}`,
    status: 'VISIBLE',
    reportCount: 0,
    reactionCount: 0,
    reactedByCurrentUser: false,
    replyToCommentId: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

const POST = {
  postId: 'p1',
  authorUserId: 'u1',
  authorFullName: 'Nguyen Van A',
  authorAvatarUrl: '',
  authorProgram: null,
  forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
  title: 'Học Spring Boot từ đâu?',
  content: 'Nội dung bài viết',
  status: 'PUBLISHED',
  commentCount: 2,
  reactionCount: 0,
  reportCount: 0,
  lastActivityAt: '2026-09-22T00:00:00Z',
  reactedByCurrentUser: false,
  myReactionType: null,
  createdAt: '2026-09-22T00:00:00Z',
  updatedAt: '2026-09-22T00:00:00Z',
  imageUrls: [],
};

/** Handler bài viết dùng lại ở mọi test — màn hình luôn gọi nó khi mở. */
const postOk = () => http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(POST)));
const commentsOk = (items: unknown[] = []) =>
  http.get(`${BASE}/api/forum/posts/p1/comments`, () =>
    HttpResponse.json(envelope(cursorPage(items))),
  );

const server = setupServer();

/** Một QueryClient cho mỗi test, KHÔNG phải mỗi lần render — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/** `render` của RNTL 14 là hàm ASYNC — phải await, nếu không lần render đầu nằm ngoài act(). */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <PostDetailScreen postId="p1" />
    </QueryClientProvider>,
  );
}

describe('PostDetailScreen', () => {
  it('hiện bài viết, reply thụt vào và badge AI của bot', async () => {
    server.use(
      postOk(),
      commentsOk([
        baseComment('c1'),
        baseComment('r1', {
          replyToCommentId: 'c1',
          replyToUserName: 'Nguyen Van A',
          authorUserId: 'bot-user-id',
          authorFullName: 'SkillSwap AI',
        }),
      ]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText(/Trả lời Nguyen Van A/)).toBeTruthy();
  });

  it('bài chưa có bình luận thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(postOk(), commentsOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());
  });

  it('bình luận lỗi 500 thì báo lỗi, KHÔNG nói dối là chưa ai bình luận', async () => {
    // Gộp lỗi vào trạng thái rỗng là nói với người dùng rằng bài này không ai
    // trả lời, trong khi thật ra chỉ là không tải được.
    server.use(
      postOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, () => loi500()),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.queryByText('Chưa có bình luận')).toBeNull();
    // Bài viết vẫn đọc được: hai query độc lập nhau.
    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
  });

  it('bài viết lỗi 500 ngay từ đầu thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/forum/posts/p1`, () => loi500()),
      commentsOk([]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });

  it('tải lại HỎNG khi đã có bài thì GIỮ NGUYÊN nội dung, chỉ báo nhẹ', async () => {
    // `isError` của TanStack v5 bật cả khi query đã có data và chỉ lần refetch
    // nền thất bại; dựa vào mình nó thì một lần kéo-để-tải-lại hụt sóng sẽ xoá
    // mất bài người dùng đang đọc dở, dù nó còn nguyên trong cache.
    let lanGoi = 0;
    server.use(
      http.get(`${BASE}/api/forum/posts/p1`, () => {
        lanGoi += 1;
        return lanGoi === 1 ? HttpResponse.json(envelope(POST)) : loi500();
      }),
      commentsOk([baseComment('c1')]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent(screen.getByTestId('danh-sach-binh-luan'), 'refresh');

    await waitFor(() => expect(screen.getByTestId('loi-tai-lai-nen')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
  });

  it('cuộn tới cuối thì tải trang bình luận kế, và không gọi trùng khi đang tải', async () => {
    const cursorDaGui: (string | null)[] = [];
    server.use(
      postOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, async ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursorDaGui.push(cursor);
        if (cursor === null) {
          return HttpResponse.json(envelope(cursorPage([baseComment('c1')], 'c2')));
        }
        // Chậm có chủ ý: giữ isFetchingNextPage bật đủ lâu để lần onEndReached
        // thứ hai rơi vào đúng lúc chốt chặn phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(envelope(cursorPage([baseComment('c2')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c1')).toBeTruthy());

    // Hai lần bắn phải nằm trong CÙNG một tick — đó mới là điều FlatList làm khi
    // người dùng quăng nhanh tới cuối, và là tình huống duy nhất mà guard theo
    // state render không chặn nổi. Dùng hai `await fireEvent` thì React kịp render
    // lại ở giữa; bắn song song thì hai act lồng nhau làm hỏng test kế tiếp.
    const onEndReached = screen.getByTestId('danh-sach-binh-luan').props.onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('noi dung c2')).toBeTruthy());
    expect(cursorDaGui).toEqual([null, 'c2']);
  });
});
