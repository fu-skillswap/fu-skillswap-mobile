/**
 * @file authRepo.ts
 * @description Các API xác thực, giữ đúng tên hàm của
 * `fu-skillswap-fe-2/src/repositories/authRepo.ts` để đối chiếu hai bên dễ dàng.
 */

import { apiClient, setAccessToken } from '@/core/api/client';
import type {
  GoogleLoginNonceResponse,
  GoogleLoginRequest,
  TokenResponse,
  UserMeResponse,
} from '@/core/auth/types';

export const authRepo = {
  /** Lấy nonce dùng một lần cho Google Sign-In */
  getGoogleNonce() {
    return apiClient<GoogleLoginNonceResponse>('/api/auth/google/nonce');
  },

  /**
   * Gửi Google ID Token kèm nonce lên backend và lưu access token nhận được.
   * Refresh token do backend đặt trong cookie HttpOnly, tầng native tự giữ.
   *
   * Gọi `/api/auth/google/mobile`, KHÔNG PHẢI `/api/auth/google` mà web dùng.
   * Lý do: thư viện Google Sign-In miễn phí trên mobile không đưa được claim
   * `nonce` vào ID Token, nên backend cần một đường riêng bỏ đúng bước so khớp
   * claim đó (xem `docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md`).
   * Request body và cơ chế cấp/đốt nonce một lần giữ nguyên như web. Endpoint
   * này CHƯA tồn tại trên backend thật tại thời điểm viết — đây là quyết định
   * đã chốt, không phải lỗi cần "sửa" về `/api/auth/google`.
   */
  async loginWithGoogle(input: GoogleLoginRequest) {
    const token = await apiClient<TokenResponse>('/api/auth/google/mobile', {
      method: 'POST',
      data: input,
    });
    setAccessToken(token.accessToken);
    return token;
  },

  /** Lấy thông tin người dùng đang đăng nhập */
  getMe() {
    return apiClient<UserMeResponse>('/api/auth/me');
  },

  /** Thu hồi phiên ở backend rồi xoá access token trong bộ nhớ */
  async logout() {
    try {
      await apiClient<null>('/api/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
    }
  },
};
