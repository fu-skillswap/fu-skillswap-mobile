/**
 * @file appFocus.ts
 * @description Nối trạng thái tiền cảnh/hậu cảnh của app vào `focusManager` của
 * TanStack Query.
 *
 * Mặc định `focusManager` nghe sự kiện `visibilitychange` của trình duyệt — trên
 * React Native không có sự kiện đó, nên TanStack coi app LUÔN đang được focus:
 * - `refetchInterval` (thông báo, tin nhắn) vẫn bắn request khi app nằm dưới nền,
 *   tốn pin và dữ liệu di động của người dùng;
 * - quay lại app không có gì tải lại, dữ liệu cũ đứng yên tới lần kéo làm mới.
 *
 * Nối `AppState` vào thì cả hai cùng đúng: nền → `isFocused() === false` nên
 * polling tạm dừng (`refetchIntervalInBackground` mặc định là `false`); quay lại
 * → query cũ tự tải lại theo `refetchOnWindowFocus`.
 */

import { focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

/** Chỉ `active` mới là đang dùng app; `inactive` (iOS kéo Control Center) và `background` thì không */
export function laDangDungApp(status: AppStateStatus): boolean {
  return status === 'active';
}

/**
 * Đăng ký nghe `AppState` và báo cho `focusManager`.
 * @returns hàm huỷ đăng ký — trả `focusManager` về trạng thái mặc định
 */
export function setupFocusManager(): () => void {
  const subscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(laDangDungApp(status));
  });
  return () => {
    subscription.remove();
    focusManager.setFocused(undefined);
  };
}
