/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của `/api/auth/*` bằng cách cho CODE THẬT đọc
 * chúng — `authRepo`, `refreshSession` và `resolveAuthRoute`, không assert vào
 * fixture. Đây là cách duy nhất bắt được lỗi "mock bịa hình dạng DTO": một mock
 * trả `{accessToken}` thiếu `tokenType` vẫn khớp mọi assertion viết tay, nhưng
 * lệch kiểu `TokenResponse` thật.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests, getAccessToken, refreshSession } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { authRepo } from '@/core/auth/authRepo';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { MOCK_USER, __resetMockAuthForTests, authMockHandlers } from '@/core/auth/mocks/handlers';

const server = setupServer(...authMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  __resetMockAuthForTests();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('handler mock của xác thực', () => {
  it('máy chưa có phiên: refresh trả 401 để app dừng ở màn hình đăng nhập', async () => {
    // Nếu refresh trả 200 ngay từ đầu thì màn hình đăng nhập không bao giờ xem
    // được trong chế độ mock — và cũng không ai kiểm được nút đăng nhập.
    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
  });

  it('nonce giả có đủ field của GoogleLoginNonceResponse, `expiresAt` là mốc thời gian thật', async () => {
    const nonce = await authRepo.getGoogleNonce();

    expect(nonce.nonce.length).toBeGreaterThan(0);
    // Chỉ kiểm "có field expiresAt" là chưa đủ: chuỗi rỗng cũng có field. Phải
    // parse được thành thời điểm, vì đó là thứ backend thật trả về.
    expect(Number.isNaN(Date.parse(nonce.expiresAt))).toBe(false);
  });

  it('đổi credential lấy phiên trả CẢ accessToken lẫn tokenType', async () => {
    // `TokenResponse` có hai field. Thiếu `tokenType` là đúng lớp lỗi "mock bịa
    // hình dạng hẹp hơn kiểu thật".
    const token = await authRepo.loginWithGoogle({ credential: 'id-token-gia', nonce: 'n-1' });

    expect(token.accessToken.length).toBeGreaterThan(0);
    expect(token.tokenType).toBe('Bearer');
    // `authRepo.loginWithGoogle` nạp token vào client — chứng tỏ các request sau
    // của app sẽ mang Authorization.
    expect(getAccessToken()).toBe(token.accessToken);
  });

  it('sau khi đăng nhập thì refresh thành công, mở lại app không bị đẩy ra login', async () => {
    await authRepo.loginWithGoogle({ credential: 'id-token-gia', nonce: 'n-1' });

    await expect(refreshSession()).resolves.toEqual(expect.any(String));
  });

  it('người dùng giả đi qua được `resolveAuthRoute` để vào các tab', async () => {
    // Đây là mục tiêu của cả task: bấm đăng nhập là vào thẳng các tab. Dùng
    // đúng hàm điều hướng thật thay vì tự đọc `roles` — một MOCK_USER chỉ có
    // vai trò ADMIN sẽ rơi vào màn hình "không hỗ trợ" mà không test nào biết.
    await authRepo.loginWithGoogle({ credential: 'id-token-gia', nonce: 'n-1' });
    const me = await authRepo.getMe();

    expect(me.publicId).toBe(MOCK_USER.publicId);
    expect(resolveAuthRoute('authenticated', me)).toEqual({ kind: 'tabs' });
  });

  it('đăng xuất xoá phiên giả: refresh sau đó lại trả 401', async () => {
    await authRepo.loginWithGoogle({ credential: 'id-token-gia', nonce: 'n-1' });
    await authRepo.logout();

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
  });
});
