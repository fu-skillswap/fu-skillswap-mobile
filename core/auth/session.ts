/**
 * @file session.ts
 * @description Quản lý phần phiên đăng nhập nằm ở tầng native: refresh token do
 * backend phát qua cookie HttpOnly nên JavaScript không đọc được giá trị, chỉ
 * có thể yêu cầu hệ thống lưu bền, xoá, hoặc hỏi xem cookie còn tồn tại không.
 *
 * Backend đặt cookie với `Path=/api/auth`, vì vậy mọi truy vấn phải hỏi đúng
 * URL nằm dưới path đó.
 */

import CookieManager from '@preeternal/react-native-cookie-manager';
import { Platform } from 'react-native';

import { getEnv } from '@/core/config/env';

/** Tên cookie refresh token do backend đặt (RefreshTokenCookieProperties) */
export const REFRESH_COOKIE_NAME = 'skillswap_refresh_token';

/** URL dùng để truy vấn cookie, phải nằm dưới Path=/api/auth của backend */
function cookieScopeUrl(): string {
  return `${getEnv().apiUrl}/api/auth`;
}

/**
 * Ghi cookie đang giữ trong bộ nhớ xuống đĩa.
 * Trên Android, cookie chỉ sống qua lần khởi động lại app nếu được flush;
 * trên iOS hệ thống tự lưu nên đây là no-op.
 */
export async function persistSessionCookies(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await CookieManager.flush();
}

/** Xoá toàn bộ cookie — gọi sau khi `POST /api/auth/logout` trả về */
export async function clearSessionCookies(): Promise<void> {
  await CookieManager.clearAll();
}

/**
 * Kiểm tra refresh cookie còn nằm trong cookie store hay không.
 * Dùng cho spike R2 và màn hình chẩn đoán; luồng đăng nhập bình thường
 * vẫn dựa vào kết quả của `POST /api/auth/refresh`.
 */
export async function hasRefreshCookie(): Promise<boolean> {
  try {
    const cookies = await CookieManager.get(cookieScopeUrl());
    return Boolean(cookies?.[REFRESH_COOKIE_NAME]?.value);
  } catch {
    return false;
  }
}
