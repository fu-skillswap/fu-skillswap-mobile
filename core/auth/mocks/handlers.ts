/**
 * @file handlers.ts
 * @description Handler MSW cho `/api/auth/*` dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test. Handler ở đây mô tả "một thế giới hợp lý để
 * xem giao diện"; handler trong từng file test mô tả "đúng một tình huống đang
 * được kiểm". Gộp hai thứ lại thì sửa fixture cho đẹp màn hình sẽ làm đổ test,
 * và siết fixture cho test sẽ làm màn hình trống.
 *
 * Luồng xác thực THẬT chạy nguyên vẹn qua đây: `AuthProvider` vẫn gọi refresh
 * khi mở app, vẫn xin nonce, vẫn đổi credential lấy phiên, vẫn gọi `/me`. Chế độ
 * mock không thêm một nhánh `if` nào vào `AuthProvider`.
 */

import { http, HttpResponse } from 'msw';

import type {
  GoogleLoginNonceResponse,
  TokenResponse,
  UserMeResponse,
} from '@/core/auth/types';
import { getEnv } from '@/core/config/env';

/**
 * Người dùng giả.
 *
 * Vừa MENTEE vừa MENTOR để xem được cả hai phía giao diện ở các tab Booking và
 * Lịch (spec §4.3 cho hai vai trò một bộ chuyển đổi thay vì nhân đôi số tab).
 * KHÔNG được có vai trò ADMIN/SYSTEM_ADMIN: `resolveAuthRoute` đưa tài khoản đó
 * sang màn hình "không hỗ trợ" và chế độ mock sẽ không bao giờ vào được tab nào.
 */
export const MOCK_USER: UserMeResponse = {
  publicId: 'mock-user-0001',
  email: 'sinhvien@fpt.edu.vn',
  fullName: 'Nguyễn Văn Mock',
  avatarUrl: null,
  status: 'ACTIVE',
  roles: ['MENTEE', 'MENTOR'],
  profileCompleted: true,
  hasStudentProfile: true,
  googleCalendarConnected: false,
  googleCalendarSyncEnabled: false,
  googleCalendarEmail: null,
  googleCalendarNeedsReconnect: false,
  googleCalendarLastSyncStatus: null,
  googleCalendarLastSyncAt: null,
};

/** Access token giả — chuỗi cố định, không phải JWT thật và không cần là JWT */
const MOCK_ACCESS_TOKEN = 'mock-access-token';

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
  };
}

/** Phản hồi lỗi theo đúng khuôn envelope của backend */
function loi(status: number, code: string, message: string) {
  return HttpResponse.json(
    { timestamp: new Date().toISOString(), status, code, message, data: null },
    { status },
  );
}

/**
 * `false` cho tới khi người dùng bấm đăng nhập.
 *
 * Nhờ vậy lần `POST /api/auth/refresh` lúc mở app trả 401 như một máy chưa có
 * phiên, và app dừng ở màn hình đăng nhập thật — đúng trạng thái người dùng mới
 * gặp. Trả 200 ngay từ đầu thì màn hình đăng nhập không bao giờ xem được trong
 * chế độ mock, và cũng không ai bấm thử được nút đăng nhập.
 */
let daDangNhap = false;

/** Đặt lại trạng thái phiên giả — chỉ dùng trong test */
export function __resetMockAuthForTests(): void {
  daDangNhap = false;
}

const base = getEnv().apiUrl;

const nonceGia: GoogleLoginNonceResponse = {
  nonce: 'mock-nonce-0001',
  // Mốc thời gian thật parse được, không phải chuỗi rỗng: `GoogleLoginNonceResponse`
  // khai `expiresAt: string` và backend trả ISO-8601.
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
};

const tokenGia: TokenResponse = {
  accessToken: MOCK_ACCESS_TOKEN,
  // `TokenResponse` có HAI field. Bỏ `tokenType` là mock bịa một hình dạng hẹp
  // hơn kiểu thật — đúng lớp lỗi repo này đã dính nhiều lần.
  tokenType: 'Bearer',
};

export const authMockHandlers = [
  http.get(`${base}/api/auth/google/nonce`, () => HttpResponse.json(envelope(nonceGia))),

  // Mobile gọi `/api/auth/google/mobile`, KHÔNG phải `/api/auth/google` của web
  // — xem JSDoc của `authRepo.loginWithGoogle`.
  http.post(`${base}/api/auth/google/mobile`, () => {
    daDangNhap = true;
    return HttpResponse.json(envelope(tokenGia));
  }),

  http.post(`${base}/api/auth/refresh`, () => {
    if (!daDangNhap) {
      return loi(401, 'AUTH_1003', 'Chưa có phiên đăng nhập trên máy này');
    }
    return HttpResponse.json(envelope(tokenGia));
  }),

  http.get(`${base}/api/auth/me`, () => {
    if (!daDangNhap) {
      return loi(401, 'AUTH_1003', 'Phiên đăng nhập đã kết thúc');
    }
    return HttpResponse.json(envelope(MOCK_USER));
  }),

  http.post(`${base}/api/auth/logout`, () => {
    daDangNhap = false;
    return HttpResponse.json(envelope(null));
  }),
];
