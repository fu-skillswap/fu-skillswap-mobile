/**
 * @file handlers.ts
 * @description Handler MSW cho `/api/auth/*` dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test. Handler ở đây mô tả "một thế giới hợp lý để
 * xem giao diện"; handler trong từng file test mô tả "đúng một tình huống đang
 * được kiểm". Gộp hai thứ lại thì sửa fixture cho đẹp màn hình sẽ làm đổ test,
 * và siết fixture cho test sẽ làm màn hình trống.
 *
 * Luồng xác thực THẬT chạy nguyên vẹn qua đây: `AuthProvider` vẫn thử làm mới
 * phiên từ refresh token trong keystore khi mở app, vẫn đổi credential lấy phiên,
 * vẫn lưu refresh token, vẫn gọi `/me`. Chế độ mock không thêm một nhánh `if` nào
 * vào `AuthProvider`.
 */

import { http } from 'msw';

import { jsonMock } from '@/core/dev/jsonMock';

import type { TokenResponse, UserMeResponse } from '@/core/auth/types';
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

/**
 * Refresh token giả.
 *
 * `/api/auth/refresh` và `/api/auth/logout` dưới đây SO KHỚP đúng giá trị này
 * trong header `X-Refresh-Token` thay vì chấp nhận bất cứ gì. Nhờ vậy chế độ mock
 * bắt được đúng lỗi nó cần bắt: app quên gửi header, hoặc gửi token rỗng/sai, sẽ
 * hiện ra thành màn hình đăng nhập chứ không âm thầm đi tiếp.
 */
const MOCK_REFRESH_TOKEN = 'mock-refresh-token';

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
  return jsonMock(
    { timestamp: new Date().toISOString(), status, code, message, data: null },
    { status },
  );
}

/**
 * `false` cho tới khi người dùng bấm đăng nhập (hoặc tới khi một refresh token
 * hợp lệ được xuất trình).
 *
 * Nhờ vậy máy chưa có phiên sẽ dừng ở màn hình đăng nhập thật — đúng trạng thái
 * người dùng mới gặp. Cho `/me` trả 200 ngay từ đầu thì màn hình đăng nhập không
 * bao giờ xem được trong chế độ mock, và cũng không ai bấm thử được nút đăng nhập.
 */
let daDangNhap = false;

/** Đặt lại trạng thái phiên giả — chỉ dùng trong test */
export function __resetMockAuthForTests(): void {
  daDangNhap = false;
}

const base = getEnv().apiUrl;

const tokenGia: TokenResponse = {
  accessToken: MOCK_ACCESS_TOKEN,
  // `TokenResponse` có BA field với client mobile. Bỏ `tokenType` — hay bỏ
  // `refreshToken`, thứ backend chỉ điền cho mobile — là mock bịa một hình dạng
  // hẹp hơn kiểu thật, đúng lớp lỗi repo này đã dính nhiều lần. Thiếu
  // `refreshToken` ở đây thì chế độ mock mất phiên sau mỗi lần tắt app, trong khi
  // bản thật thì không.
  refreshToken: MOCK_REFRESH_TOKEN,
  tokenType: 'Bearer',
};

export const authMockHandlers = [
  // Mobile gọi `/api/auth/google/mobile`, KHÔNG phải `/api/auth/google` của web
  // — xem JSDoc của `authRepo.loginWithGoogle`. Body chỉ có `{ credential }`.
  http.post(`${base}/api/auth/google/mobile`, () => {
    daDangNhap = true;
    return jsonMock(envelope(tokenGia));
  }),

  http.post(`${base}/api/auth/refresh`, ({ request }) => {
    // Backend thật đọc refresh token qua `extractRefreshToken()`: header
    // `X-Refresh-Token` trước, rồi body, rồi cookie. App mobile chỉ dùng header.
    if (request.headers.get('X-Refresh-Token') !== MOCK_REFRESH_TOKEN) {
      return loi(401, 'AUTH_1003', 'Refresh token không hợp lệ hoặc đã bị thu hồi');
    }
    // Xuất trình được token hợp lệ thì phiên đang tồn tại — kể cả khi tiến trình
    // vừa khởi động lại và biến `daDangNhap` mới được khởi tạo lại thành false.
    // Thiếu dòng này thì chế độ mock refresh được nhưng `/me` lại 401, và app
    // kẹt ở một trạng thái bản thật không có.
    daDangNhap = true;
    return jsonMock(envelope(tokenGia));
  }),

  http.get(`${base}/api/auth/me`, () => {
    if (!daDangNhap) {
      return loi(401, 'AUTH_1003', 'Phiên đăng nhập đã kết thúc');
    }
    return jsonMock(envelope(MOCK_USER));
  }),

  http.post(`${base}/api/auth/logout`, () => {
    daDangNhap = false;
    return jsonMock(envelope(null));
  }),
];
