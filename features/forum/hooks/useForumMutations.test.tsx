import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
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
