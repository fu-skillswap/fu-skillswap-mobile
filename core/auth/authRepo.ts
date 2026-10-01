/**
 * @file authRepo.ts
 * @description Các API xác thực, giữ đúng tên hàm của
 * `fu-skillswap-fe-2/src/repositories/authRepo.ts` để đối chiếu hai bên dễ dàng.
 *
 * Đây cũng là nơi gắn chu kỳ sống của refresh token vào chu kỳ sống của phiên:
 * `loginWithGoogle` LƯU token, `logout` XOÁ token. Giữ cặp này cạnh nhau trong
 * một file để không có đường nào tạo phiên mà quên lưu, hay kết thúc phiên mà
 * quên xoá.
 */

import { apiClient, setAccessToken } from '@/core/api/client';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';
import type { GoogleLoginRequest, TokenResponse, UserMeResponse } from '@/core/auth/types';

/** Header backend đọc refresh token từ đó (`AuthController.extractRefreshToken`) */
const HEADER_REFRESH_TOKEN = 'X-Refresh-Token';

export const authRepo = {
  /**
   * Gửi Google ID Token lên backend, lưu access token vào RAM và refresh token
   * xuống keystore.
   *
   * Gọi `/api/auth/google/mobile`, KHÔNG PHẢI `/api/auth/google` mà web dùng:
   * thư viện Google Sign-In miễn phí trên mobile không đưa được claim `nonce` vào
   * ID Token, nên backend có một đường riêng bỏ đúng bước so khớp claim đó
   * (`GoogleAuthService.verifyMobilePayload()` gọi `verifyPayload(payload, null,
   * ...)`). Vì vậy body chỉ có `{ credential }` — mobile không xin nonce nữa, và
   * chống replay do `GoogleMobileTokenReplayService` ở backend đảm nhiệm.
   *
   * Endpoint này trả refresh token NGAY TRONG BODY (ngoài việc vẫn set cookie),
   * đó là thứ cho phép app bỏ hẳn cookie manager native.
   */
  async loginWithGoogle(input: GoogleLoginRequest) {
    const token = await apiClient<TokenResponse>('/api/auth/google/mobile', {
      method: 'POST',
      data: input,
    });
    setAccessToken(token.accessToken);
    if (token.refreshToken) {
      // Không có refresh token (hình dạng phản hồi của client web) thì phiên vẫn
      // dùng được tới khi tắt app — chỉ là không sống qua lần mở app sau. Không
      // được ghi rỗng xuống keystore để tránh tạo một phiên "bền" giả.
      await luuRefreshToken(token.refreshToken);
    }
    return token;
  },

  /** Lấy thông tin người dùng đang đăng nhập */
  getMe() {
    return apiClient<UserMeResponse>('/api/auth/me');
  },

  /**
   * Thu hồi phiên ở backend, rồi xoá access token trong RAM và refresh token
   * trong keystore.
   *
   * Phải tự gửi refresh token qua header: `AuthController.logout()` dùng cùng
   * `extractRefreshToken()` như `/api/auth/refresh` (header trước, rồi body, rồi
   * cookie), và app không còn cookie nào cả. Không gửi thì backend không biết
   * thu hồi phiên nào và refresh token đó sống tiếp tới khi hết hạn.
   */
  async logout() {
    const refreshToken = await docRefreshToken();
    try {
      await apiClient<null>('/api/auth/logout', {
        method: 'POST',
        headers: refreshToken ? { [HEADER_REFRESH_TOKEN]: refreshToken } : undefined,
      });
    } finally {
      // Dọn RAM trước, keystore sau. `xoaRefreshToken()` không bao giờ ném (xem
      // `session.ts`) nên nó không thể che mất lỗi thật của request logout.
      setAccessToken(null);
      await xoaRefreshToken();
    }
  },
};
