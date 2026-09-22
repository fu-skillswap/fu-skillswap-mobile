import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  useToggleCommentLike,
  useTogglePostLike,
} from '@/features/forum/hooks/useForumMutations';
import {
  useForumComments,
  useForumList,
  useForumPost,
} from '@/features/forum/hooks/useForumQueries';
import { forumKeys } from '@/features/forum/queryKeys';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function cursorPage(items: unknown[]) {
  return { items, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 };
}

function post(overrides: Record<string, unknown> = {}) {
  return {
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorProgram: null,
    forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
    title: 'Bài 1',
    content: 'Nội dung',
    status: 'PUBLISHED',
    commentCount: 0,
    reactionCount: 5,
    reportCount: 0,
    lastActivityAt: '2026-09-22T00:00:00Z',
    reactedByCurrentUser: false,
    myReactionType: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

function comment(commentId: string, overrides: Record<string, unknown> = {}) {
  return {
    commentId,
    postId: 'p1',
    authorUserId: 'u2',
    authorFullName: 'Tran Thi B',
    authorAvatarUrl: '',
    authorRole: 'MENTEE',
    content: `noi dung ${commentId}`,
    status: 'VISIBLE',
    reportCount: 0,
    reactionCount: 3,
    reactedByCurrentUser: false,
    replyToCommentId: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

/** Lỗi vượt hạn mức 60 lượt like / 10 phút của backend */
function loi429() {
  return HttpResponse.json(
    {
      timestamp: '',
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Cham lai',
      data: null,
      retryAfterSeconds: 60,
    },
    { status: 429 },
  );
}

/**
 * Một cái chốt mở được bằng tay, để giữ phản hồi HTTP nằm yên đúng lúc test cần
 * soi trạng thái "đã bấm nhưng API chưa trả lời".
 */
function taoChot() {
  let mo!: () => void;
  const cho = new Promise<void>((resolve) => {
    mo = resolve;
  });
  return { cho, mo };
}

const feedOk = (items: unknown[]) =>
  http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage(items))));

const baiVietOk = () =>
  http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(post())));

const binhLuanOk = (items: unknown[]) =>
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
  // KHÔNG dùng `queryClient.clear()` trần: nó bỏ sót bộ hẹn giờ gcTime của
  // mutation và Jest treo sau khi test xong — xem JSDoc của helper.
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Gộp mọi hook cần dùng vào MỘT renderHook: nhiều renderHook song song là nhiều
 * cây React, mỗi cây một phạm vi act() — đúng lớp lỗi đã làm hỏng test ở Task 7.
 */
function renderHooks() {
  return renderHook(
    () => ({
      list: useForumList({}),
      chiTiet: useForumPost('p1'),
      binhLuan: useForumComments('p1'),
      like: useTogglePostLike(),
      likeBinhLuan: useToggleCommentLike('p1'),
    }),
    { wrapper },
  );
}

describe('useTogglePostLike', () => {
  it('đổi giao diện ngay khi bấm, KHÔNG đợi API trả lời', async () => {
    const chot = taoChot();
    let daTraLoi = false;
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, async () => {
        await chot.cho;
        daTraLoi = true;
        return HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 })));
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });

    // Chốt chưa mở nên backend chưa trả lời gì, mà giao diện đã đổi rồi.
    expect(daTraLoi).toBe(false);
    expect(result.current.list.posts[0]?.reactedByCurrentUser).toBe(true);
    expect(result.current.list.posts[0]?.reactionCount).toBe(6);
    expect(result.current.list.posts[0]?.myReactionType).toBe('LIKE');

    await act(async () => {
      chot.mo();
      await chot.cho;
    });
    await waitFor(() => expect(result.current.like.isPending).toBe(false));
  });

  it('bị 429 thì hoàn tác về ĐÚNG số đếm trước khi bấm', async () => {
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () => loi429()),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });

    await waitFor(() => expect(result.current.like.isPending).toBe(false));
    expect(result.current.list.posts[0]?.reactedByCurrentUser).toBe(false);
    expect(result.current.list.posts[0]?.reactionCount).toBe(5);
    expect(result.current.list.posts[0]?.myReactionType).toBeNull();
  });

  it('cập nhật CẢ cache chi tiết bài viết, không chỉ danh sách', async () => {
    // Bấm tim ở feed rồi mở chi tiết mà thấy tim rỗng trở lại là lỗi kinh điển
    // của cập nhật lạc quan thiếu khoá.
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () =>
        HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 }))),
      ),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.chiTiet.data).toBeDefined());
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });

    await waitFor(() => expect(result.current.chiTiet.data?.reactedByCurrentUser).toBe(true));
    expect(result.current.chiTiet.data?.reactionCount).toBe(6);
  });

  it('KHÔNG đụng vào cache bình luận của cùng bài đó', async () => {
    // `ForumCommentResponse` cũng có `postId` và `reactionCount`. Quét cả nhánh
    // 'forum' rồi so `item.postId === postId` sẽ lật luôn tim của mọi bình luận
    // thuộc bài này.
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([comment('c1')]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () =>
        HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 }))),
      ),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(1));
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });

    await waitFor(() => expect(result.current.list.posts[0]?.reactedByCurrentUser).toBe(true));
    expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(3);
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(false);
  });

  it('huỷ request đang bay để phản hồi cũ không ghi đè kết quả lạc quan', async () => {
    const chotFeed = taoChot();
    const chotLike = taoChot();
    let lanGoiFeed = 0;
    server.use(
      http.get(`${BASE}/api/forum/feed`, async () => {
        lanGoiFeed += 1;
        // Lần tải lại (nền) cố tình về SAU cú bấm, và mang số đếm CŨ.
        if (lanGoiFeed > 1) await chotFeed.cho;
        return HttpResponse.json(envelope(cursorPage([post()])));
      }),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, async () => {
        await chotLike.cho;
        return HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 })));
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    let taiLai!: Promise<void>;
    await act(async () => {
      taiLai = queryClient.refetchQueries({ queryKey: forumKeys.feed() });
    });
    await waitFor(() => expect(lanGoiFeed).toBe(2));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });
    expect(result.current.list.posts[0]?.reactionCount).toBe(6);

    // Cho phản hồi cũ về. Đã bị huỷ thì nó không được ghi đè gì cả.
    await act(async () => {
      chotFeed.mo();
      await taiLai;
      // TanStack báo cho React qua `notifyManager`, và notifyManager gom thông
      // báo lại vào một macrotask. Đọc `result.current` ngay sau `await taiLai`
      // là đọc lần render CŨ — assertion sẽ xanh kể cả khi cache vừa bị phản
      // hồi cũ ghi đè, tức là test không chứng minh được điều nó tuyên bố.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.list.posts[0]?.reactedByCurrentUser).toBe(true);
    expect(result.current.list.posts[0]?.reactionCount).toBe(6);

    await act(async () => {
      chotLike.mo();
      await chotLike.cho;
    });
    await waitFor(() => expect(result.current.like.isPending).toBe(false));
  });

  it('lấy số đếm thật từ phản hồi backend chứ không giữ con số tự đoán', async () => {
    // Người khác cũng vừa like bài đó: backend trả 9, không phải 5 + 1.
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () =>
        HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 9 }))),
      ),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });

    await waitFor(() => expect(result.current.list.posts[0]?.reactionCount).toBe(9));
  });

  it('bấm hai lần trong cùng một frame chỉ gửi MỘT request', async () => {
    // Hạn mức của backend là 60 lượt like/bỏ like trong 10 phút; mỗi cú chạm
    // thừa đều đốt hạn mức thật.
    const chot = taoChot();
    let soRequest = 0;
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, async () => {
        soRequest += 1;
        await chot.cho;
        return HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 })));
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    const baiViet = result.current.list.posts[0]!;
    await act(async () => {
      result.current.like.toggle(baiViet);
      result.current.like.toggle(baiViet);
    });

    expect(soRequest).toBe(1);
    // Và số đếm chỉ nhích một nấc, không phải hai.
    expect(result.current.list.posts[0]?.reactionCount).toBe(6);

    await act(async () => {
      chot.mo();
      await chot.cho;
    });
    await waitFor(() => expect(result.current.like.isPending).toBe(false));
  });
});

describe('useToggleCommentLike', () => {
  it('đổi ĐÚNG bình luận được bấm, ngay trước khi API trả lời', async () => {
    const chot = taoChot();
    let daTraLoi = false;
    server.use(
      feedOk([]),
      baiVietOk(),
      binhLuanOk([comment('c1'), comment('c2')]),
      http.put(`${BASE}/api/forum/comments/c1/reaction`, async () => {
        await chot.cho;
        daTraLoi = true;
        return HttpResponse.json(
          envelope(comment('c1', { reactedByCurrentUser: true, reactionCount: 4 })),
        );
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(2));

    await act(async () => {
      result.current.likeBinhLuan.toggle(result.current.binhLuan.comments[0]!);
    });

    expect(daTraLoi).toBe(false);
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(true);
    expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(4);
    // Bình luận bên cạnh không được động vào.
    expect(result.current.binhLuan.comments[1]?.reactedByCurrentUser).toBe(false);
    expect(result.current.binhLuan.comments[1]?.reactionCount).toBe(3);

    await act(async () => {
      chot.mo();
      await chot.cho;
    });
    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(4));
  });

  it('bỏ like bình luận gửi DELETE và trừ số đếm ngay', async () => {
    let soDelete = 0;
    server.use(
      feedOk([]),
      baiVietOk(),
      binhLuanOk([comment('c1', { reactedByCurrentUser: true, reactionCount: 4 })]),
      http.delete(`${BASE}/api/forum/comments/c1/reaction`, () => {
        soDelete += 1;
        return HttpResponse.json(
          envelope(comment('c1', { reactedByCurrentUser: false, reactionCount: 3 })),
        );
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(1));

    await act(async () => {
      result.current.likeBinhLuan.toggle(result.current.binhLuan.comments[0]!);
    });

    await waitFor(() => expect(soDelete).toBe(1));
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(false);
    expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(3);
  });

  it('bình luận bị 429 thì hoàn tác về đúng số đếm cũ', async () => {
    server.use(
      feedOk([]),
      baiVietOk(),
      binhLuanOk([comment('c1'), comment('c2')]),
      http.put(`${BASE}/api/forum/comments/c1/reaction`, () => loi429()),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(2));

    await act(async () => {
      result.current.likeBinhLuan.toggle(result.current.binhLuan.comments[0]!);
    });

    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(3));
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(false);
    expect(result.current.binhLuan.comments[1]?.reactionCount).toBe(3);
  });
});
