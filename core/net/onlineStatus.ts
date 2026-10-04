/**
 * @file onlineStatus.ts
 * @description Trạng thái kết nối mạng, quy về một câu hỏi duy nhất cho giao diện:
 * "có đang mất mạng không".
 *
 * `NetworkState` của expo-network có mọi trường optional. Ngay sau khi mở app,
 * hệ thống chưa kịp trả trạng thái nên các trường đều `undefined` — chỉ kết luận
 * mất mạng khi có giá trị `false` tường minh, nếu không banner sẽ nháy đỏ dù
 * mạng vẫn tốt.
 */

import { onlineManager } from '@tanstack/react-query';
import { addNetworkStateListener, useNetworkState } from 'expo-network';

/** Phần của `NetworkState` mà app thực sự dùng */
export interface NetworkStateLike {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

/** Chỉ `false` tường minh mới là mất mạng; `undefined` nghĩa là chưa biết */
export function isExplicitlyOffline(state: NetworkStateLike): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

/** Hook cho giao diện: app có đang mất mạng không */
export function useIsOffline(): boolean {
  return isExplicitlyOffline(useNetworkState());
}

/**
 * Nối trạng thái mạng vào `onlineManager` của TanStack Query để query tự tạm
 * dừng khi mất mạng và tự chạy lại khi có mạng trở lại.
 * @returns hàm huỷ đăng ký listener
 */
export function setupOnlineManager(): () => void {
  const subscription = addNetworkStateListener((event) => {
    onlineManager.setOnline(!isExplicitlyOffline(event));
  });
  return () => subscription.remove();
}
