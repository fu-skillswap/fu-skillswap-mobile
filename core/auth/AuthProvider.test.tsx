import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
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

// AuthProvider giờ dùng useQueryClient() (Fix 4: xoá cache TanStack Query khi
// đăng xuất) nên bắt buộc phải có QueryClientProvider bao ngoài, đúng như thứ tự
// thật ở app/_layout.tsx. Mỗi lần gọi tạo một QueryClient mới để test không dây
// cache vào nhau; truyền `queryClient` riêng khi cần kiểm tra chính cái cache đó.
function createWrapper(queryClient: QueryClient = new QueryClient()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

const wrapper = createWrapper();

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

  it('đăng xuất khi logout lỗi mạng vẫn kết thúc phiên cục bộ', async () => {
    // Nếu phần dọn dẹp nằm trong nhánh thành công thay vì `finally`, người dùng
    // bấm thoát lúc mất mạng sẽ vẫn ở trạng thái đã đăng nhập với token còn
    // sống — tưởng đã thoát mà thực ra chưa. Test này khoá nhánh `finally` ở
    // mức AuthProvider (authRepo.test.ts chỉ khoá được phần xoá access token).
    const { clearSessionCookies } = jest.requireMock('@/core/auth/session');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' })),
      ),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
      http.post(`${BASE}/api/auth/logout`, () => HttpResponse.error()),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await expect(result.current.signOut()).rejects.toBeInstanceOf(ApiClientError);
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    expect(clearSessionCookies).toHaveBeenCalledTimes(1);
  });

  it('đăng xuất: xoá sạch cache TanStack Query để tài khoản sau không thấy dữ liệu tài khoản trước', async () => {
    // Trên thiết bị dùng chung, nếu cache (gcTime 5 phút) không bị xoá khi đăng
    // xuất, tài khoản B đăng nhập sau vẫn có thể render thoáng qua dữ liệu đã
    // cache của tài khoản A trước khi các query refetch xong.
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' })),
      ),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
      http.post(`${BASE}/api/auth/logout`, () => HttpResponse.json(envelope(null))),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(['newsfeed'], { posts: ['bai-cua-tai-khoan-a'] });

    const { result } = await renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await act(async () => {
      await result.current.signOut();
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(queryClient.getQueryData(['newsfeed'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
