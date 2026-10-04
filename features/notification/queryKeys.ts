/** Khoá TanStack Query của nhánh thông báo */
export const notificationKeys = {
  all: ['notification'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};
