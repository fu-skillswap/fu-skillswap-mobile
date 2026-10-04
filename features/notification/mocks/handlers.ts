/**
 * @file handlers.ts
 * @description Handler MSW cho nhánh thông báo — đúng hình dạng DTO thật
 * (`NotificationResponse`, `UnreadCountResponse`, `CursorPageResponse`).
 *
 * Mốc thời gian sinh theo đồng hồ thật, lên dây là `Instant` UTC có `Z`, để cả
 * hai nhóm "HÔM NAY" và "TRƯỚC ĐÓ" đều có cái mà nhìn. Có đủ bốn tông màu, một
 * dòng bấm được cho mỗi đích (booking, chat, bài diễn đàn) và một dòng KHÔNG có
 * đích (xác minh mentor) để thấy luật "không dựng nút chết".
 *
 * `let` chứ không `const`: đánh dấu đã đọc ghi thật vào kho, để tải lại thấy đúng
 * điều vừa làm.
 */

import { http } from 'msw';

import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import type { NotificationResponse } from '@/features/notification/types';

const base = getEnv().apiUrl;

function envelope(data: unknown) {
  return { timestamp: new Date().toISOString(), status: 200, code: 'SUCCESS_0200', message: 'Thành công', data };
}

/** `Instant` UTC khuôn Jackson, cách "bây giờ" `phutTruoc` phút */
function instant(phutTruoc: number): string {
  return new Date(Date.now() - phutTruoc * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function thongBao(
  ghiDe: Partial<NotificationResponse> & Pick<NotificationResponse, 'notificationId' | 'type' | 'title' | 'message'>,
  phutTruoc: number,
): NotificationResponse {
  return {
    relatedEntityType: null,
    relatedEntityId: null,
    deepLink: '',
    actionType: 'VIEW_DETAIL',
    read: false,
    readAt: null,
    createdAt: instant(phutTruoc),
    unreadCount: null,
    realtimeEventKind: null,
    ...ghiDe,
  };
}

function taoKho(): NotificationResponse[] {
  return [
    thongBao(
      {
        notificationId: 'n1',
        type: 'BOOKING_REMINDER',
        title: 'Sắp tới giờ học',
        message: 'Buổi Mock interview với Trần Minh Quân bắt đầu sau 30 phút.',
        relatedEntityType: 'BOOKING',
        relatedEntityId: 'b1',
        actionType: 'VIEW_BOOKING',
      },
      1,
    ),
    thongBao(
      {
        notificationId: 'n2',
        type: 'BOOKING_ACCEPTED',
        title: 'Mentor đã nhận lịch',
        message: 'Lê Thu Hà đã chấp nhận lịch Review CV 1:1 của bạn.',
        relatedEntityType: 'BOOKING',
        relatedEntityId: 'b2',
        actionType: 'VIEW_BOOKING',
      },
      20,
    ),
    thongBao(
      {
        notificationId: 'n3',
        type: 'CHAT_UNREAD',
        title: 'Tin nhắn mới',
        message: 'Trần Minh Quân đã gửi cho bạn 2 tin nhắn mới.',
        relatedEntityType: 'CONVERSATION',
        relatedEntityId: 'c1',
        actionType: 'OPEN_CHAT',
      },
      45,
    ),
    thongBao(
      {
        notificationId: 'n4',
        type: 'FORUM_POST_COMMENTED',
        title: 'Bình luận mới',
        message: 'Minh Đức đã bình luận bài viết của bạn.',
        relatedEntityType: 'FORUM_POST',
        relatedEntityId: 'p1',
        actionType: 'VIEW_FORUM_POST',
        read: true,
        readAt: instant(60 * 24 * 2),
      },
      60 * 24 * 2,
    ),
    thongBao(
      {
        notificationId: 'n5',
        type: 'BOOKING_CANCELLED_BY_MENTOR',
        title: 'Lịch đã bị huỷ',
        message: 'Phạm Gia Bảo đã huỷ buổi Định hướng nghề Data.',
        relatedEntityType: 'BOOKING',
        relatedEntityId: 'b3',
        actionType: 'VIEW_BOOKING',
        read: true,
        readAt: instant(60 * 24 * 5),
      },
      60 * 24 * 5,
    ),
    thongBao(
      {
        notificationId: 'n6',
        type: 'MENTOR_VERIFICATION_APPROVED',
        title: 'Hồ sơ mentor đã được duyệt',
        message: 'Chúc mừng! Bạn đã có thể nhận lịch từ mentee.',
        relatedEntityType: 'MENTOR_VERIFICATION',
        relatedEntityId: null,
        deepLink: '/mentor/verification',
        actionType: 'VIEW_MENTOR_VERIFICATION',
        read: true,
        readAt: instant(60 * 24 * 12),
      },
      60 * 24 * 12,
    ),
  ];
}

let MOCK_THONG_BAO = taoKho();

/** Đưa kho về ban đầu — chỉ dùng trong test */
export function __resetNotificationMockForTests(): void {
  MOCK_THONG_BAO = taoKho();
}

export const notificationMockHandlers = [
  http.get(`${base}/api/me/notifications/unread-count`, () =>
    jsonMock(envelope({ unreadCount: MOCK_THONG_BAO.filter((n) => !n.read).length })),
  ),

  http.get(`${base}/api/me/notifications`, () =>
    jsonMock(
      envelope({ items: MOCK_THONG_BAO, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 }),
    ),
  ),

  http.patch(`${base}/api/me/notifications/read-all`, () => {
    const luc = new Date().toISOString();
    MOCK_THONG_BAO = MOCK_THONG_BAO.map((n) => (n.read ? n : { ...n, read: true, readAt: luc }));
    return jsonMock({ timestamp: luc, status: 200, code: 'SUCCESS', message: 'Đánh dấu tất cả đã đọc thành công' });
  }),

  http.patch(`${base}/api/me/notifications/:id/read`, ({ params }) => {
    const luc = new Date().toISOString();
    const co = MOCK_THONG_BAO.some((n) => n.notificationId === params.id);
    if (!co) {
      return jsonMock(
        { timestamp: luc, status: 404, code: 'NOTIFICATION_4041', message: 'Không tìm thấy notification', data: null },
        { status: 404 },
      );
    }
    MOCK_THONG_BAO = MOCK_THONG_BAO.map((n) =>
      n.notificationId === params.id && !n.read ? { ...n, read: true, readAt: luc } : n,
    );
    return jsonMock({ timestamp: luc, status: 200, code: 'SUCCESS', message: 'Đánh dấu đã đọc thành công' });
  }),
];
