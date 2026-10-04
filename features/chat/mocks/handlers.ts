/**
 * @file handlers.ts
 * @description Handler MSW cho nhánh chat — đúng hình dạng DTO thật
 * (`ConversationResponse`, `MessageResponse`, `CursorPageResponse`).
 *
 * Mốc thời gian sinh theo đồng hồ thật và lên dây là `Instant` UTC có `Z`, để
 * nhãn "21:04" / "T2" / "21/09" của hộp thư có đủ ba nhánh mà nhìn. Hội thoại thứ
 * ba ở chế độ chỉ xem (`CHAT_WINDOW_EXPIRED`) để dải "chỉ xem" có cái mà hiện.
 *
 * `let` chứ không `const`: gửi tin và đánh dấu đã đọc ghi thật vào kho, để tải
 * lại thấy đúng điều vừa làm.
 */

import { http } from 'msw';

import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import type { ConversationResponse, MessageResponse, SendMessageRequest } from '@/features/chat/types';

const base = getEnv().apiUrl;

function envelope(data: unknown) {
  return { timestamp: new Date().toISOString(), status: 200, code: 'SUCCESS_0200', message: 'Thành công', data };
}

function loi(status: number, code: string, message: string) {
  return jsonMock({ timestamp: new Date().toISOString(), status, code, message, data: null }, { status });
}

/** `Instant` UTC khuôn Jackson, cách "bây giờ" `phutTruoc` phút */
function instant(phutTruoc: number): string {
  return new Date(Date.now() - phutTruoc * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function hoiThoai(ghiDe: Partial<ConversationResponse> & { id: string; otherUserName: string }): ConversationResponse {
  return {
    type: 'DIRECT',
    status: 'ACTIVE',
    otherUserId: `u-${ghiDe.id}`,
    otherUserAvatarUrl: null,
    lastMessageContent: null,
    lastMessageAt: null,
    createdAt: instant(60 * 24 * 10),
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

function tinNhan(
  conversationId: string,
  sequence: number,
  isMine: boolean,
  content: string,
  phutTruoc: number,
  nguoiKia: string,
): MessageResponse {
  return {
    id: `${conversationId}-m${sequence}`,
    sequence,
    conversationId,
    senderId: isMine ? MOCK_USER.publicId : `u-${conversationId}`,
    senderName: isMine ? MOCK_USER.fullName : nguoiKia,
    messageType: 'TEXT',
    content,
    state: 'ACTIVE',
    version: 1,
    editedAt: null,
    deletedAt: null,
    isReadByOther: isMine ? true : null,
    attachments: [],
    createdAt: instant(phutTruoc),
    isMine,
  };
}

let MOCK_TIN: Record<string, MessageResponse[]> = {
  c1: [
    tinNhan('c1', 1, true, 'Anh ơi, em gửi trước đề bài System Design để anh xem qua ạ.', 60 * 26, 'Trần Minh Quân'),
    tinNhan('c1', 2, false, 'Ok em, anh đọc rồi. Phần thiết kế cache em làm khá ổn.', 60 * 25, 'Trần Minh Quân'),
    tinNhan('c1', 3, false, 'Tối nay 20:30 mình vào Meet nhé, em chuẩn bị thêm phần ước lượng tải.', 50, 'Trần Minh Quân'),
    tinNhan('c1', 4, false, 'Nhớ mang theo sơ đồ kiến trúc em vẽ hôm trước.', 45, 'Trần Minh Quân'),
  ],
  c2: [
    tinNhan('c2', 1, true, 'Chị ơi em gửi CV bản mới nhất ạ.', 60 * 24 * 2, 'Lê Thu Hà'),
    tinNhan('c2', 2, false, 'Chị xem rồi, phần dự án nên thêm số liệu kết quả em nhé.', 60 * 24 * 2 - 30, 'Lê Thu Hà'),
  ],
  c3: [
    tinNhan('c3', 1, false, 'Cảm ơn em đã để lại đánh giá!', 60 * 24 * 12, 'Phạm Gia Bảo'),
  ],
};

let MOCK_HOI_THOAI: ConversationResponse[] = [
  hoiThoai({
    id: 'c1',
    otherUserName: 'Trần Minh Quân',
    bookingId: 'b1',
    mentorUserId: 'm1',
    mentorName: 'Trần Minh Quân',
    unreadCount: 2,
    myLastReadSequence: 2,
    otherLastReadSequence: 1,
  }),
  hoiThoai({
    id: 'c2',
    otherUserName: 'Lê Thu Hà',
    bookingId: 'b2',
    mentorUserId: 'm2',
    mentorName: 'Lê Thu Hà',
    myLastReadSequence: 2,
    otherLastReadSequence: 1,
  }),
  hoiThoai({
    id: 'c3',
    otherUserName: 'Phạm Gia Bảo',
    messagingAccess: 'READ_ONLY',
    canSendMessages: false,
    canUploadAttachments: false,
    readOnlyReason: 'CHAT_WINDOW_EXPIRED',
    userActionMessage: 'Đã hết thời gian trao đổi sau buổi học. Đặt buổi mới để tiếp tục nhắn tin.',
    myLastReadSequence: 1,
  }),
];

/** Đồng bộ `lastMessage*` của hội thoại theo kho tin */
function capNhatTinCuoi(): void {
  MOCK_HOI_THOAI = MOCK_HOI_THOAI.map((h) => {
    const tin = MOCK_TIN[h.id] ?? [];
    const cuoi = tin[tin.length - 1];
    return cuoi ? { ...h, lastMessageContent: cuoi.content, lastMessageAt: cuoi.createdAt } : h;
  });
}
capNhatTinCuoi();

export const chatMockHandlers = [
  /** Đăng ký TRƯỚC `/:conversationId` để `unread-count` không bị coi là một id */
  http.get(`${base}/api/me/conversations/unread-count`, () =>
    jsonMock(envelope({ unreadCount: MOCK_HOI_THOAI.reduce((t, h) => t + h.unreadCount, 0) })),
  ),

  http.get(`${base}/api/me/conversations`, () => {
    const sapXep = [...MOCK_HOI_THOAI].sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    return jsonMock(
      envelope({ items: sapXep, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 }),
    );
  }),

  http.get(`${base}/api/me/conversations/:conversationId`, ({ params }) => {
    const h = MOCK_HOI_THOAI.find((x) => x.id === String(params.conversationId));
    return h ? jsonMock(envelope(h)) : loi(404, 'CHAT_4041', 'Không tìm thấy cuộc trò chuyện');
  }),

  http.get(`${base}/api/me/conversations/:conversationId/messages`, ({ params, request }) => {
    const id = String(params.conversationId);
    if (!MOCK_TIN[id]) {
      return loi(404, 'CHAT_4041', 'Không tìm thấy cuộc trò chuyện');
    }
    const sp = new URL(request.url).searchParams;
    const truoc = sp.get('beforeSequence');
    const limit = Number(sp.get('limit') ?? '30');
    const tin = MOCK_TIN[id].filter((t) => truoc === null || (t.sequence ?? 0) < Number(truoc));
    // Trả các tin MỚI NHẤT của cửa sổ, đảo thứ tự để chứng minh màn hình tự sắp.
    return jsonMock(envelope(tin.slice(-limit).reverse()));
  }),

  http.post(`${base}/api/me/conversations/:conversationId/messages`, async ({ params, request }) => {
    const id = String(params.conversationId);
    const h = MOCK_HOI_THOAI.find((x) => x.id === id);
    if (!h || !MOCK_TIN[id]) {
      return loi(404, 'CHAT_4041', 'Không tìm thấy cuộc trò chuyện');
    }
    if (!h.canSendMessages) {
      return loi(403, 'CHAT_4031', h.userActionMessage ?? 'Cuộc trò chuyện đang ở chế độ chỉ xem');
    }
    const body = (await request.json()) as Partial<SendMessageRequest>;
    if (!body.clientMessageId) {
      return loi(400, 'SYS_0001', 'clientMessageId là bắt buộc');
    }
    // Cùng `clientMessageId` thì trả lại tin cũ — đúng cách backend chống trùng.
    const daCo = MOCK_TIN[id].find((t) => t.id === `${id}-${body.clientMessageId}`);
    if (daCo) {
      return jsonMock(envelope(daCo));
    }
    const seq = MOCK_TIN[id].length + 1;
    const moi: MessageResponse = {
      ...tinNhan(id, seq, true, (body.content ?? '').trim(), 0, h.otherUserName ?? ''),
      id: `${id}-${body.clientMessageId}`,
      isReadByOther: false,
    };
    MOCK_TIN = { ...MOCK_TIN, [id]: [...MOCK_TIN[id], moi] };
    capNhatTinCuoi();
    return jsonMock(envelope(moi));
  }),

  http.patch(`${base}/api/me/conversations/:conversationId/read`, async ({ params, request }) => {
    const id = String(params.conversationId);
    const body = (await request.json()) as { lastReadSequence?: number };
    const h = MOCK_HOI_THOAI.find((x) => x.id === id);
    if (!h) {
      return loi(404, 'CHAT_4041', 'Không tìm thấy cuộc trò chuyện');
    }
    const docToi = Math.max(h.myLastReadSequence, body.lastReadSequence ?? 0);
    MOCK_HOI_THOAI = MOCK_HOI_THOAI.map((x) =>
      x.id === id ? { ...x, myLastReadSequence: docToi, unreadCount: 0 } : x,
    );
    return jsonMock(
      envelope({ conversationId: id, myLastReadSequence: docToi, otherLastReadSequence: h.otherLastReadSequence, unreadCount: 0 }),
    );
  }),
];
