/**
 * @file types.ts
 * @description DTO của nhánh thông báo, port từ source Java của backend
 * (`modules/notification/dto/response/NotificationResponse.java`,
 * `UnreadCountResponse.java`, `modules/notification/NotificationType.java`).
 *
 * `createdAt`/`readAt` là `Instant` — lên dây là UTC có hậu tố `Z`
 * (`"2026-06-24T04:45:00Z"`). Đọc bằng `features/notification/thoiGian.ts`, KHÔNG
 * in thẳng mặt đồng hồ của chuỗi (đó là giờ UTC, lệch 7 tiếng).
 */

/**
 * `NotificationType.java`. Backend gửi `type` dạng `String` (`.name()` của enum),
 * nên kiểu ở đây vẫn để ngỏ `string`: enum phía Java thêm giá trị mới thì app cũ
 * KHÔNG được vỡ — nó chỉ rơi về dáng mặc định.
 */
export type NotificationType =
  | 'MENTOR_VERIFICATION_APPROVED'
  | 'MENTOR_VERIFICATION_REJECTED'
  | 'MENTOR_VERIFICATION_NEEDS_REVISION'
  | 'BOOKING_REQUEST_CREATED'
  | 'BOOKING_ACCEPTED'
  | 'BOOKING_PAYMENT_CONFIRMED'
  | 'BOOKING_PAYMENT_EXPIRED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELLED_BY_MENTEE'
  | 'BOOKING_CANCELLED_BY_MENTOR'
  | 'BOOKING_AUTO_REJECTED'
  | 'BOOKING_REQUEST_EXPIRED'
  | 'BOOKING_RESCHEDULE_REQUESTED'
  | 'BOOKING_RESCHEDULE_ACCEPTED'
  | 'BOOKING_RESCHEDULE_REJECTED'
  | 'BOOKING_RESCHEDULE_EXPIRED'
  | 'MEETING_LINK_UPDATED'
  | 'GOOGLE_CALENDAR_SYNC_NOTICE'
  | 'SESSION_COMPLETED'
  | 'BOOKING_ISSUE_REPORTED'
  | 'BOOKING_ISSUE_RESPONSE_RECEIVED'
  | 'BOOKING_ISSUE_RESPONSE_REMINDER'
  | 'BOOKING_ISSUE_RESOLVED'
  | 'BOOKING_ISSUE_ADMIN_REVIEW_REQUIRED'
  | 'BOOKING_REMINDER'
  | 'FEEDBACK_PROMPT'
  | 'FEEDBACK_RECEIVED'
  | 'FORUM_POST_COMMENTED'
  | 'FORUM_COMMENT_REPLY'
  | 'FORUM_POST_HIDDEN'
  | 'FORUM_COMMENT_HIDDEN'
  | 'BLOG_POST_PUBLISHED'
  | 'CHAT_UNREAD'
  | 'ACCOUNT_UNLOCKED'
  | 'ADMIN_DISPUTE_SLA_BREACH'
  | 'BOOKING_ISSUE_RESOLUTION_REVERSED';

/**
 * `NotificationResponse.java`. `read` là `boolean` nguyên thuỷ (không bao giờ
 * null); mọi `String`/`UUID`/`Instant`/`Long` đóng hộp thì có thể null.
 *
 * `unreadCount` và `realtimeEventKind` CHỈ có nghĩa trong sự kiện realtime — REST
 * trả `null`. Đừng đọc badge từ đây, dùng `/unread-count`.
 */
export interface NotificationResponse {
  notificationId: string;
  type: NotificationType | (string & {});
  title: string | null;
  message: string | null;
  /** `BOOKING` | `CONVERSATION` | `FORUM_POST` | `BLOG_POST` | `MENTOR_VERIFICATION` | … */
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  /** Đường dẫn của bản WEB (`/bookings/…`, `/forum/posts/…`) — app không dùng */
  deepLink: string | null;
  actionType: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
  unreadCount: number | null;
  realtimeEventKind: string | null;
}

/** `UnreadCountResponse.java` — `long` nguyên thuỷ, không null */
export interface UnreadCountResponse {
  unreadCount: number;
}
