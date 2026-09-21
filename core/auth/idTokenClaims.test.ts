import { decodeIdTokenClaims, describeIdTokenForSpike } from '@/core/auth/idTokenClaims';

/** Dựng một JWT giả với payload cho trước (chữ ký không quan trọng: hàm này không xác minh chữ ký) */
function makeToken(payload: Record<string, unknown>): string {
  const b64url = (value: string) =>
    Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(payload))}.chu-ky-gia`;
}

describe('decodeIdTokenClaims', () => {
  it('đọc được các claim cần cho spike', () => {
    const token = makeToken({
      aud: 'web-client-id.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
      sub: '1234567890',
      exp: 1790000000,
    });

    expect(decodeIdTokenClaims(token)).toEqual({
      aud: 'web-client-id.apps.googleusercontent.com',
      iss: 'https://accounts.google.com',
      sub: '1234567890',
      exp: 1790000000,
      hasNonce: false,
    });
  });

  it('nhận ra token CÓ claim nonce', () => {
    const token = makeToken({ aud: 'x', iss: 'y', sub: 'z', exp: 1, nonce: 'n-1' });

    expect(decodeIdTokenClaims(token).hasNonce).toBe(true);
  });

  it('token sai định dạng thì trả về claim rỗng, không ném lỗi', () => {
    // Spike chạy trên thiết bị thật; một lỗi giải mã không được phép làm sập
    // màn hình đăng nhập, vì như thế sẽ che mất chính thứ đang cần quan sát.
    expect(decodeIdTokenClaims('khong-phai-jwt')).toEqual({
      aud: null,
      iss: null,
      sub: null,
      exp: null,
      hasNonce: false,
    });
  });

  it('mô tả cho spike nêu rõ aud khớp hay lệch', () => {
    const claims = decodeIdTokenClaims(
      makeToken({ aud: 'dung-client', iss: 'https://accounts.google.com', sub: 's', exp: 1 }),
    );

    expect(describeIdTokenForSpike(claims, 'dung-client')).toContain('aud KHỚP');
    expect(describeIdTokenForSpike(claims, 'client-khac')).toContain('aud LỆCH');
  });

  it('mô tả cho spike không bao giờ chứa token thô hay giá trị nonce', () => {
    const claims = decodeIdTokenClaims(
      makeToken({ aud: 'a', iss: 'i', sub: 's', exp: 1, nonce: 'gia-tri-nonce-bi-mat' }),
    );

    const text = describeIdTokenForSpike(claims, 'a');

    expect(text).not.toContain('gia-tri-nonce-bi-mat');
    expect(text).toContain('CÓ claim nonce');
  });

  it('không phụ thuộc Buffer/atob/TextDecoder — các global này KHÔNG có trên React Native (Hermes)', () => {
    // Jest chạy trên Node nên Buffer/atob luôn có sẵn; RN runtime của app này thì không
    // (đã kiểm tra node_modules/react-native/Libraries/Core/setUpGlobals.js — không polyfill
    // Buffer, atob hay TextDecoder). Xoá tạm các global này để mô phỏng đúng môi trường đó.
    const sandbox = globalThis as Record<string, unknown>;
    const realBuffer = sandbox.Buffer;
    const realAtob = sandbox.atob;
    const realTextDecoder = sandbox.TextDecoder;
    delete sandbox.Buffer;
    delete sandbox.atob;
    delete sandbox.TextDecoder;

    try {
      const token = makeTokenWithoutBuffer({
        aud: 'web-client-id.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        sub: '1234567890',
        exp: 1790000000,
      });

      expect(decodeIdTokenClaims(token)).toEqual({
        aud: 'web-client-id.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        sub: '1234567890',
        exp: 1790000000,
        hasNonce: false,
      });
    } finally {
      sandbox.Buffer = realBuffer;
      sandbox.atob = realAtob;
      sandbox.TextDecoder = realTextDecoder;
    }
  });
});

/**
 * Bản `makeToken` không dùng `Buffer` — tự mã hoá base64url bằng tay — để test
 * "không phụ thuộc Buffer/atob/TextDecoder" ở trên không vô tình bịa ra một
 * dependency mới ngay trong lúc chứng minh không có dependency nào.
 */
function makeTokenWithoutBuffer(payload: Record<string, unknown>): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const toBase64Url = (input: string) => {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      bytes.push(input.charCodeAt(i) & 0xff);
    }
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      out += alphabet[b0 >> 2];
      out += alphabet[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
      out += b1 === undefined ? '' : alphabet[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
      out += b2 === undefined ? '' : alphabet[b2 & 0x3f];
    }
    return out;
  };
  return `${toBase64Url('{"alg":"RS256"}')}.${toBase64Url(JSON.stringify(payload))}.chu-ky-gia`;
}
