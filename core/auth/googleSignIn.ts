/**
 * @file googleSignIn.ts
 * @description Bọc thư viện Google Sign-In native sau một interface hẹp.
 * Backend chỉ chấp nhận ID Token có `aud` đúng bằng GOOGLE_CLIENT_ID (web client),
 * nên `webClientId` là thứ bắt buộc phải đúng — nó quyết định `aud` của token.
 *
 * Bản miễn phí của thư viện không hỗ trợ `nonce` (SignInParams chỉ có `loginHint`),
 * nên ID Token lấy được KHÔNG mang claim `nonce`. Backend phải bỏ bước so khớp
 * claim đó cho đường mobile; mobile vẫn xin và vẫn gửi nonce trong body để backend
 * giữ được cơ chế cấp–đốt nonce một lần. Xem docs/be-change-requests/.
 *
 * Phần còn lại của app chỉ biết tới `getGoogleIdToken()`.
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { getEnv } from '@/core/config/env';

/** Người dùng chủ động huỷ hộp thoại đăng nhập — không phải lỗi hệ thống */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Người dùng đã huỷ đăng nhập Google');
    this.name = 'GoogleSignInCancelledError';
  }
}

/** Cấu hình thư viện; gọi một lần khi app khởi động */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    // webClientId quyết định `aud` của ID Token, phải trùng GOOGLE_CLIENT_ID của backend.
    webClientId: getEnv().googleWebClientId,
    offlineAccess: false,
  });
}

/** Nhận biết lỗi huỷ đăng nhập ở cả dạng phản hồi mới lẫn mã lỗi cũ */
function isCancellation(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { type?: string; code?: string };
  return candidate.type === 'cancelled' || candidate.code === statusCodes.SIGN_IN_CANCELLED;
}

/**
 * Mở hộp thoại đăng nhập Google và lấy ID Token.
 * Token không mang claim `nonce` — thư viện miễn phí không hỗ trợ; backend xử lý
 * chống replay bằng cơ chế khác (xem docs/be-change-requests/).
 * @throws GoogleSignInCancelledError nếu người dùng huỷ
 * @throws Error nếu không lấy được ID Token
 */
export async function getGoogleIdToken(): Promise<string> {
  let response: unknown;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (error) {
    if (isCancellation(error)) {
      throw new GoogleSignInCancelledError();
    }
    throw error;
  }

  if (isCancellation(response)) {
    throw new GoogleSignInCancelledError();
  }

  // Bản mới trả { type, data }, bản cũ trả thẳng User — đọc được cả hai.
  const candidate = response as { idToken?: string | null; data?: { idToken?: string | null } };
  const idToken = candidate.data?.idToken ?? candidate.idToken;
  if (!idToken) {
    throw new Error('Không lấy được Google ID token');
  }
  return idToken;
}

/** Đăng xuất khỏi phiên Google trên máy */
export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
}
