/**
 * @file types.ts
 * @description DTO xác thực port từ `fu-skillswap-fe-2/src/models/auth.ts`.
 * Chỉ giữ phần mobile thực sự dùng trong giai đoạn này.
 */

/** Vai trò do backend cấp */
export type BackendRole = 'MENTEE' | 'MENTOR' | 'ADMIN' | 'SYSTEM_ADMIN';

/** Phản hồi của `GET /api/auth/google/nonce` */
export interface GoogleLoginNonceResponse {
  nonce: string;
  expiresAt: string;
}

/**
 * Payload đăng nhập Google.
 * Web gửi payload này tới `POST /api/auth/google`; mobile gửi cùng payload tới
 * `POST /api/auth/google/mobile` (xem `authRepo.ts`) — DTO backend không đổi.
 */
export interface GoogleLoginRequest {
  /** Google ID Token */
  credential: string;
  /** Đúng nonce đã dùng khi lấy ID Token */
  nonce: string;
}

/** Phản hồi chứa access token */
export interface TokenResponse {
  accessToken: string;
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
