import { QueryClientProvider } from '@tanstack/react-query';
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function renderScreen() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
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

    renderScreen();

    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());
  });

  it('feed rỗng thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(
      http.get(`${BASE}/api/forum/topics`, () => HttpResponse.json(envelope([]))),
      http.get(`${BASE}/api/forum/feed`, () => HttpResponse.json(envelope(cursorPage([])))),
    );

    renderScreen();

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

    renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });
});
