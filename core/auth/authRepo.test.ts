import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests, getAccessToken } from '@/core/api/client';
import { authRepo } from '@/core/auth/authRepo';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown) {
  return {
    timestamp: '2026-09-20T00:00:00Z',
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('authRepo', () => {
  it('lấy nonce dùng một lần', async () => {
    server.use(
      http.get(`${BASE}/api/auth/google/nonce`, () =>
        HttpResponse.json(envelope({ nonce: 'n-1', expiresAt: '2026-09-20T00:05:00Z' })),
      ),
    );

    await expect(authRepo.getGoogleNonce()).resolves.toEqual({
      nonce: 'n-1',
      expiresAt: '2026-09-20T00:05:00Z',
    });
  });

  // Endpoint mobile-only theo CR 2026-09-21-mobile-google-login-nonce.md: thư viện
  // Google Sign-In miễn phí không đưa được claim `nonce` vào ID token, nên mobile
  // gọi `/api/auth/google/mobile` (bỏ đúng bước so khớp nonce trong token) thay vì
  // `/api/auth/google` mà web dùng. Endpoint này chưa tồn tại trên backend thật.
  it('đăng nhập Google gửi đúng credential + nonce và lưu access token', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/api/auth/google/mobile`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' }));
      }),
    );

    await authRepo.loginWithGoogle({ credential: 'cred-1', nonce: 'n-1' });

    expect(body).toEqual({ credential: 'cred-1', nonce: 'n-1' });
    expect(getAccessToken()).toBe('at-1');
  });

  it('lấy thông tin người dùng hiện tại', async () => {
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json(
          envelope({
            publicId: 'u-1',
            email: 'a@b.com',
            fullName: 'Nguyen Van A',
            status: 'ACTIVE',
            roles: ['MENTEE'],
            profileCompleted: true,
            hasStudentProfile: true,
            googleCalendarConnected: false,
            googleCalendarSyncEnabled: false,
            googleCalendarNeedsReconnect: false,
          }),
        ),
      ),
    );

    const me = await authRepo.getMe();

    expect(me.publicId).toBe('u-1');
    expect(me.roles).toEqual(['MENTEE']);
  });

  it('đăng xuất gọi đúng endpoint và xoá access token', async () => {
    let called = 0;
    server.use(
      http.post(`${BASE}/api/auth/logout`, () => {
        called += 1;
        return HttpResponse.json(envelope(null));
      }),
    );

    await authRepo.logout();

    expect(called).toBe(1);
    expect(getAccessToken()).toBeNull();
  });
});
