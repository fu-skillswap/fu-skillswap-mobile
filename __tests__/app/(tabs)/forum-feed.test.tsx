import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import { ForumFeedScreen } from '@/features/forum';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function cursorPage(items: unknown[]) {
  return { items, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 };
}

const POST = {
  postId: 'p1',
  authorUserId: 'u1',
  authorFullName: 'Nguyen Van A',
  authorAvatarUrl: '',
  authorProgram: null,
  forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
  title: 'Học Spring Boot từ đâu?',
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
});
afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/**
 * `render` cua @testing-library/react-native@14 la HAM ASYNC — phai await.
 * Goi ma khong await se de lan render dau ra ngoai pham vi act(), khien React
 * canh bao "An update to ForumFeedScreen inside a test was not wrapped in act(...)".
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
      http.get(`${BASE}/api/forum/topics`, () => HttpResponse.json(envelope([]))),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([POST])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());
  });

  it('feed rỗng thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(
      http.get(`${BASE}/api/forum/topics`, () => HttpResponse.json(envelope([]))),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bài viết nào')).toBeTruthy());
  });

  it('feed lỗi 500 thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/forum/topics`, () => HttpResponse.json(envelope([]))),
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
});
