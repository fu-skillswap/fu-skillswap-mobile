/**
 * @file notificationRepo.ts
 * @description Gọi REST của nhánh thông báo (`NotificationController.java`,
 * `/api/me/notifications`). Realtime (STOMP `/user/queue/notifications`) CHƯA
 * dùng ở bản mobile — cùng lý do với nhánh chat, xem `features/chat/chatRepo.ts`.
 */

import { apiClient } from '@/core/api/client';
import type { CursorPageResponse } from '@/core/api/pagination';
import type { NotificationResponse, UnreadCountResponse } from '@/features/notification/types';

export const notificationRepo = {
  /** Danh sách thông báo, mới nhất trước. `cursor` là chuỗi mờ backend trả */
  getNotifications(cursor?: string | null, limit = 20) {
    return apiClient<CursorPageResponse<NotificationResponse>>('/api/me/notifications', {
      params: cursor ? { cursor, limit } : { limit },
    });
  },

  getUnreadCount() {
    return apiClient<UnreadCountResponse>('/api/me/notifications/unread-count');
  },

  /** Backend trả `ApiResponse<Void>` — không có `data` để đọc */
  markRead(notificationId: string) {
    return apiClient<null>(`/api/me/notifications/${notificationId}/read`, { method: 'PATCH' });
  },

  /** Chỉ nhận PATCH — xem JSDoc của `markAllAsRead` phía Java */
  markAllRead() {
    return apiClient<null>('/api/me/notifications/read-all', { method: 'PATCH' });
  },
};
