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
 *
 * QUAN TRỌNG: cấu hình thư viện (đọc `getEnv().googleWebClientId`, ném lỗi nếu
 * thiếu biến môi trường) diễn ra LƯỜI (lazy) ngay trong `getGoogleIdToken()`/
 * `signOutGoogle()`, không phải lúc app khởi động. Bản clone sạch thiếu
 * `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (mặc định trong `.env.example`) trước đây
 * chết ngay ở boot vì `AuthProvider` gọi `configureGoogleSignIn()` làm câu lệnh
 * đầu tiên của effect khởi động, NGOÀI khối `try` bao quanh — ném đồng bộ ra
 * khỏi `useEffect` thành màn hình trắng, không cách nào hiển thị lỗi. Cấu hình
 * lười khiến app luôn vào được màn hình login; lỗi thiếu biến môi trường chỉ lộ
 * ra khi người dùng thật sự bấm đăng nhập.
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { getEnv, isMockMode } from '@/core/config/env';

/**
 * ID Token giả dùng trong chế độ mock.
 *
 * Có đủ ba phần ngăn bởi dấu chấm để `decodeIdTokenClaims()` không ném lỗi khi
 * `AuthProvider` soi token trong nhánh `__DEV__` của `signInWithGoogle`. Payload
 * là base64url của
 * `{"sub":"mock-user-0001","aud":"mock","email":"sinhvien@fpt.edu.vn"}`.
 */
export const MOCK_ID_TOKEN =
  'eyJhbGciOiJub25lIn0.' +
  'eyJzdWIiOiJtb2NrLXVzZXItMDAwMSIsImF1ZCI6Im1vY2siLCJlbWFpbCI6InNpbmh2aWVuQGZwdC5lZHUudm4ifQ.' +
  'mock-signature';

/** Người dùng chủ động huỷ hộp thoại đăng nhập — không phải lỗi hệ thống */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Người dùng đã huỷ đăng nhập Google');
    this.name = 'GoogleSignInCancelledError';
  }
}

/**
 * Lỗi CẤU HÌNH phía nhà phát triển, không phải lỗi tạm thời.
 *
 * Google trả `DEVELOPER_ERROR` khi Android OAuth client chưa đăng ký đúng cặp
 * `android.package` + SHA-1 của keystore đã ký bản build, trong **cùng** Google
 * Cloud project với `webClientId`.
 *
 * Phải là một lớp lỗi riêng vì cách nói với người dùng khác hẳn: chờ bao lâu
 * cũng không hết, nên tuyệt đối không mời họ "thử lại sau ít phút". Gặp thật
 * trên máy ảo 2026-10-03, và khi đó nó rơi vào nhánh lỗi chung đúng kiểu đó.
 *
 * Lưu ý khi đọc mã: hộp "Choose an account … to continue to SkillSwap" VẪN hiện
 * ra bình thường trước khi lỗi này nổ, vì tên ứng dụng trong hộp đó đến từ màn
 * hình đồng ý của `webClientId`. Thấy hộp đó KHÔNG có nghĩa là SHA-1 đã đúng.
 */
export class GoogleSignInConfigError extends Error {
  constructor() {
    super('Ứng dụng chưa được cấu hình đúng cho đăng nhập Google (DEVELOPER_ERROR)');
    this.name = 'GoogleSignInConfigError';
  }
}

/**
 * Mã `DEVELOPER_ERROR` của Android (`CommonStatusCodes.DEVELOPER_ERROR`).
 *
 * Viết thẳng số vì `statusCodes` của `@react-native-google-signin/google-signin`
 * 16.1.5 KHÔNG xuất mã này — bản đó chỉ có `SIGN_IN_CANCELLED`, `IN_PROGRESS`,
 * `PLAY_SERVICES_NOT_AVAILABLE`, `SIGN_IN_REQUIRED` và `NULL_PRESENTER` (xem
 * `lib/module/errors/errorCodes.js`). Giá trị 10 là hằng của Google Play
 * Services, không phải của thư viện, nên nó ổn định hơn chính thư viện.
 */
const MA_LOI_CAU_HINH = '10';

/** Thư viện trả `code` lúc là chuỗi lúc là số tuỳ đường ném — chuẩn hoá rồi so */
function isConfigError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { code?: string | number };
  return String(candidate.code) === MA_LOI_CAU_HINH;
}

/** Cấu hình thư viện. Giữ export để nơi khác gọi trực tiếp được nếu cần, nhưng
 * KHÔNG nơi nào trong app được gọi hàm này một cách nhiệt tình (eager) lúc
 * khởi động — dùng `ensureGoogleSignInConfigured()` bên dưới (lười, memo hoá). */
export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    // webClientId quyết định `aud` của ID Token, phải trùng GOOGLE_CLIENT_ID của backend.
    webClientId: getEnv().googleWebClientId,
    offlineAccess: false,
  });
}

/** Đã cấu hình thành công lần nào chưa trong tiến trình hiện tại */
let configured = false;

/**
 * Bảo đảm thư viện đã được cấu hình trước khi dùng — gọi lười (lazy) ngay
 * trước lần cần tới GoogleSignin đầu tiên, không phải lúc app khởi động (xem
 * ghi chú ở đầu file). Memo hoá: nếu `configureGoogleSignIn()` từng chạy
 * thành công thì các lần gọi sau là no-op; nếu nó từng ném lỗi (ví dụ thiếu
 * biến môi trường) thì lần gọi kế tiếp vẫn thử lại — không "nhớ" một lỗi cấu
 * hình mãi mãi, để sau khi người dùng/CI sửa `.env` thì không cần khởi động
 * lại tiến trình JS.
 */
function ensureGoogleSignInConfigured(): void {
  if (configured) {
    return;
  }
  configureGoogleSignIn();
  configured = true;
}

/** Đặt lại trạng thái "đã cấu hình" — chỉ dùng trong test */
export function __resetGoogleSignInConfiguredForTests(): void {
  configured = false;
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
  // Chế độ mock: máy chưa có Android OAuth client nên lời gọi native chắc chắn
  // ném lỗi, và `ensureGoogleSignInConfigured()` cũng ném nếu thiếu
  // EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Phải thoát TRƯỚC cả hai.
  //
  // Đây là một trong hai seam duy nhất chế độ mock được phép chạm vào (seam kia
  // là tầng HTTP). `isMockMode()` yêu cầu `__DEV__`, nên nhánh này chết hẳn
  // trong bản phát hành — xem `core/config/env.ts`.
  if (isMockMode()) {
    return MOCK_ID_TOKEN;
  }

  ensureGoogleSignInConfigured();

  let response: unknown;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (error) {
    if (isCancellation(error)) {
      throw new GoogleSignInCancelledError();
    }
    if (isConfigError(error)) {
      throw new GoogleSignInConfigError();
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
  ensureGoogleSignInConfigured();
  await GoogleSignin.signOut();
}
