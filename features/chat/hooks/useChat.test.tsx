import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { useConversations, useMessages } from '@/features/chat/hooks/useChat';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function trang(items: unknown[], nextCursor: string | null) {
  return { items, nextCursor, prevCursor: null, hasNext: nextCursor !== null, hasPrev: false, limit: 20 };
}

function tin(sequence: number) {
  return {
    id: `m${sequence}`,
    sequence,
    conversationId: 'c1',
    senderId: 'ban',
    senderName: null,
    messageType: 'TEXT',
    content: `tin ${sequence}`,
    state: 'ACTIVE',
    version: 1,
    editedAt: null,
    deletedAt: null,
    isReadByOther: null,
    attachments: [],
    createdAt: '2026-10-04T13:00:00Z',
    isMine: false,
  };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('chốt chặn tải trang kế nằm TRONG hook chat', () => {
  it('useConversations: hai lần gọi taiTrangKe cùng một tick chỉ xin trang kế MỘT lần', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/conversations`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(envelope(trang([], cursor === null ? 'trang-2' : null)));
      }),
    );

    const { result } = await renderHook(() => useConversations(false), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(cursors).toEqual([null, 'trang-2']);
  });

  it('useMessages: hai lần gọi taiTrangKe cùng một tick chỉ xin tin cũ hơn MỘT lần', async () => {
    const truoc: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/api/me/conversations/c1/messages`, ({ request }) => {
        const before = new URL(request.url).searchParams.get('beforeSequence');
        truoc.push(before);
        // Trang đầu đủ 30 tin (60..31) để còn trang kế; trang sau rỗng là hết.
        const items = before === null ? Array.from({ length: 30 }, (_, i) => tin(60 - i)) : [];
        return HttpResponse.json(envelope(items));
      }),
    );

    const { result } = await renderHook(() => useMessages('c1', false), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      result.current.taiTrangKe();
      result.current.taiTrangKe();
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(truoc).toEqual([null, '31']);
  });
});
