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
