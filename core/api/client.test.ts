import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import {
  __resetApiClientForTests,
  apiClient,
  getAccessToken,
  setAccessToken,
  setUnauthenticatedHandler,
} from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';

const BASE = 'https://api.skillswap.asia';

function envelope(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    timestamp: '2026-09-20T00:00:00Z',
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
    ...overrides,
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('apiClient', () => {
  it('bóc envelope và trả thẳng payload', async () => {
    server.use(
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope({ email: 'a@b.com' }))),
    );

    await expect(apiClient<{ email: string }>('/api/auth/me')).resolves.toEqual({
      email: 'a@b.com',
    });
  });

  it('trả về null khi backend trả data null với HTTP 200 (không coi là lỗi)', async () => {
    server.use(
      http.get(`${BASE}/api/bookings/b1/feedback`, () => HttpResponse.json(envelope(null))),
    );

    await expect(apiClient('/api/bookings/b1/feedback')).resolves.toBeNull();
  });

  it('đính kèm Authorization khi đã có access token', async () => {
    let seen: string | null = null;
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        seen = request.headers.get('Authorization');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );
    setAccessToken('token-1');

    await apiClient('/api/auth/me');

    expect(seen).toBe('Bearer token-1');
  });

  it('gặp 401 thì refresh rồi retry đúng một lần', async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        meCalls += 1;
        if (request.headers.get('Authorization') !== 'Bearer token-moi') {
          return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
            status: 401,
          });
        }
        return HttpResponse.json(envelope({ email: 'a@b.com' }));
      }),
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(envelope({ accessToken: 'token-moi', tokenType: 'Bearer' }));
      }),
    );
    setAccessToken('token-cu');

    await expect(apiClient<{ email: string }>('/api/auth/me')).resolves.toEqual({
      email: 'a@b.com',
    });
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('token-moi');
  });

  it('refresh thành công nhưng request gốc vẫn 401 thì không refresh lần hai, ném ApiClientError', async () => {
    let profileCalls = 0;
    let refreshCalls = 0;
    const onUnauthenticated = jest.fn();
    server.use(
      // Endpoint này luôn trả 401 dù token có mới hay không — mô phỏng trường
      // hợp refresh thành công nhưng request bị retry vẫn thất bại vì lý do khác
      // (ví dụ hết quyền trên đúng resource đó).
      http.get(`${BASE}/api/me/profile`, () => {
        profileCalls += 1;
        return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
          status: 401,
        });
      }),
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(envelope({ accessToken: 'token-moi', tokenType: 'Bearer' }));
      }),
    );
    setAccessToken('token-cu');
    setUnauthenticatedHandler(onUnauthenticated);

    const pending = apiClient('/api/me/profile');
    await expect(pending).rejects.toBeInstanceOf(ApiClientError);
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(profileCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    // Hành vi thực tế: khối try trong interceptor bọc luôn cả lệnh retry
    // (`await axiosInstance(originalRequest)`), nên khi request được retry vẫn
    // 401, lỗi đó rơi vào cùng catch với lỗi refresh và handler mất phiên vẫn
    // được gọi — dù refresh access token tự nó đã thành công. Đây là hành vi
    // hiện có của interceptor (không phải vòng lặp hay refresh hai lần), ghi
    // nhận đúng như quan sát được, không sửa implementation để hợp với kỳ vọng.
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('nhiều request 401 song song chỉ gọi refresh một lần', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/api/me/bookings`, ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer token-moi') {
          return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
            status: 401,
          });
        }
        return HttpResponse.json(envelope([]));
      }),
      http.get(`${BASE}/api/me/notifications`, ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer token-moi') {
          return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
            status: 401,
          });
        }
        return HttpResponse.json(envelope([]));
      }),
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(envelope({ accessToken: 'token-moi', tokenType: 'Bearer' }));
      }),
    );
    setAccessToken('token-cu');

    await Promise.all([apiClient('/api/me/bookings'), apiClient('/api/me/notifications')]);

    expect(refreshCalls).toBe(1);
  });

  it('refresh thất bại thì gọi handler mất phiên và ném ApiClientError', async () => {
    const onUnauthenticated = jest.fn();
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), { status: 401 }),
      ),
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1003' }), { status: 401 }),
      ),
    );
    setAccessToken('token-cu');
    setUnauthenticatedHandler(onUnauthenticated);

    await expect(apiClient('/api/auth/me')).rejects.toBeInstanceOf(ApiClientError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('không tự refresh cho chính các endpoint auth', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1003' }), {
          status: 401,
        });
      }),
    );

    await expect(apiClient('/api/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(
      ApiClientError,
    );
    expect(refreshCalls).toBe(1);
  });

  it('giữ lại retryAfterSeconds của lỗi 429', async () => {
    server.use(
      http.post(`${BASE}/api/forum/posts`, () =>
        HttpResponse.json(
          envelope(null, {
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Bạn đăng bài quá nhanh',
            retryAfterSeconds: 120,
          }),
          { status: 429 },
        ),
      ),
    );

    await expect(
      apiClient('/api/forum/posts', { method: 'POST', data: { title: 'x' } }),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 120 });
  });

  it('không gọi được server thì ném ApiClientError status 0', async () => {
    server.use(http.get(`${BASE}/api/auth/me`, () => HttpResponse.error()));

    await expect(apiClient('/api/auth/me')).rejects.toMatchObject({ status: 0 });
  });
});
