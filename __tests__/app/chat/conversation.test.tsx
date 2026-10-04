import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import { ChatScreen, MessagesScreen } from '@/features/chat';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, replace, push, canGoBack }),
    __mockRouter: { back, replace, push, canGoBack },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
let demKhoa = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `cmid-${(demKhoa += 1)}`,
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock; canGoBack: jest.Mock };
}>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function hoiThoai(id: string, ten: string, ghiDe: Record<string, unknown> = {}) {
  return {
    id,
    type: 'DIRECT',
    status: 'ACTIVE',
    otherUserId: `u-${id}`,
    otherUserName: ten,
    otherUserAvatarUrl: null,
    lastMessageContent: 'Tin cuối',
    lastMessageAt: '2026-10-04T14:04:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    unreadCount: 0,
    myLastReadSequence: 0,
    otherLastReadSequence: 0,
    messagingAccess: 'OPEN',
    canSendMessages: true,
    canUploadAttachments: true,
    canDownloadAttachments: true,
    readOnlyReason: null,
    messagingWindowEndsAt: null,
    postSessionChatPermanent: false,
    participantCount: 2,
    contextType: 'BOOKING',
    bookingId: null,
    courseId: null,
    courseTitle: null,
    mentorUserId: null,
    mentorName: null,
    mentorAvatarUrl: null,
    userActionMessage: null,
    retryable: false,
    ...ghiDe,
  };
}

function tin(id: string, sequence: number, isMine: boolean, content: string, createdAt = '2026-10-04T13:00:00Z') {
  return {
    id,
    sequence,
    conversationId: 'c1',
    senderId: isMine ? 'toi' : 'ban',
    senderName: null,
    messageType: 'TEXT',
    content,
    state: 'ACTIVE',
    version: 1,
    editedAt: null,
    deletedAt: null,
    isReadByOther: isMine ? true : null,
    attachments: [],
    createdAt,
    isMine,
  };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockRouter.push.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function hopThu(items: unknown[]) {
  return http.get(`${BASE}/api/me/conversations`, () =>
    HttpResponse.json(envelope({ items, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 })),
  );
}

describe('MessagesScreen', () => {
  it('liệt kê hội thoại với tên, tin cuối và số chưa đọc; chạm thì mở phòng chat', async () => {
    server.use(hopThu([hoiThoai('c1', 'Trần Minh Quân', { unreadCount: 2 }), hoiThoai('c2', 'Lê Thu Hà')]));

    await render(
      <QueryClientProvider client={queryClient}>
        <MessagesScreen thamDoMs={false} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(screen.getByTestId('chua-doc-c1')).toHaveTextContent('2');
    expect(screen.queryByTestId('chua-doc-c2')).toBeNull();

    await fireEvent.press(screen.getByTestId('hoi-thoai-c1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/c1');
  });

  it('ô tìm lọc tại chỗ, không phân biệt dấu', async () => {
    server.use(hopThu([hoiThoai('c1', 'Trần Minh Quân'), hoiThoai('c2', 'Lê Thu Hà')]));

    await render(
      <QueryClientProvider client={queryClient}>
        <MessagesScreen thamDoMs={false} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Lê Thu Hà')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('o-tim-hoi-thoai'), 'thu ha');

    expect(screen.queryByText('Trần Minh Quân')).toBeNull();
    expect(screen.getByText('Lê Thu Hà')).toBeTruthy();
  });

  it('hộp thư rỗng thì giải thích phòng chat mở khi nào và mời tìm mentor', async () => {
    server.use(hopThu([]));

    await render(
      <QueryClientProvider client={queryClient}>
        <MessagesScreen thamDoMs={false} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy());
    // Không có hàng Koko: chưa có API trợ lý AI nào để nối.
    expect(screen.queryByText(/Koko/)).toBeNull();
  });
});

describe('MessagesScreen — mở ngoài thanh tab (chế độ Mentor)', () => {
  it('có onBack thì hiện nút quay lại và bấm được', async () => {
    server.use(hopThu([]));
    const quayLai = jest.fn();

    await render(
      <QueryClientProvider client={queryClient}>
        <MessagesScreen thamDoMs={false} onBack={quayLai} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));
    expect(quayLai).toHaveBeenCalled();
  });

  it('ở tab Tin nhắn (không có onBack) thì không có nút quay lại', async () => {
    server.use(hopThu([]));

    await render(
      <QueryClientProvider client={queryClient}>
        <MessagesScreen thamDoMs={false} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy());

    expect(screen.queryByTestId('nut-quay-lai')).toBeNull();
  });
});

describe('ChatScreen', () => {
  async function moChat() {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatScreen conversationId="c1" thamDoMs={false} />
      </QueryClientProvider>,
    );
  }

  it('hiện tin đã SẮP theo sequence dù backend trả lộn thứ tự, và đánh dấu đã đọc tới tin mới nhất', async () => {
    const ghiNhan: { docToi: number | null } = { docToi: null };
    server.use(
      http.get(`${BASE}/api/me/conversations/c1`, () =>
        HttpResponse.json(envelope(hoiThoai('c1', 'Trần Minh Quân', { myLastReadSequence: 1 }))),
      ),
      http.get(`${BASE}/api/me/conversations/c1/messages`, () =>
        HttpResponse.json(envelope([tin('m3', 3, false, 'Ba'), tin('m1', 1, true, 'Một'), tin('m2', 2, false, 'Hai')])),
      ),
      http.patch(`${BASE}/api/me/conversations/c1/read`, async ({ request }) => {
        ghiNhan.docToi = ((await request.json()) as { lastReadSequence: number }).lastReadSequence;
        return HttpResponse.json(
          envelope({ conversationId: 'c1', myLastReadSequence: 3, otherLastReadSequence: 1, unreadCount: 0 }),
        );
      }),
    );

    await moChat();

    await waitFor(() => expect(screen.getByTestId('tin-m3')).toBeTruthy());
    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    await waitFor(() => expect(ghiNhan.docToi).toBe(3));
  });

  it('gửi tin kèm clientMessageId, xoá ô nhập khi thành công', async () => {
    const ghiNhan: { body: Record<string, unknown> | null } = { body: null };
    server.use(
      http.get(`${BASE}/api/me/conversations/c1`, () => HttpResponse.json(envelope(hoiThoai('c1', 'Trần Minh Quân')))),
      http.get(`${BASE}/api/me/conversations/c1/messages`, () => HttpResponse.json(envelope([]))),
      http.post(`${BASE}/api/me/conversations/c1/messages`, async ({ request }) => {
        ghiNhan.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope(tin('m9', 9, true, 'Chào anh')));
      }),
    );

    await moChat();
    await waitFor(() => expect(screen.getByTestId('o-nhap-tin')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('o-nhap-tin'), '  Chào anh  ');
    await fireEvent.press(screen.getByTestId('nut-gui-tin'));

    await waitFor(() => expect(ghiNhan.body).not.toBeNull());
    expect(ghiNhan.body).toMatchObject({ content: 'Chào anh', replyToMessageId: null, attachmentIntentIds: [] });
    expect(typeof ghiNhan.body?.clientMessageId).toBe('string');
    await waitFor(() => expect(screen.getByTestId('o-nhap-tin').props.value).toBe(''));
  });

  it('chat chỉ xem thì KHÔNG có ô nhập, hiện nguyên văn câu của backend', async () => {
    server.use(
      http.get(`${BASE}/api/me/conversations/c1`, () =>
        HttpResponse.json(
          envelope(
            hoiThoai('c1', 'Phạm Gia Bảo', {
              canSendMessages: false,
              messagingAccess: 'READ_ONLY',
              readOnlyReason: 'CHAT_WINDOW_EXPIRED',
              userActionMessage: 'Đã hết thời gian trao đổi sau buổi học.',
            }),
          ),
        ),
      ),
      http.get(`${BASE}/api/me/conversations/c1/messages`, () => HttpResponse.json(envelope([]))),
    );

    await moChat();

    await waitFor(() => expect(screen.getByTestId('dai-chi-xem')).toBeTruthy());
    expect(screen.getByText('Đã hết thời gian trao đổi sau buổi học.')).toBeTruthy();
    expect(screen.queryByTestId('o-nhap-tin')).toBeNull();
  });

  it('hội thoại gắn booking thì hiện thẻ ngữ cảnh buổi học', async () => {
    server.use(
      http.get(`${BASE}/api/me/conversations/c1`, () =>
        HttpResponse.json(envelope(hoiThoai('c1', 'Trần Minh Quân', { bookingId: 'b1' }))),
      ),
      http.get(`${BASE}/api/me/conversations/c1/messages`, () => HttpResponse.json(envelope([]))),
      http.get(`${BASE}/api/me/bookings/b1`, () => {
        return HttpResponse.json(envelope(taoBooking({ bookingId: 'b1', serviceTitle: 'Review CV 1:1' })));
      }),
    );

    await moChat();

    await waitFor(() => expect(screen.getByTestId('the-ngu-canh-buoi-hoc')).toBeTruthy());
    expect(screen.getByText(/Review CV 1:1/)).toBeTruthy();
  });
});
