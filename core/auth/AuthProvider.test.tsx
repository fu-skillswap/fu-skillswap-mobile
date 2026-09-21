import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { AuthProvider, useAuth } from '@/core/auth/AuthProvider';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/auth/googleSignIn', () => ({
  configureGoogleSignIn: jest.fn(),
  getGoogleIdToken: jest.fn().mockResolvedValue('id-token-abc'),
  signOutGoogle: jest.fn().mockResolvedValue(undefined),
  GoogleSignInCancelledError: class extends Error {},
}));

jest.mock('@/core/auth/session', () => ({
  REFRESH_COOKIE_NAME: 'skillswap_refresh_token',
  persistSessionCookies: jest.fn().mockResolvedValue(undefined),
  clearSessionCookies: jest.fn().mockResolvedValue(undefined),
  hasRefreshCookie: jest.fn().mockResolvedValue(true),
}));

function envelope(data: unknown, status = 200, code = 'SUCCESS') {
  return { timestamp: '2026-09-20T00:00:00Z', status, code, message: 'OK', data };
}

const ME = {
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
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthProvider', () => {
  it('khởi động app: refresh thành công thì vào trạng thái đã đăng nhập', async () => {
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' })),
      ),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.publicId).toBe('u-1');
  });

  it('khởi động app: refresh thất bại thì về trạng thái chưa đăng nhập', async () => {
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope(null, 401, 'AUTH_1003'), { status: 401 }),
      ),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('đăng nhập Google: lấy nonce, đổi lấy token rồi nạp hồ sơ', async () => {
    let loginBody: unknown = null;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope(null, 401, 'AUTH_1003'), { status: 401 }),
      ),
      http.get(`${BASE}/api/auth/google/nonce`, () =>
        HttpResponse.json(envelope({ nonce: 'n-1', expiresAt: '2026-09-20T00:05:00Z' })),
      ),
      http.post(`${BASE}/api/auth/google/mobile`, async ({ request }) => {
        loginBody = await request.json();
        return HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' }));
      }),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    // Gọi hàm trực tiếp (không phải qua render) nên phải tự bọc act để React
    // xử lý các lần setState bên trong signInWithGoogle theo đúng một lượt.
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(loginBody).toEqual({ credential: 'id-token-abc', nonce: 'n-1' });
  });

  it('đăng xuất: gọi logout, xoá cookie và về trạng thái chưa đăng nhập', async () => {
    const { clearSessionCookies } = jest.requireMock('@/core/auth/session');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' })),
      ),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
      http.post(`${BASE}/api/auth/logout`, () => HttpResponse.json(envelope(null))),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(clearSessionCookies).toHaveBeenCalledTimes(1);
  });
});
