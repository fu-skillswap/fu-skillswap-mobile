/**
 * @file dichThongBao.ts
 * @description Luật thuần (không React) quyết định một thông báo trông thế nào,
 * bấm vào đi đâu, và rơi vào nhóm nào trên màn `Notifications.dc.html`.
 *
 * ## Vì sao điều hướng theo `relatedEntityType` chứ không theo `deepLink`
 *
 * `deepLink` backend trả là đường dẫn của bản WEB (`/bookings/<id>`,
 * `/forum/posts/<id>`, `/blog/posts/<id>`) — không trùng cây route của app
 * (`/forum/<id>`, `/mentor-booking/<id>`…). Đẩy nguyên chuỗi đó vào router sẽ ra
 * màn "không tìm thấy". Cặp `relatedEntityType` + `relatedEntityId` thì ổn định
 * và đủ để dựng đường dẫn của app.
 *
 * ## Luật "bấm được"
 *
 * Chỉ trả đích khi app CÓ màn tương ứng. Thông báo về blog, xác minh mentor,
 * tranh chấp… không có màn trên mobile, nên trả `null` — màn hình vẽ chúng như
 * một dòng chữ, không phải nút (mục 6 của quy ước: không dựng nút chết). Bài/bình
 * luận đã bị ẩn (`FORUM_*_HIDDEN`) cũng không dẫn đi đâu: mở ra chỉ gặp 404.
 */

import type { Href } from 'expo-router';

import type { AppRoleMode } from '@/core/config/tabs';
import { khoaNgay, nhanThoiGianHoiThoai } from '@/features/chat/thoiGian';
import type { NotificationResponse } from '@/features/notification/types';

/** Biểu tượng của một thông báo; màn hình ánh xạ sang icon Lucide */
export type BieuTuongThongBao = 'lich' | 'dong-ho' | 'tin-nhan' | 'binh-luan' | 'danh-gia' | 'xac-minh' | 'su-co' | 'bai-viet' | 'chuong';

/** Tông màu ô biểu tượng, đúng ba tông của thiết kế cộng một tông trung tính */
export type TongThongBao = 'thanh-cong' | 'chu-y' | 'thuong' | 'trung-tinh';

const THANH_CONG = new Set([
  'BOOKING_ACCEPTED',
  'BOOKING_PAYMENT_CONFIRMED',
  'BOOKING_RESCHEDULE_ACCEPTED',
  'SESSION_COMPLETED',
  'MENTOR_VERIFICATION_APPROVED',
  'BOOKING_ISSUE_RESOLVED',
  'ACCOUNT_UNLOCKED',
]);

/** Cần người dùng làm gì đó, hoặc sắp tới giờ */
const CHU_Y = new Set([
  'BOOKING_REMINDER',
  'BOOKING_REQUEST_CREATED',
  'BOOKING_RESCHEDULE_REQUESTED',
  'BOOKING_ISSUE_REPORTED',
  'BOOKING_ISSUE_RESPONSE_RECEIVED',
  'BOOKING_ISSUE_RESPONSE_REMINDER',
  'BOOKING_ISSUE_ADMIN_REVIEW_REQUIRED',
  'MENTOR_VERIFICATION_NEEDS_REVISION',
  'FEEDBACK_PROMPT',
  'GOOGLE_CALENDAR_SYNC_NOTICE',
  'ADMIN_DISPUTE_SLA_BREACH',
]);

/** Một việc đã kết thúc theo hướng không như mong muốn */
const TRUNG_TINH = new Set([
  'BOOKING_PAYMENT_EXPIRED',
  'BOOKING_REJECTED',
  'BOOKING_CANCELLED_BY_MENTEE',
  'BOOKING_CANCELLED_BY_MENTOR',
  'BOOKING_AUTO_REJECTED',
  'BOOKING_REQUEST_EXPIRED',
  'BOOKING_RESCHEDULE_REJECTED',
  'BOOKING_RESCHEDULE_EXPIRED',
  'MENTOR_VERIFICATION_REJECTED',
  'FORUM_POST_HIDDEN',
  'FORUM_COMMENT_HIDDEN',
  'BOOKING_ISSUE_RESOLUTION_REVERSED',
]);

export function tongThongBao(type: string): TongThongBao {
  if (THANH_CONG.has(type)) {
    return 'thanh-cong';
  }
  if (CHU_Y.has(type)) {
    return 'chu-y';
  }
  if (TRUNG_TINH.has(type)) {
    return 'trung-tinh';
  }
  return 'thuong';
}

export function bieuTuongThongBao(type: string): BieuTuongThongBao {
  if (type === 'BOOKING_REMINDER') {
    return 'dong-ho';
  }
  if (type.startsWith('BOOKING_ISSUE_') || type === 'ADMIN_DISPUTE_SLA_BREACH') {
    return 'su-co';
  }
  if (
    type.startsWith('BOOKING_') ||
    type === 'MEETING_LINK_UPDATED' ||
    type === 'SESSION_COMPLETED' ||
    type === 'GOOGLE_CALENDAR_SYNC_NOTICE'
  ) {
    return 'lich';
  }
  if (type === 'CHAT_UNREAD') {
    return 'tin-nhan';
  }
  if (type.startsWith('FORUM_')) {
    return 'binh-luan';
  }
  if (type.startsWith('FEEDBACK_')) {
    return 'danh-gia';
  }
  if (type.startsWith('MENTOR_VERIFICATION_')) {
    return 'xac-minh';
  }
  if (type === 'BLOG_POST_PUBLISHED') {
    return 'bai-viet';
  }
  return 'chuong';
}

/**
 * Đường dẫn trong app mà thông báo dẫn tới; `null` = không bấm được.
 *
 * Booking có HAI đích tuỳ chế độ đang xem: chế độ Mentor có màn chi tiết booking
 * (`/mentor-booking/<id>`), còn bên Mentee chưa có màn chi tiết nên dẫn về tab
 * Lịch hẹn. Không đoán phía nào từ `type`: cùng một `BOOKING_RESCHEDULE_*` có thể
 * gửi cho cả hai phía.
 */
export function dichThongBao(n: NotificationResponse, cheDo: AppRoleMode | null): Href | null {
  const id = n.relatedEntityId;
  if (!id) {
    return null;
  }
  switch ((n.relatedEntityType ?? '').toUpperCase()) {
    case 'CONVERSATION':
      return `/chat/${id}`;
    case 'FORUM_POST':
      return n.type === 'FORUM_POST_HIDDEN' || n.type === 'FORUM_COMMENT_HIDDEN' ? null : `/forum/${id}`;
    case 'BOOKING':
      return cheDo === 'MENTOR' ? `/mentor-booking/${id}` : '/(tabs)/bookings';
    default:
      return null;
  }
}

/** Nội dung một dòng: ưu tiên `message` (câu đầy đủ), không có thì `title` */
export function noiDungThongBao(n: NotificationResponse): { tieuDe: string | null; moTa: string } {
  const tieuDe = n.title?.trim() || null;
  const moTa = n.message?.trim() || tieuDe || 'Thông báo mới';
  return { tieuDe: tieuDe && tieuDe !== moTa ? tieuDe : null, moTa };
}

export interface NhomThongBao {
  /** `"HÔM NAY"` hoặc `"TRƯỚC ĐÓ"`, đúng nhãn của thiết kế */
  title: string;
  data: NotificationResponse[];
}

/**
 * Chia danh sách (đã theo thứ tự backend trả, mới nhất trước) thành hai nhóm của
 * thiết kế. "Hôm nay" tính theo NGÀY LỊCH giờ Việt Nam, không theo 24 giờ gần
 * nhất. Thông báo không đọc được giờ rơi vào "TRƯỚC ĐÓ". Nhóm rỗng bị bỏ.
 */
export function nhomThongBao(ds: readonly NotificationResponse[], bayGioMs: number = Date.now()): NhomThongBao[] {
  const homNay = khoaNgay(new Date(bayGioMs).toISOString());
  const nay: NotificationResponse[] = [];
  const truoc: NotificationResponse[] = [];
  for (const n of ds) {
    (homNay !== null && khoaNgay(n.createdAt) === homNay ? nay : truoc).push(n);
  }
  return [
    { title: 'HÔM NAY', data: nay },
    { title: 'TRƯỚC ĐÓ', data: truoc },
  ].filter((nhom) => nhom.data.length > 0);
}

/** Nhãn giờ: hôm nay `"20:00"`, trong tuần `"T2"`, xa hơn `"28/09"` */
export function nhanThoiGianThongBao(n: NotificationResponse, bayGioMs: number = Date.now()): string | null {
  return nhanThoiGianHoiThoai(n.createdAt, bayGioMs);
}
