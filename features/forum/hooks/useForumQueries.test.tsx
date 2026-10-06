import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import {
  useCommentReplies,
  useForumComments,
  useForumList,
  useForumTopics,
} from '@/features/forum/hooks/useForumQueries';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function cursorPage(items: unknown[], nextCursor: string | null = null) {
  return { items, nextCursor, prevCursor: null, hasNext: nextCursor !== null, hasPrev: false, limit: 20 };
}

const server = setupServer();

/**
 * Một QueryClient cho mỗi test, KHÔNG phải mỗi lần render.
 *
 * Nếu đặt `createQueryClient()` ngay trong thân `wrapper`, mỗi lần React render
 * lại sẽ dựng một client mới: cache không còn dùng chung giữa các lần render, và
 * mỗi client bỏ lại một bộ hẹn giờ `gcTime` giữ event loop của Node sống — Jest
 * báo "did not exit one second after the test run has completed".
 */
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

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useForumList', () => {
  it('không có bộ lọc thì gọi /api/forum/feed', async () => {
    let feedCalls = 0;
    server.use(
      http.get(`${BASE}/api/forum/feed`, () => {
        feedCalls += 1;
        return HttpResponse.json(envelope(cursorPage([{ postId: 'p1' }])));
      }),
    );

    const { result } = await renderHook(() => useForumList({}), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    expect(feedCalls).toBe(1);
  });

  it('có từ khoá thì chuyển sang /api/forum/posts', async () => {
    let postsCalls = 0;
    server.use(
      http.get(`${BASE}/api/forum/posts`, () => {
        postsCalls += 1;
        return HttpResponse.json(envelope(cursorPage([{ postId: 'p2' }])));
      }),
    );

    const { result } = await renderHook(() => useForumList({ keyword: 'spring' }), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    expect(postsCalls).toBe(1);
  });

  it('có chọn chủ đề thì cũng dùng /api/forum/posts', async () => {
    let postsCalls = 0;
    server.use(
      http.get(`${BASE}/api/forum/posts`, () => {
        postsCalls += 1;
        return HttpResponse.json(envelope(cursorPage([])));
      }),
    );

    const { result } = await renderHook(() => useForumList({ forumTopicId: 't1' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(postsCalls).toBe(1);
  });

  it('mine: false KHÔNG phải một bộ lọc nên vẫn dùng newsfeed', async () => {
    // "Không lọc riêng bài của tôi" là trạng thái mặc định, không phải một bộ
    // lọc. Nếu hasFilters coi nó là filter, người dùng mất newsfeed ưu tiên
    // theo ngành học mà không có type error nào báo. MSW đang bật
    // onUnhandledRequest: 'error', nên nếu gọi nhầm /posts thì test đỏ ngay.
    let feedCalls = 0;
    server.use(
      http.get(`${BASE}/api/forum/feed`, () => {
        feedCalls += 1;
        return HttpResponse.json(envelope(cursorPage([{ postId: 'p1' }])));
      }),
    );

    const { result } = await renderHook(() => useForumList({ mine: false }), { wrapper });

    await waitFor(() => expect(result.current.posts).toHaveLength(1));
    expect(feedCalls).toBe(1);
  });

  it('gộp nhiều trang thành một mảng phẳng', async () => {
    server.use(
      http.get(`${BASE}/api/forum/feed`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return HttpResponse.json(
          cursor === null
            ? envelope(cursorPage([{ postId: 'p1' }], 'c2'))
            : envelope(cursorPage([{ postId: 'p2' }])),
        );
      }),
    );

    const { result } = await renderHook(() => useForumList({}), { wrapper });
    await waitFor(() => expect(result.current.posts).toHaveLength(1));

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.posts).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('useForumTopics', () => {
  it('tải danh sách chủ đề', async () => {
    server.use(
      http.get(`${BASE}/api/forum/topics`, () =>
        HttpResponse.json(envelope([{ id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 }])),
      ),
    );

    const { result } = await renderHook(() => useForumTopics(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });
});

describe('useForumComments', () => {
  it('trả về danh sách bình luận GỐC phẳng, giữ replyCount của backend', async () => {
    server.use(
      http.get(`${BASE}/api/forum/posts/p1/comments`, () =>
        HttpResponse.json(
          envelope(
            cursorPage([
              { commentId: 'c1', replyToCommentId: null, authorUserId: 'u1', replyCount: 2 },
              { commentId: 'c2', replyToCommentId: null, authorUserId: 'u2', replyCount: 0 },
            ]),
          ),
        ),
      ),
    );

    const { result } = await renderHook(() => useForumComments('p1'), { wrapper });

    await waitFor(() => expect(result.current.comments).toHaveLength(2));
    expect(result.current.comments[0]?.replyCount).toBe(2);
  });
});

describe('useCommentReplies', () => {
  it('gọi đúng endpoint reply của bình luận gốc và nối trang theo cursor', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/forum/comments/c1/replies`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          envelope(
            cursor === null
              ? cursorPage([{ commentId: 'r1', replyToCommentId: 'c1' }], 'trang-2')
              : cursorPage([{ commentId: 'r2', replyToCommentId: 'c1' }]),
          ),
        );
      }),
    );

    const { result } = await renderHook(() => useCommentReplies('p1', 'c1'), { wrapper });
    await waitFor(() => expect(result.current.replies).toHaveLength(1));

    // Hai lần gọi cùng một tick: chốt chặn trong hook chỉ để MỘT request đi.
    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() =>
      expect(result.current.replies.map((r) => r.commentId)).toEqual(['r1', 'r2']),
    );
    expect(cursors).toEqual([null, 'trang-2']);
  });
});
