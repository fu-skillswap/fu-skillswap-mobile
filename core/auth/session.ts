/**
 * @file session.ts
 * @description Lưu refresh token của phiên đăng nhập vào keystore của hệ điều
 * hành qua `expo-secure-store` (Keychain trên iOS, EncryptedSharedPreferences
 * trên Android). Đây là NƠI DUY NHẤT trong app chạm vào bộ nhớ bền của phiên.
 *
 * VÌ SAO KHÔNG CÒN DÙNG COOKIE NATIVE: trước đây refresh token do backend đặt
 * trong cookie HttpOnly, và app phải đọc/ghi cookie store native qua một module
 * cookie manager của bên thứ ba (xem lịch sử git của file này). Module native đó
 * CHƯA TỪNG được biên dịch lần nào nên nó là ẩn số lớn nhất của bản build đầu
 * tiên. Backend đã trả refresh token ngay trong JSON body của
 * `POST /api/auth/google/mobile` và nhận lại qua header `X-Refresh-Token`, nên
 * app tự giữ token được — bỏ hẳn module đó là bỏ một rủi ro kiến trúc, không
 * phải đổi nó cho một thứ khác.
 *
 * HAI GIỚI HẠN CỦA `expo-secure-store` ĐÁNG BIẾT TRƯỚC (doc Expo v57):
 *
 * 1. **Giới hạn kích thước.** "Large payloads can be rejected by the underlying
 *    platform. Historically, some iOS releases refused values above roughly 2048
 *    bytes." JWT refresh token hiện nhỏ hơn con số đó rất nhiều, nhưng nếu
 *    backend đổi sang token dài (token opaque dài, hoặc nhồi thêm claim) thì
 *    ĐÂY là chỗ vỡ đầu tiên — và nó chỉ vỡ trên iOS thật, `luuRefreshToken()`
 *    sẽ trả `false` trong im lặng, người dùng phải đăng nhập lại mỗi lần mở app.
 *
 * 2. **Dữ liệu sống qua lần cài lại app trên iOS.** "Data saved using
 *    expo-secure-store will persist across app uninstallations if the app is
 *    reinstalled with the same bundle ID" (Android thì KHÔNG). Nghĩa là một
 *    refresh token cũ/đã bị thu hồi có thể còn nằm nguyên đó sau khi cài lại
 *    app, nên luồng khởi động BẮT BUỘC phải chịu được việc refresh bằng token
 *    chết: nhận 401 → xoá token → ra màn hình đăng nhập. Nhánh đó nằm ở
 *    `refreshAccessToken()` trong `core/api/client.ts`.
 *
 * MỌI lời gọi SecureStore ở đây đều bọc `try/catch`. Trên máy không có keystore
 * khả dụng (hoặc khoá đã bị hệ thống vô hiệu hoá vì người dùng đổi sinh trắc
 * học) lời gọi NÉM; và một phiên không đọc được chỉ được phép dẫn người dùng
 * tới màn hình đăng nhập, không được phép làm app chết lúc khởi động.
 */

import * as SecureStore from 'expo-secure-store';

/**
 * Khoá lưu refresh token trong keystore.
 *
 * Phải khớp `/^[\w.-]+$/`: `ensureValidKey()` của expo-secure-store NÉM với
 * khoá chứa ký tự khác (ví dụ `:` hay khoảng trắng), và lỗi đó chỉ lộ ra trên
 * thiết bị thật, đúng vào lúc người dùng đang đăng nhập. `session.test.ts` canh
 * đúng luật này.
 */
export const KHOA_REFRESH_TOKEN = 'skillswap_refresh_token';

/**
 * Lưu refresh token xuống keystore.
 * @returns `true` nếu đã ghi được; `false` nếu không (token rỗng, keystore
 * không khả dụng, hoặc giá trị bị nền tảng từ chối vì quá lớn).
 *
 * KHÔNG ném: một lần đăng nhập đã thành công (access token đã nằm trong RAM,
 * app dùng được bình thường tới khi tắt) không được báo lỗi cho người dùng chỉ
 * vì không ghi bền được phiên.
 */
export async function luuRefreshToken(token: string): Promise<boolean> {
  if (!token) {
    // Chuỗi rỗng là giá trị HỢP LỆ với SecureStore (`isValidValue` chỉ kiểm
    // `typeof value === 'string'`) nên nếu không chặn ở đây nó sẽ được ghi thật,
    // tạo ra một phiên trông như đang tồn tại mà mọi lần refresh đều 401.
    return false;
  }
  try {
    await SecureStore.setItemAsync(KHOA_REFRESH_TOKEN, token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Đọc refresh token đang lưu.
 * @returns token, hoặc `null` nếu máy này chưa có phiên nào lưu được/đọc được.
 */
export async function docRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(KHOA_REFRESH_TOKEN);
    // Doc Expo v57: `getItemAsync` resolve `null` khi chưa có khoá hoặc khoá đã
    // bị vô hiệu hoá. Chuẩn hoá cả `undefined` về `null` nữa — dưới jest-expo
    // native module bị auto-mock và trả `undefined` (đã đo), nếu để nó chảy
    // tiếp thì header sẽ thành `X-Refresh-Token: undefined`. `''` cũng vô dụng
    // y như không có token.
    return token ? token : null;
  } catch {
    return null;
  }
}

/** Xoá refresh token khỏi keystore — gọi khi đăng xuất hoặc khi phiên đã chết */
export async function xoaRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KHOA_REFRESH_TOKEN);
  } catch {
    // Không xoá được thì cũng không được làm đổ luồng đăng xuất: access token
    // trong RAM đã bị xoá, backend đã thu hồi phiên, và một token mồ côi còn
    // nằm trong keystore chỉ dẫn tới một lần refresh 401 ở lần mở app sau —
    // chính nhánh đã xử lý ở `refreshAccessToken()`.
  }
}
