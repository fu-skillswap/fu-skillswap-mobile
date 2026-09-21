/**
 * @file idTokenClaims.ts
 * @description Giải mã phần payload của Google ID Token để phục vụ spike R1.
 *
 * KHÔNG xác minh chữ ký — việc đó là của backend. Hàm này chỉ để quan sát trong
 * lúc chạy spike: `aud` có đúng web client id không, và token có claim `nonce`
 * hay không (thư viện miễn phí không đưa được nonce vào, xem BE change request).
 *
 * Cố ý KHÔNG dùng dịch vụ giải mã online: ID token là credential sống, dán nó
 * vào một website bên thứ ba là làm rò rỉ phiên đăng nhập thật.
 *
 * Cố ý KHÔNG dùng `Buffer.from(...)` hay `atob(...)`: cả hai đều không tồn tại
 * như global trong runtime React Native (Hermes) của app này — chỉ Jest/Node có
 * sẵn `Buffer`. Đã kiểm tra `node_modules/react-native/Libraries/Core/setUpGlobals.js`
 * và toàn bộ chuỗi `setUpDefaultReactNativeEnvironment`: không nơi nào polyfill
 * `Buffer`, `atob` hay `TextDecoder`. Vì vậy bộ giải mã base64url dưới đây tự
 * cài tay, không phụ thuộc global nào, chạy giống nhau ở cả Jest lẫn thiết bị thật.
 */

/** Các claim mà spike cần nhìn thấy */
export interface GoogleIdTokenClaims {
  aud: string | null;
  iss: string | null;
  sub: string | null;
  exp: number | null;
  /** Chỉ cho biết CÓ hay KHÔNG, không giữ giá trị nonce */
  hasNonce: boolean;
}

const EMPTY_CLAIMS: GoogleIdTokenClaims = {
  aud: null,
  iss: null,
  sub: null,
  exp: null,
  hasNonce: false,
};

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Lấy chuỗi từ một giá trị chưa rõ kiểu, trả null nếu không phải chuỗi */
function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Gộp các byte UTF-8 thành chuỗi JS (xử lý cả ký tự ngoài mặt phẳng cơ bản) */
function utf8BytesToString(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if ((byte1 & 0xe0) === 0xc0 && i < bytes.length) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if ((byte1 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
    } else if ((byte1 & 0xf8) === 0xf0 && i + 2 < bytes.length) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      const codepoint =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      const surrogate = codepoint - 0x10000;
      result += String.fromCharCode(0xd800 + (surrogate >> 10), 0xdc00 + (surrogate & 0x3ff));
    }
    // byte không hợp lệ theo UTF-8: bỏ qua, không ném lỗi (xem ghi chú ở decodeIdTokenClaims)
  }
  return result;
}

/**
 * Giải mã base64url (JWT dùng base64url, không phải base64 thường) thành chuỗi UTF-8.
 * Không dùng `Buffer`/`atob`, xem ghi chú đầu file.
 */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      continue; // bỏ qua '=' đệm và ký tự không thuộc bảng chữ base64
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8BytesToString(bytes);
}

/**
 * Đọc các claim cần cho spike từ một ID token.
 * Token hỏng hoặc sai định dạng trả về claim rỗng thay vì ném lỗi: spike chạy
 * trên thiết bị thật, một lần crash sẽ che mất đúng thứ đang cần quan sát.
 */
export function decodeIdTokenClaims(idToken: string): GoogleIdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return EMPTY_CLAIMS;
  }

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(parts[1]));
    if (typeof parsed !== 'object' || parsed === null) {
      return EMPTY_CLAIMS;
    }
    const payload = parsed as Record<string, unknown>;
    return {
      aud: readString(payload.aud),
      iss: readString(payload.iss),
      sub: readString(payload.sub),
      exp: typeof payload.exp === 'number' ? payload.exp : null,
      hasNonce: typeof payload.nonce === 'string' && payload.nonce.length > 0,
    };
  } catch {
    return EMPTY_CLAIMS;
  }
}

/**
 * Dựng một dòng mô tả để ghi log trong lúc spike.
 * Không bao giờ chứa token thô hay giá trị nonce.
 */
export function describeIdTokenForSpike(
  claims: GoogleIdTokenClaims,
  expectedAudience: string,
): string {
  const audState = claims.aud === expectedAudience ? 'aud KHỚP web client id' : 'aud LỆCH';
  const nonceState = claims.hasNonce
    ? 'CÓ claim nonce (bất ngờ — báo lại, có thể không cần BE nới lỏng nữa)'
    : 'KHÔNG có claim nonce (đúng như dự kiến)';
  return [
    `[spike R1] ${audState} (aud=${claims.aud ?? 'null'})`,
    `[spike R1] iss=${claims.iss ?? 'null'}`,
    `[spike R1] sub ${claims.sub ? 'có' : 'thiếu'}, exp=${claims.exp ?? 'null'}`,
    `[spike R1] ${nonceState}`,
  ].join('\n');
}
