import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { forumRepo } from '@/features/forum/forumRepo';

const BASE = 'https://api.skillswap.asia';

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

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('forumRepo (đọc)', () => {
  it('lấy danh sách chủ đề', async () => {
    server.use(
      http.get(`${BASE}/api/forum/topics`, () =>
        HttpResponse.json(
          envelope([{ id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 }]),
        ),
      ),
    );

    const topics = await forumRepo.getTopics();

    expect(topics).toHaveLength(1);
    expect(topics[0]?.nameVi).toBe('Hỏi đáp');
  });

  it('feed truyền cursor và limit đúng tên query param', async () => {
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/forum/feed`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(cursorPage([], 'c2')));
      }),
    );

    await forumRepo.getFeed({ cursor: 'c1', limit: 10 });

    expect(seen?.get('cursor')).toBe('c1');
    expect(seen?.get('limit')).toBe('10');
  });

  it('getPosts gửi keyword, forumTopicId và mine', async () => {
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/forum/posts`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(cursorPage([])));
      }),
    );

    await forumRepo.getPosts({ keyword: 'spring', forumTopicId: 't1', mine: true });

    expect(seen?.get('keyword')).toBe('spring');
    expect(seen?.get('forumTopicId')).toBe('t1');
    expect(seen?.get('mine')).toBe('true');
  });

  it('getPosts bỏ hẳn tham số rỗng thay vì gửi chuỗi trống', async () => {
    // Gửi `keyword=` làm backend hiểu là "tìm chuỗi rỗng" thay vì "không lọc".
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/forum/posts`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(cursorPage([])));
      }),
    );

    await forumRepo.getPosts({ keyword: '', forumTopicId: undefined });

    expect(seen?.has('keyword')).toBe(false);
    expect(seen?.has('forumTopicId')).toBe(false);
  });

  it('giữ lại tham số có giá trị false hoặc 0, không gộp chung với tham số rỗng', async () => {
    // `cleanParams` phải lọc theo `undefined`/chuỗi rỗng, KHÔNG theo tính truthy.
    // Nếu ai đó rút gọn thành `if (value)`, `mine=false` và `limit=0` sẽ bị âm
    // thầm vứt đi — backend nhận thiếu tham số và trả về tập dữ liệu khác hẳn,
    // mà không test nào cũ bắt được vì chúng chỉ dùng `mine: true` và chuỗi rỗng.
    let seen = null as URLSearchParams | null;
    server.use(
      http.get(`${BASE}/api/forum/posts`, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(cursorPage([])));
      }),
    );

    await forumRepo.getPosts({ mine: false, limit: 0 });

    expect(seen?.get('mine')).toBe('false');
    expect(seen?.get('limit')).toBe('0');
  });

  it('lấy chi tiết bài viết', async () => {
    server.use(
      http.get(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope({ postId: 'p1', title: 'Bài 1' })),
      ),
    );

    await expect(forumRepo.getPost('p1')).resolves.toMatchObject({ postId: 'p1' });
  });

  it('lấy bình luận của một bài', async () => {
    server.use(
      http.get(`${BASE}/api/forum/posts/p1/comments`, () =>
        HttpResponse.json(envelope(cursorPage([{ commentId: 'c1' }]))),
      ),
    );

    const page = await forumRepo.getComments('p1', {});

    expect(page.items).toHaveLength(1);
  });
});

describe('forumRepo (reaction)', () => {
  it('thả like bài viết gửi PUT kèm reactionType LIKE', async () => {
    let body: unknown = null;
    server.use(
      http.put(`${BASE}/api/forum/posts/p1/reaction`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ postId: 'p1', reactedByCurrentUser: true }));
      }),
    );

    await forumRepo.likePost('p1');

    expect(body).toEqual({ reactionType: 'LIKE' });
  });

  it('bỏ like bài viết gửi DELETE', async () => {
    let called = 0;
    server.use(
      http.delete(`${BASE}/api/forum/posts/p1/reaction`, () => {
        called += 1;
        return HttpResponse.json(envelope({ postId: 'p1', reactedByCurrentUser: false }));
      }),
    );

    await forumRepo.unlikePost('p1');

    expect(called).toBe(1);
  });

  it('thả like bình luận gửi PUT tới đúng đường dẫn comment', async () => {
    let body: unknown = null;
    server.use(
      http.put(`${BASE}/api/forum/comments/c1/reaction`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ commentId: 'c1', reactedByCurrentUser: true }));
      }),
    );

    await forumRepo.likeComment('c1');

    expect(body).toEqual({ reactionType: 'LIKE' });
  });

  it('bỏ like bình luận gửi DELETE', async () => {
    let called = 0;
    server.use(
      http.delete(`${BASE}/api/forum/comments/c1/reaction`, () => {
        called += 1;
        return HttpResponse.json(envelope({ commentId: 'c1', reactedByCurrentUser: false }));
      }),
    );

    await forumRepo.unlikeComment('c1');

    expect(called).toBe(1);
  });
});

describe('forumRepo (ghi bài viết)', () => {
  it('tạo bài gửi POST kèm đúng payload upsert', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/api/forum/posts`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ postId: 'p9' }));
      }),
    );

    await forumRepo.createPost({ title: 'Tiêu đề', content: 'Nội dung', forumTopicId: 't1' });

    expect(body).toEqual({ title: 'Tiêu đề', content: 'Nội dung', forumTopicId: 't1' });
  });

  it('sửa bài gửi PUT tới đúng postId và giữ nguyên payload', async () => {
    let body: unknown = null;
    let duongDan = '';
    server.use(
      http.put(`${BASE}/api/forum/posts/:postId`, async ({ request, params }) => {
        duongDan = String(params.postId);
        body = await request.json();
        return HttpResponse.json(envelope({ postId: 'p1' }));
      }),
    );

    await forumRepo.updatePost('p1', { title: 'T moi', content: 'C moi', forumTopicId: 't2' });

    expect(duongDan).toBe('p1');
    expect(body).toEqual({ title: 'T moi', content: 'C moi', forumTopicId: 't2' });
  });

  it('xoá bài gửi DELETE tới đúng postId', async () => {
    let duongDan = '';
    server.use(
      http.delete(`${BASE}/api/forum/posts/:postId`, ({ params }) => {
        duongDan = String(params.postId);
        return HttpResponse.json(envelope({ postId: 'p1' }));
      }),
    );

    await forumRepo.deletePost('p1');

    expect(duongDan).toBe('p1');
  });
});

describe('forumRepo (bình luận và báo cáo)', () => {
  it('tạo bình luận gửi POST tới đúng bài kèm replyToCommentId', async () => {
    let body: unknown = null;
    let duongDan = '';
    server.use(
      http.post(`${BASE}/api/forum/posts/:postId/comments`, async ({ request, params }) => {
        duongDan = String(params.postId);
        body = await request.json();
        return HttpResponse.json(envelope({ commentId: 'c9' }));
      }),
    );

    await forumRepo.createComment('p1', { content: 'Nội dung', replyToCommentId: 'c1' });

    expect(duongDan).toBe('p1');
    expect(body).toEqual({ content: 'Nội dung', replyToCommentId: 'c1' });
  });

  it('gửi báo cáo vi phạm kèm nguyên vẹn lý do và mô tả', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/api/forum/reports`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ reportId: 'r1' }));
      }),
    );

    await forumRepo.createReport({
      targetType: 'COMMENT',
      targetId: 'c1',
      reasonType: 'SPAM',
      description: 'Quảng cáo rác',
    });

    expect(body).toEqual({
      targetType: 'COMMENT',
      targetId: 'c1',
      reasonType: 'SPAM',
      description: 'Quảng cáo rác',
    });
  });
});
