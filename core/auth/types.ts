/**
 * @file types.ts
 * @description DTO xác thực port từ `fu-skillswap-fe-2/src/models/auth.ts`.
 * Chỉ giữ phần mobile thực sự dùng trong giai đoạn này.
 */

/** Vai trò do backend cấp */
export type BackendRole = 'MENTEE' | 'MENTOR' | 'ADMIN' | 'SYSTEM_ADMIN';

/**
 * Payload đăng nhập Google của ĐƯỜNG MOBILE (`POST /api/auth/google/mobile`).
 *
 * Chỉ có `credential`, KHÔNG có `nonce`: `GoogleAuthService.verifyMobilePayload()`
 * gọi `verifyPayload(payload, null, ...)`, tức bỏ hẳn bước so khớp claim `nonce`
 * — thư viện Google Sign-In miễn phí không đưa được claim đó vào ID Token. Chống
 * replay là việc của `GoogleMobileTokenReplayService` ở phía backend, nên mobile
 * không còn xin nonce nữa (đường web `POST /api/auth/google` thì vẫn dùng nonce).
 */
export interface GoogleLoginRequest {
  /** Google ID Token */
  credential: string;
}

/** Phản hồi chứa access token */
export interface TokenResponse {
  accessToken: string;
  /**
   * Refresh token ở dạng thô, CHỈ có giá trị với client mobile.
   * Backend trả `null` cho client web (web dùng cookie HttpOnly) và chỉ điền giá
   * trị khi `isMobileClient()` đúng — tức là khi request mang refresh token trong
   * header/body, hoặc mang `X-Client-Type: mobile`, hoặc `X-Client-Platform:
   * android|ios` (các header này do `core/api/client.ts` gắn vào mọi request).
   */
  refreshToken?: string | null;
  tokenType: string;
}

/** Phản hồi của `GET /api/auth/me` */
export interface UserMeResponse {
  publicId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED' | 'DELETED';
  roles: BackendRole[];
  profileCompleted: boolean;
  hasStudentProfile: boolean;
  googleCalendarConnected: boolean;
  googleCalendarSyncEnabled: boolean;
  googleCalendarEmail?: string | null;
  googleCalendarNeedsReconnect: boolean;
  googleCalendarLastSyncStatus?: string | null;
  googleCalendarLastSyncAt?: string | null;
}
