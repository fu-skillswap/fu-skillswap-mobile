/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của nhánh chat bằng REPO THẬT, để fixture sai
 * hình dạng DTO lộ ra ngay ở đây thay vì trên máy.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { chatRepo } from '@/features/chat/chatRepo';
import { chatMockHandlers } from '@/features/chat/mocks/handlers';
import { gioTinNhan } from '@/features/chat/thoiGian';

const server = setupServer(...chatMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('handler mock của nhánh chat', () => {
  it('hộp thư là CursorPageResponse, mốc thời gian là Instant đọc được', async () => {
    const trang = await chatRepo.getConversations();

    expect(trang.items.length).toBeGreaterThan(0);
    expect(typeof trang.hasNext).toBe('boolean');
    for (const h of trang.items) {
      expect(typeof h.unreadCount).toBe('number');
      expect(typeof h.canSendMessages).toBe('boolean');
      expect(gioTinNhan(h.lastMessageAt)).not.toBeNull();
    }
  });

  it('có ít nhất một hội thoại chỉ xem kèm câu giải thích của backend', async () => {
    const trang = await chatRepo.getConversations();
    const chiXem = trang.items.find((h) => !h.canSendMessages);

    expect(chiXem?.readOnlyReason).toBeTruthy();
    expect(chiXem?.userActionMessage).toBeTruthy();
  });

  it('gửi lại cùng clientMessageId KHÔNG tạo tin thứ hai', async () => {
    const truoc = await chatRepo.getMessages('c2');
    const yeuCau = {
      clientMessageId: 'cmid-1',
      content: 'Chào chị',
      replyToMessageId: null,
      attachmentIntentIds: [],
    };

    const lan1 = await chatRepo.sendMessage('c2', yeuCau);
    const lan2 = await chatRepo.sendMessage('c2', yeuCau);
    const sau = await chatRepo.getMessages('c2');

    expect(lan2.id).toBe(lan1.id);
    expect(sau.length).toBe(truoc.length + 1);
    expect(lan1.isMine).toBe(true);
  });

  it('gửi vào hội thoại chỉ xem bị từ chối 403', async () => {
    const trang = await chatRepo.getConversations();
    const chiXem = trang.items.find((h) => !h.canSendMessages);

    await expect(
      chatRepo.sendMessage(chiXem?.id ?? '', {
        clientMessageId: 'cmid-2',
        content: 'x',
        replyToMessageId: null,
        attachmentIntentIds: [],
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('đánh dấu đã đọc đưa unreadCount về 0', async () => {
    const trang = await chatRepo.getConversations();
    const coChuaDoc = trang.items.find((h) => h.unreadCount > 0);

    const kq = await chatRepo.markRead(coChuaDoc?.id ?? '', 99);

    expect(kq.unreadCount).toBe(0);
    const sau = await chatRepo.getConversation(coChuaDoc?.id ?? '');
    expect(sau.unreadCount).toBe(0);
  });
});
