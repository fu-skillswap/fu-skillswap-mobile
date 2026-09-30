import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  useCreateComment,
  useCreatePost,
  useDeletePost,
  useReport,
  useToggleCommentLike,
  useTogglePostLike,
  useUpdatePost,
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

/**
 * Nhường một nhịp macrotask BÊN TRONG act.
 *
 * TanStack gom thông báo re-render vào `notifyManager`, và notifyManager đẩy
 * chúng qua một `setTimeout(0)`. Nếu test kết thúc trước khi macrotask đó nổ,
 * React cập nhật ngoài phạm vi act và in "An update to ... was not wrapped in
 * act(...)" — chập chờn, chỉ hiện ở vài lần chạy, nên rất dễ bị cho qua.
 */
async function nhuongMotNhip() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Hai danh sách cùng sống: newsfeed và một danh sách CÓ lọc theo chủ đề */
function renderHaiDanhSach() {
  return renderHook(
    () => ({
      feed: useForumList({}),
      theoChuDe: useForumList({ forumTopicId: 't1' }),
      like: useTogglePostLike(),
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

  it('cập nhật CẢ danh sách đã lọc theo chủ đề, không chỉ newsfeed', async () => {
    // Bài viết sống trong nhiều entry cache: `feed()` và `posts(filters)` với
    // TỪNG bộ lọc. Nếu phạm vi cập nhật bỏ nhánh `posts`, người dùng thả tim ở
    // newsfeed rồi đổi sang chip chủ đề sẽ thấy tim rỗng trở lại. Mọi test khác
    // trong file này đều chỉ dùng `useForumList({})`, nên không cái nào canh
    // được nhánh đó.
    server.use(
      feedOk([post()]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([post()])))),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () =>
        HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 }))),
      ),
    );

    const { result } = await renderHaiDanhSach();
    await waitFor(() => expect(result.current.feed.posts).toHaveLength(1));
    await waitFor(() => expect(result.current.theoChuDe.posts).toHaveLength(1));

    await act(async () => {
      result.current.like.toggle(result.current.feed.posts[0]!);
    });
    await nhuongMotNhip();

    expect(result.current.feed.posts[0]?.reactedByCurrentUser).toBe(true);
    expect(result.current.theoChuDe.posts[0]?.reactedByCurrentUser).toBe(true);
  });

  it('hoàn tác chỉ trả lại ba trường reaction, KHÔNG đắp đè bản cũ lên cache chi tiết', async () => {
    // Bản chụp để hoàn tác lấy từ danh sách người dùng đang bấm. Nếu `onError`
    // đắp nguyên object đó lên mọi cache, màn hình chi tiết — vốn có thể mới hơn
    // — sẽ tụt về tiêu đề và số bình luận cũ. Một cú like hỏng kéo theo cả nội
    // dung không liên quan.
    server.use(
      feedOk([post({ title: 'Tieu de CU', commentCount: 0 })]),
      http.get(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope(post({ title: 'Tieu de MOI', commentCount: 7 }))),
      ),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () => loi429()),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));
    await waitFor(() => expect(result.current.chiTiet.data?.title).toBe('Tieu de MOI'));

    await act(async () => {
      result.current.like.toggle(result.current.list.posts[0]!);
    });
    await waitFor(() => expect(result.current.chiTiet.data?.reactedByCurrentUser).toBe(false));

    // Reaction đã hoàn tác đúng...
    expect(result.current.chiTiet.data?.reactionCount).toBe(5);
    // ...nhưng phần còn lại của bài viết KHÔNG được đụng tới.
    expect(result.current.chiTiet.data?.title).toBe('Tieu de MOI');
    expect(result.current.chiTiet.data?.commentCount).toBe(7);
  });

  it('MẤT MẠNG thì vẫn gửi request và nhả chốt, không khoá cứng nút tim', async () => {
    // Với `networkMode` mặc định ('online'), TanStack chạy `onMutate` rồi HOÃN
    // request: giao diện hiện tim đầy trong khi chưa gửi gì, và vì `onSettled`
    // không bao giờ chạy nên chốt chống bấm-hai-lần giữ postId vĩnh viễn —
    // người dùng không bỏ tim lại được cho tới khi có mạng.
    let soPut = 0;
    server.use(
      feedOk([post()]),
      baiVietOk(),
      binhLuanOk([]),
      http.put(`${BASE}/api/forum/posts/p1/reaction`, () => {
        soPut += 1;
        return HttpResponse.json(envelope(post({ reactedByCurrentUser: true, reactionCount: 6 })));
      }),
      http.delete(`${BASE}/api/forum/posts/p1/reaction`, () =>
        HttpResponse.json(envelope(post({ reactedByCurrentUser: false, reactionCount: 5 }))),
      ),
    );

    // Tải xong dữ liệu TRƯỚC rồi mới ngắt mạng: `setOnline(false)` hoãn cả
    // query chứ không riêng mutation, ngắt trước thì feed không bao giờ tải nổi.
    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.list.posts).toHaveLength(1));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        result.current.like.toggle(result.current.list.posts[0]!);
      });
      await waitFor(() => expect(soPut).toBe(1));

      // Chốt đã nhả: bấm lần nữa phải đi tiếp được, không im lặng.
      await act(async () => {
        result.current.like.toggle(result.current.list.posts[0]!);
      });
      await waitFor(() => expect(result.current.list.posts[0]?.reactedByCurrentUser).toBe(false));
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
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
        // 9 chứ không phải 4: giữa hai lần tải, người khác cũng vừa thả tim.
        // Nếu con số của backend trùng khít với kết quả lạc quan thì test không
        // phân biệt được "app tự đoán" với "lấy từ backend".
        return HttpResponse.json(
          envelope(comment('c1', { reactedByCurrentUser: true, reactionCount: 9 })),
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
    // Số đếm THẬT của backend thắng con số tự cộng.
    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(9));
    await nhuongMotNhip();
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
          envelope(comment('c1', { reactedByCurrentUser: false, reactionCount: 2 })),
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
    // 2 là số của backend; trừ tại chỗ sẽ ra 3.
    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(2));
    await nhuongMotNhip();
  });

  it('hoàn tác bình luận chỉ trả lại hai trường reaction, không đắp đè bản cũ', async () => {
    // Bản chụp để hoàn tác là cái người dùng đang CẦM trên tay lúc bấm. Nếu
    // danh sách vừa tải lại xen vào (tác giả sửa nội dung, số báo cáo đổi...),
    // bản cầm trên tay đã cũ — đắp nguyên nó đè lên cache là nuốt mất bản sửa.
    let lanGoi = 0;
    server.use(
      feedOk([]),
      baiVietOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, () => {
        lanGoi += 1;
        return HttpResponse.json(
          envelope(
            cursorPage([
              comment('c1', { content: lanGoi === 1 ? 'noi dung CU' : 'noi dung DA SUA' }),
            ]),
          ),
        );
      }),
      http.put(`${BASE}/api/forum/comments/c1/reaction`, () => loi429()),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments[0]?.content).toBe('noi dung CU'));

    // Người dùng cầm bản CŨ; danh sách tải lại và có nội dung mới.
    const camTrenTay = result.current.binhLuan.comments[0]!;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: forumKeys.comments('p1') });
    });
    await waitFor(() =>
      expect(result.current.binhLuan.comments[0]?.content).toBe('noi dung DA SUA'),
    );

    await act(async () => {
      result.current.likeBinhLuan.toggle(camTrenTay);
    });

    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(3));
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(false);
    // Nội dung đã sửa KHÔNG được bị cú like hỏng nuốt mất.
    expect(result.current.binhLuan.comments[0]?.content).toBe('noi dung DA SUA');
    await nhuongMotNhip();
  });

  it('huỷ request bình luận đang bay để phản hồi cũ không ghi đè kết quả lạc quan', async () => {
    // Nhánh bình luận có `cancelQueries` riêng, và trước đây xoá nó đi thì toàn
    // bộ suite vẫn xanh — không test nào canh.
    const chotTai = taoChot();
    const chotLike = taoChot();
    let lanGoi = 0;
    server.use(
      feedOk([]),
      baiVietOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, async () => {
        lanGoi += 1;
        // Lần tải lại (nền) cố tình về SAU cú bấm, và mang số đếm CŨ.
        if (lanGoi > 1) await chotTai.cho;
        return HttpResponse.json(envelope(cursorPage([comment('c1')])));
      }),
      http.put(`${BASE}/api/forum/comments/c1/reaction`, async () => {
        await chotLike.cho;
        return HttpResponse.json(
          envelope(comment('c1', { reactedByCurrentUser: true, reactionCount: 9 })),
        );
      }),
    );

    const { result } = await renderHooks();
    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(1));

    let taiLai!: Promise<void>;
    await act(async () => {
      taiLai = queryClient.refetchQueries({ queryKey: forumKeys.comments('p1') });
    });
    await waitFor(() => expect(lanGoi).toBe(2));

    await act(async () => {
      result.current.likeBinhLuan.toggle(result.current.binhLuan.comments[0]!);
    });
    expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(4);

    await act(async () => {
      chotTai.mo();
      await taiLai;
      // Xem chú thích cùng loại ở test của bài viết: notifyManager gom thông báo
      // vào một macrotask, đọc sớm là đọc lần render cũ.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.binhLuan.comments[0]?.reactedByCurrentUser).toBe(true);
    expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(4);

    await act(async () => {
      chotLike.mo();
      await chotLike.cho;
    });
    await waitFor(() => expect(result.current.binhLuan.comments[0]?.reactionCount).toBe(9));
    await nhuongMotNhip();
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
    await nhuongMotNhip();
  });
});

/**
 * Ba hook ghi bài viết cùng sống trong MỘT renderHook, kèm hai danh sách và màn
 * chi tiết — đúng cảnh thật: người dùng đăng bài xong thì newsfeed, danh sách
 * đang lọc và bài đang mở đều phải nói cùng một câu chuyện.
 */
function renderHookGhiBai() {
  return renderHook(
    () => ({
      feed: useForumList({}),
      theoChuDe: useForumList({ forumTopicId: 't1' }),
      chiTiet: useForumPost('p1'),
      taoBai: useCreatePost(),
      suaBai: useUpdatePost('p1'),
      xoaBai: useDeletePost(),
    }),
    { wrapper },
  );
}

/** Trả về trang khác nhau cho mỗi lần gọi, để thấy được có tải lại hay không */
function traLanLuot(cacLan: unknown[][]) {
  let lan = 0;
  return () => {
    const items = cacLan[Math.min(lan, cacLan.length - 1)]!;
    lan += 1;
    return HttpResponse.json(envelope(cursorPage(items)));
  };
}

describe('useCreatePost', () => {
  it('đăng xong thì tải lại CẢ newsfeed LẪN danh sách đang lọc theo chủ đề', async () => {
    server.use(
      baiVietOk(),
      binhLuanOk([]),
      http.get(`${BASE}/api/forum/feed`, traLanLuot([[], [post({ postId: 'p9' })]])),
      http.get(`${BASE}/api/forum/posts`, traLanLuot([[], [post({ postId: 'p9' })]])),
      http.post(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(post({ postId: 'p9' })))),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.theoChuDe.isSuccess).toBe(true));
    expect(result.current.feed.posts).toHaveLength(0);
    expect(result.current.theoChuDe.posts).toHaveLength(0);

    await act(async () => {
      await result.current.taoBai.mutateAsync({
        title: 'Bài mới',
        content: 'Nội dung',
        forumTopicId: 't1',
      });
    });

    await waitFor(() => expect(result.current.feed.posts.map((p) => p.postId)).toEqual(['p9']));
    await waitFor(() =>
      expect(result.current.theoChuDe.posts.map((p) => p.postId)).toEqual(['p9']),
    );
    await nhuongMotNhip();
  });

  it('mất mạng thì vẫn GỬI NGAY và kết thúc, không nằm im chờ có mạng', async () => {
    let soPost = 0;
    server.use(
      baiVietOk(),
      binhLuanOk([]),
      feedOk([]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([])))),
      http.post(`${BASE}/api/forum/posts`, () => {
        soPost += 1;
        return HttpResponse.json(envelope(post({ postId: 'p9' })));
      }),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        await result.current.taoBai.mutateAsync({
          title: 'Bài mới',
          content: 'Nội dung',
          forumTopicId: 't1',
        });
      });

      // Với `networkMode` mặc định ('online'), mutation nằm ở trạng thái hoãn:
      // `isPaused` bật, request chưa hề rời máy, và `mutateAsync` không bao giờ
      // trả lời — giao diện sẽ đứng hình với nút "đang gửi".
      expect(soPost).toBe(1);
      expect(result.current.taoBai.isPaused).toBe(false);
      expect(result.current.taoBai.isSuccess).toBe(true);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await nhuongMotNhip();
  });
});

describe('useUpdatePost', () => {
  it('sửa xong thì màn chi tiết lấy lại bài TỪ MÁY CHỦ, không đắp bản mình vừa gõ', async () => {
    let lanGetChiTiet = 0;
    server.use(
      feedOk([]),
      binhLuanOk([]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([])))),
      http.get(`${BASE}/api/forum/posts/p1`, () => {
        lanGetChiTiet += 1;
        // Lần hai khác HẲN thứ mà client vừa gửi lên: nếu màn hình chỉ đắp lại
        // payload của chính mình thì tiêu đề sẽ là 'Tiêu đề tôi vừa gõ' và test đỏ.
        return HttpResponse.json(
          envelope(
            post({
              title: lanGetChiTiet === 1 ? 'Tiêu đề cũ' : 'Tiêu đề máy chủ đã kiểm duyệt',
              commentCount: 12,
            }),
          ),
        );
      }),
      http.put(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope(post({ title: 'Tiêu đề tôi vừa gõ' }))),
      ),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.chiTiet.data?.title).toBe('Tiêu đề cũ'));

    await act(async () => {
      await result.current.suaBai.mutateAsync({
        title: 'Tiêu đề tôi vừa gõ',
        content: 'Nội dung mới',
        forumTopicId: 't1',
      });
    });

    await waitFor(() =>
      expect(result.current.chiTiet.data?.title).toBe('Tiêu đề máy chủ đã kiểm duyệt'),
    );
    expect(result.current.chiTiet.data?.commentCount).toBe(12);
    await nhuongMotNhip();
  });

  it('mất mạng thì vẫn GỬI NGAY và kết thúc, không nằm im chờ có mạng', async () => {
    // Global Constraints bắt mọi mutation đặt `networkMode: 'always'`. Thiếu nó,
    // mutation nằm ở trạng thái hoãn: request chưa rời máy, `mutateAsync` không
    // bao giờ trả lời, và giao diện đứng hình với nút "đang gửi". Lỗi này vừa
    // xảy ra thật ở `useCreatePost`, nên hai hook còn lại cũng cần chốt riêng.
    let soPut = 0;
    server.use(
      baiVietOk(),
      binhLuanOk([]),
      feedOk([]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([])))),
      http.put(`${BASE}/api/forum/posts/p1`, () => {
        soPut += 1;
        return HttpResponse.json(envelope(post({ title: 'Tiêu đề mới' })));
      }),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        await result.current.suaBai.mutateAsync({
          title: 'Tiêu đề mới',
          content: 'Nội dung mới',
          forumTopicId: 't1',
        });
      });

      expect(soPut).toBe(1);
      expect(result.current.suaBai.isPaused).toBe(false);
      expect(result.current.suaBai.isSuccess).toBe(true);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await nhuongMotNhip();
  });
});

describe('useDeletePost', () => {
  it('xoá xong thì bài biến khỏi newsfeed lẫn danh sách đang lọc', async () => {
    server.use(
      baiVietOk(),
      binhLuanOk([]),
      http.get(
        `${BASE}/api/forum/feed`,
        traLanLuot([
          [post({ postId: 'p1' }), post({ postId: 'p2' })],
          [post({ postId: 'p2' })],
        ]),
      ),
      http.get(
        `${BASE}/api/forum/posts`,
        traLanLuot([
          [post({ postId: 'p1' }), post({ postId: 'p2' })],
          [post({ postId: 'p2' })],
        ]),
      ),
      http.delete(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope(post({ postId: 'p1', status: 'DELETED' }))),
      ),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.feed.posts).toHaveLength(2));
    await waitFor(() => expect(result.current.theoChuDe.posts).toHaveLength(2));

    await act(async () => {
      await result.current.xoaBai.mutateAsync('p1');
    });

    await waitFor(() => expect(result.current.feed.posts.map((p) => p.postId)).toEqual(['p2']));
    await waitFor(() =>
      expect(result.current.theoChuDe.posts.map((p) => p.postId)).toEqual(['p2']),
    );
    await nhuongMotNhip();
  });

  it('mất mạng thì vẫn GỬI NGAY và kết thúc, không nằm im chờ có mạng', async () => {
    // Global Constraints bắt mọi mutation đặt `networkMode: 'always'`. Thiếu nó,
    // mutation nằm ở trạng thái hoãn: request chưa rời máy, `mutateAsync` không
    // bao giờ trả lời, và giao diện đứng hình với nút "đang gửi". Lỗi này vừa
    // xảy ra thật ở `useCreatePost`, nên hai hook còn lại cũng cần chốt riêng.
    let soDelete = 0;
    server.use(
      baiVietOk(),
      binhLuanOk([]),
      feedOk([]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([])))),
      http.delete(`${BASE}/api/forum/posts/p1`, () => {
        soDelete += 1;
        return HttpResponse.json(envelope(post({ postId: 'p1', status: 'DELETED' })));
      }),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        await result.current.xoaBai.mutateAsync('p1');
      });

      expect(soDelete).toBe(1);
      expect(result.current.xoaBai.isPaused).toBe(false);
      expect(result.current.xoaBai.isSuccess).toBe(true);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await nhuongMotNhip();
  });

  it('xoá xong thì cache chi tiết mang status DELETED, không còn nói bài vẫn sống', async () => {
    // Không `removeQueries` (observer đang sống sẽ refetch rồi nhận 404), nhưng
    // cũng không được để nguyên bản cũ: suốt `gcTime` 5 phút cache vẫn khai bài
    // là 'PUBLISHED'. Backend trả về chính bài đó với status mới — dùng nó.
    server.use(
      binhLuanOk([]),
      feedOk([]),
      http.get(`${BASE}/api/forum/posts`, () => HttpResponse.json(envelope(cursorPage([])))),
      http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(post()))),
      http.delete(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope(post({ postId: 'p1', status: 'DELETED' }))),
      ),
    );

    const { result } = await renderHookGhiBai();
    await waitFor(() => expect(result.current.chiTiet.data?.status).toBe('PUBLISHED'));

    await act(async () => {
      await result.current.xoaBai.mutateAsync('p1');
    });

    await waitFor(() => expect(result.current.chiTiet.data?.status).toBe('DELETED'));
    await nhuongMotNhip();
  });
});

/**
 * Ba hook ghi bình luận cùng sống trong MỘT renderHook, kèm newsfeed và màn chi
 * tiết — đúng cảnh thật: gửi một bình luận thì danh sách bình luận, số bình luận
 * của bài đang mở và số bình luận ở newsfeed đều phải nói cùng một câu chuyện.
 */
function renderHookGhiBinhLuan() {
  return renderHook(
    () => ({
      feed: useForumList({}),
      chiTiet: useForumPost('p1'),
      binhLuan: useForumComments('p1'),
      taoBinhLuan: useCreateComment('p1'),
      baoCao: useReport(),
    }),
    { wrapper },
  );
}

/** Trả về bài viết khác nhau cho mỗi lần gọi, để thấy được có tải lại hay không */
function traBaiLanLuot(cacLan: Record<string, unknown>[]) {
  let lan = 0;
  return () => {
    const bai = cacLan[Math.min(lan, cacLan.length - 1)]!;
    lan += 1;
    return HttpResponse.json(envelope(bai));
  };
}

describe('useCreateComment', () => {
  it('bình luận xong thì tải lại CẢ danh sách bình luận LẪN bài viết', async () => {
    // Bỏ một trong hai: bình luận vừa gửi không xuất hiện, hoặc dòng "N bình
    // luận" ở đầu bài đứng yên ở số cũ — cả hai đều khiến người dùng gửi lại.
    server.use(
      feedOk([post()]),
      http.get(`${BASE}/api/forum/posts/p1`, traBaiLanLuot([post({ commentCount: 0 }), post({ commentCount: 1 })])),
      http.get(`${BASE}/api/forum/posts/p1/comments`, traLanLuot([[], [comment('c1')]])),
      http.post(`${BASE}/api/forum/posts/p1/comments`, () =>
        HttpResponse.json(envelope(comment('c1'))),
      ),
    );

    const { result } = await renderHookGhiBinhLuan();
    await waitFor(() => expect(result.current.chiTiet.data?.commentCount).toBe(0));
    await waitFor(() => expect(result.current.binhLuan.isSuccess).toBe(true));

    await act(async () => {
      await result.current.taoBinhLuan.mutateAsync({ content: 'Toi cung thac mac' });
    });

    await waitFor(() => expect(result.current.binhLuan.comments).toHaveLength(1));
    await waitFor(() => expect(result.current.chiTiet.data?.commentCount).toBe(1));
    await nhuongMotNhip();
  });

  it('bình luận xong thì số bình luận ở NEWSFEED cũng mới lại', async () => {
    // Người dùng bình luận rồi bấm quay lại: thẻ bài trong feed vẫn hiện số cũ
    // suốt `staleTime` nếu không đánh dấu danh sách là cũ.
    server.use(
      http.get(`${BASE}/api/forum/feed`, traLanLuot([[post({ commentCount: 0 })], [post({ commentCount: 1 })]])),
      baiVietOk(),
      binhLuanOk([]),
      http.post(`${BASE}/api/forum/posts/p1/comments`, () =>
        HttpResponse.json(envelope(comment('c1'))),
      ),
    );

    const { result } = await renderHookGhiBinhLuan();
    await waitFor(() => expect(result.current.feed.posts[0]?.commentCount).toBe(0));

    await act(async () => {
      await result.current.taoBinhLuan.mutateAsync({ content: 'Toi cung thac mac' });
    });

    await waitFor(() => expect(result.current.feed.posts[0]?.commentCount).toBe(1));
    await nhuongMotNhip();
  });

  it('mất mạng thì vẫn GỬI NGAY và kết thúc, không nằm im chờ có mạng', async () => {
    // Thiếu `networkMode: 'always'`, mutation nằm ở trạng thái hoãn: nút "Gửi"
    // quay mãi, `mutateAsync` không bao giờ trả lời, và ô nhập không được dọn
    // nên người dùng tưởng mình chưa gõ gì.
    let soPost = 0;
    server.use(
      feedOk([]),
      baiVietOk(),
      binhLuanOk([]),
      http.post(`${BASE}/api/forum/posts/p1/comments`, () => {
        soPost += 1;
        return HttpResponse.json(envelope(comment('c1')));
      }),
    );

    const { result } = await renderHookGhiBinhLuan();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        await result.current.taoBinhLuan.mutateAsync({ content: 'Toi cung thac mac' });
      });

      expect(soPost).toBe(1);
      expect(result.current.taoBinhLuan.isPaused).toBe(false);
      expect(result.current.taoBinhLuan.isSuccess).toBe(true);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await nhuongMotNhip();
  });
});

describe('useReport', () => {
  it('gửi đúng payload báo cáo, và mất mạng thì vẫn gửi ngay chứ không nằm im', async () => {
    // Báo cáo không có cập nhật lạc quan nào để hoàn tác, nhưng vẫn cần
    // `networkMode: 'always'`: hoãn lại thì hộp báo cáo đứng im với nút đang
    // quay, người dùng đóng đi và tưởng đã báo cáo xong.
    let body: unknown = null;
    server.use(
      feedOk([]),
      baiVietOk(),
      binhLuanOk([]),
      http.post(`${BASE}/api/forum/reports`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ reportId: 'r1' }));
      }),
    );

    const { result } = await renderHookGhiBinhLuan();
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true));

    await act(async () => {
      onlineManager.setOnline(false);
    });
    try {
      await act(async () => {
        await result.current.baoCao.mutateAsync({
          targetType: 'COMMENT',
          targetId: 'c1',
          reasonType: 'SPAM',
        });
      });

      expect(body).toEqual({ targetType: 'COMMENT', targetId: 'c1', reasonType: 'SPAM' });
      expect(result.current.baoCao.isPaused).toBe(false);
      expect(result.current.baoCao.isSuccess).toBe(true);
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await nhuongMotNhip();
  });
});
