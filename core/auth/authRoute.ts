/**
 * @file authRoute.ts
 * @description Suy ra kết quả điều hướng từ trạng thái phiên đăng nhập — hàm
 * thuần, không import React lẫn `expo-router`. `app/index.tsx`,
 * `app/(auth)/login.tsx` và `app/(tabs)/_layout.tsx` đều gọi
 * `resolveAuthRoute()` thay vì tự suy luận riêng, để ba màn hình không thể
 * "bất đồng" với nhau về việc ai nên điều hướng đi đâu.
 *
 * Đây chính là chỗ vòng lặp redirect vô hạn (Critical, đợt review cuối) sinh
 * ra: login.tsx redirect thẳng sang (tabs) mỗi khi `status === 'authenticated'`,
 * còn (tabs)/_layout.tsx lại redirect ngược về login mỗi khi vai trò không
 * được mobile hỗ trợ — với tài khoản ADMIN/SYSTEM_ADMIN, cả hai điều kiện cùng
 * đúng, hai màn hình đẩy nhau qua lại không dừng. Gộp quyết định vào một hàm
 * duy nhất khiến trạng thái "đã đăng nhập nhưng vai trò không hỗ trợ" phải có
 * tên riêng (`unsupported`) và không thể bị hai màn hình xử lý mâu thuẫn.
 */

import type { AuthStatus } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';
import { isMobileSupportedAccount } from '@/core/config/tabs';

/**
 * Kết quả điều hướng suy ra từ trạng thái phiên.
 * `unsupported` PHẢI là trạng thái cuối (terminal) — không màn hình nào được
 * render `<Redirect>` khi ở trạng thái này, xem `app/(auth)/unsupported-account.tsx`.
 */
export type AuthRoute =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'tabs' }
  | { kind: 'unsupported' };

/**
 * Suy ra màn hình cần hiển thị từ trạng thái phiên đăng nhập.
 * - `loading`: đang chờ kết quả refresh lúc khởi động (hoặc chưa resolve) — chưa được điều hướng đi đâu.
 * - `login`: chưa đăng nhập, hoặc `status === 'authenticated'` mà thiếu hồ sơ user (coi như phiên hỏng).
 * - `tabs`: đã đăng nhập với vai trò mobile phục vụ (MENTEE và/hoặc MENTOR).
 * - `unsupported`: đã đăng nhập nhưng vai trò không được mobile phục vụ (chỉ có ADMIN/SYSTEM_ADMIN).
 */
export function resolveAuthRoute(status: AuthStatus, user: UserMeResponse | null): AuthRoute {
  if (status === 'loading') {
    return { kind: 'loading' };
  }
  if (status !== 'authenticated' || !user) {
    return { kind: 'login' };
  }
  return isMobileSupportedAccount(user.roles) ? { kind: 'tabs' } : { kind: 'unsupported' };
}
