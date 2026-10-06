import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Platform } from 'react-native';

import {
  __resetApiClientForTests,
  apiClient,
  getAccessToken,
  refreshSession,
  setAccessToken,
  setUnauthenticatedHandler,
} from '@/core/api/client';
import { ApiClientError, toUserMessage } from '@/core/api/errors';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';
import { resetEnvCache } from '@/core/config/env';

/**
 * Keystore giả giữ trong RAM. Cố ý KHÔNG mock `@/core/auth/session`: mock đúng ở
 * biên native để `core/auth/session.ts` THẬT chạy trong các test này — nhờ vậy
 * chuỗi "client đọc token đã lưu → gửi header → ghi lại token rotate" được kiểm
 * end-to-end thay vì kiểm qua một seam do chính test dựng ra.
 */
jest.mock('expo-secure-store', () =>
  require('@/core/auth/__testing__/khoBaoMatGiaLap').taoKhoBaoMatGiaLap(),
);

const BASE = 'https://api.skillswap.asia';

/** Platform.OS là thuộc tính chỉ đọc theo typings của RN, phải ghi đè qua defineProperty */
function datNenTang(os: typeof Platform.OS): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const NEN_TANG_GOC = Platform.OS;

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
beforeEach(async () => {
  datNenTang(NEN_TANG_GOC);
  // Mặc định: máy ĐÃ có refresh token lưu trong keystore. Không có nó thì
  // `refreshAccessToken()` ném ngay mà không gọi API (đúng theo thiết kế), và
  // mọi test về luồng 401 → refresh → retry bên dưới sẽ không còn kiểm được gì.
  await luuRefreshToken('rt-da-luu');
});
afterEach(async () => {
  server.resetHandlers();
  __resetApiClientForTests();
  await xoaRefreshToken();
});
afterAll(() => {
  datNenTang(NEN_TANG_GOC);
  server.close();
});

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

  it('envelope VẮNG khoá data (backend @JsonInclude NON_NULL) thì trả null, không trả cả envelope', async () => {
    server.use(
      http.post(`${BASE}/api/me/bookings/b1/confirm`, () =>
        HttpResponse.json({
          timestamp: '2026-09-20T00:00:00Z',
          status: 200,
          code: 'SUCCESS_0200',
          message: 'Thành công',
        }),
      ),
    );

    await expect(apiClient('/api/me/bookings/b1/confirm', { method: 'POST' })).resolves.toBeNull();
  });

  it('JSON trần không bọc envelope (AI service /v1/chat) thì trả nguyên văn', async () => {
    const phanHoi = { content: 'Chào bạn', requestId: 'req-1', sourcesUsed: ['a'] };
    server.use(http.post('https://ai.test/v1/chat', () => HttpResponse.json(phanHoi)));

    await expect(
      apiClient('/v1/chat', { method: 'POST', baseURL: 'https://ai.test', data: {} }),
    ).resolves.toEqual(phanHoi);
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
    // Request bị retry vẫn 401 sau khi refresh đã thành công: interceptor coi
    // đây là "phiên chết thật" (401 lần hai, không phải lỗi nhất thời) nên vẫn
    // gọi handler mất phiên — khác với lỗi 500/403/429/mất mạng ở request bị
    // retry, những lỗi đó không được coi là mất phiên (xem test 500 bên dưới).
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('refresh thành công nhưng request bị retry lỗi 500 (nhất thời) thì KHÔNG đăng xuất', async () => {
    // Đây là bug đã sửa: trước kia khối try trong interceptor bọc luôn cả lệnh
    // retry, nên bất kỳ lỗi nào ở request bị retry (kể cả 500 nhất thời) đều rơi
    // vào cùng catch với lỗi refresh và làm người dùng bị đăng xuất oan.
    let profileCalls = 0;
    let refreshCalls = 0;
    const onUnauthenticated = jest.fn();
    server.use(
      http.get(`${BASE}/api/me/profile`, ({ request }) => {
        profileCalls += 1;
        if (request.headers.get('Authorization') !== 'Bearer token-moi') {
          // Lần gọi đầu tiên, token cũ đã hết hạn -> 401 để kích hoạt refresh.
          return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
            status: 401,
          });
        }
        // Request được retry với token mới, nhưng server đang gặp sự cố tạm thời.
        return HttpResponse.json(envelope(null, { status: 500, code: 'INTERNAL_ERROR' }), {
          status: 500,
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
    await expect(pending).rejects.toMatchObject({ status: 500 });
    expect(profileCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(onUnauthenticated).not.toHaveBeenCalled();
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

  it.each([
    ['mất mạng', () => HttpResponse.error()],
    ['lỗi 503', () => HttpResponse.json(envelope(null, { status: 503, code: 'SYS_5030' }), { status: 503 })],
  ])('refresh gặp %s thì KHÔNG đăng xuất, request gốc bị từ chối', async (_ten, traLoiRefresh) => {
    const onUnauthenticated = jest.fn();
    server.use(
      http.get(`${BASE}/api/auth/me`, () =>
        HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), { status: 401 }),
      ),
      http.post(`${BASE}/api/auth/refresh`, traLoiRefresh),
    );
    setAccessToken('token-cu');
    setUnauthenticatedHandler(onUnauthenticated);

    await expect(apiClient('/api/auth/me')).rejects.toBeInstanceOf(ApiClientError);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('lỗi dạng FastAPI `{ detail }` (AI service) thì lấy `detail` làm thông điệp', async () => {
    server.use(
      http.post('https://ai.test/v1/chat', () =>
        HttpResponse.json({ detail: 'Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.' }, { status: 429 }),
      ),
    );

    const loi = await apiClient('/v1/chat', { method: 'POST', baseURL: 'https://ai.test', data: {} }).catch(
      (e: unknown) => e,
    );
    expect(loi).toBeInstanceOf(ApiClientError);
    expect((loi as ApiClientError).status).toBe(429);
    expect((loi as ApiClientError).message).toBe('Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.');
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

  it('đăng xuất trong lúc refresh đang chạy ngầm thì không hồi sinh token cũ', async () => {
    // Kịch bản: request gặp 401, refresh bắt đầu chạy nhưng chậm (server delay).
    // Trong lúc đó người dùng đăng xuất (setAccessToken(null)). Khi refresh cuối
    // cùng cũng xong, KHÔNG được ghi token mới vào bộ nhớ — nếu không, một phiên
    // đã bị đăng xuất sẽ sống lại ngay sau khi AuthProvider báo unauthenticated.
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer token-moi') {
          return HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1001' }), {
            status: 401,
          });
        }
        return HttpResponse.json(envelope({ email: 'a@b.com' }));
      }),
      http.post(`${BASE}/api/auth/refresh`, async () => {
        await delay(50);
        return HttpResponse.json(envelope({ accessToken: 'token-moi', tokenType: 'Bearer' }));
      }),
    );
    setAccessToken('token-cu');

    const pending = apiClient<{ email: string }>('/api/auth/me');
    // Chờ đúng lúc request gốc đã 401 và refresh (còn đang delay 50ms) đã bắt
    // đầu, rồi đăng xuất ngay giữa chừng.
    await new Promise((resolve) => setTimeout(resolve, 10));
    setAccessToken(null);

    await pending.catch(() => undefined);

    expect(getAccessToken()).toBeNull();
  });
});

describe('cấu hình môi trường', () => {
  it('import module không ném lỗi ngay cả khi thiếu biến môi trường bắt buộc', async () => {
    const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
    const originalGoogleId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    try {
      await jest.isolateModulesAsync(async () => {
        const { resetEnvCache: resetIsolatedEnvCache } = require('@/core/config/env');
        resetIsolatedEnvCache();
        // Đây là điểm mấu chốt: import module KHÔNG được gọi getEnv() ngay lúc
        // evaluate (baseURL của axios phải được tạo lười, ở lần gọi API đầu
        // tiên) — nếu không, một build thiếu biến môi trường sẽ chết ngay lúc
        // khởi động app, trước khi có cây React hay error boundary nào bắt được.
        expect(() => require('@/core/api/client')).not.toThrow();
      });
    } finally {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = originalGoogleId;
      resetEnvCache();
    }
  });

  it('__resetApiClientForTests xoá luôn axios instance đã memo hoá, không chỉ token/epoch/handler', async () => {
    // Fix 3 (đợt review cuối): axios instance được tạo lười và nhớ lại (memo
    // hoá) ở lần request đầu tiên — chốt baseURL đọc từ getEnv() ngay lúc đó.
    // Nếu __resetApiClientForTests() không xoá luôn instance này, một test đổi
    // EXPO_PUBLIC_API_URL rồi gọi resetEnvCache() sẽ thấy resetEnvCache() "như
    // không làm gì": request tiếp theo vẫn âm thầm bay tới baseURL CŨ.
    const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
    const NEW_BASE = 'https://api-doi.skillswap.asia';
    try {
      // Chạm getAxiosInstance() một lần với baseURL CŨ để nó bị memo hoá.
      server.use(http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope({ ok: true }))));
      await apiClient('/api/auth/me');

      process.env.EXPO_PUBLIC_API_URL = NEW_BASE;
      resetEnvCache();
      __resetApiClientForTests();

      let calledNewBase = false;
      server.use(
        http.get(`${NEW_BASE}/api/auth/me`, () => {
          calledNewBase = true;
          return HttpResponse.json(envelope({ ok: true }));
        }),
      );

      await apiClient('/api/auth/me');

      expect(calledNewBase).toBe(true);
    } finally {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
      resetEnvCache();
    }
  });
});

describe('header nhận diện client mobile', () => {
  it('mọi request mang X-Client-Type: mobile và X-Client-Platform theo Platform.OS', async () => {
    // Backend quyết định "đây là client mobile" qua `isMobileClient()`: có refresh
    // token trong body/header, HOẶC `X-Client-Type: mobile`, HOẶC
    // `X-Client-Platform: android|ios`. Chỉ khi là mobile thì `/api/auth/refresh`
    // mới trả refreshToken mới trong body — không có header này thì cơ chế tự
    // lưu token của app đứt ngay từ lần rotate đầu tiên.
    datNenTang('android');
    let clientType: string | null = null;
    let clientPlatform: string | null = null;
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        clientType = request.headers.get('X-Client-Type');
        clientPlatform = request.headers.get('X-Client-Platform');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );

    await apiClient('/api/auth/me');

    expect(clientType).toBe('mobile');
    expect(clientPlatform).toBe('android');
  });

  it('trên iOS thì X-Client-Platform là ios, không phải android', async () => {
    // Phải kiểm cả hai giá trị: nếu code hard-code 'android' thì test vẫn xanh,
    // và app iOS sẽ bị backend đối xử như Android — nghĩa là bị chặn checkout
    // bằng PAY_4031 ngay cả ở nền tảng không chịu ràng buộc của Google Play.
    datNenTang('ios');
    let clientPlatform: string | null = null;
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        clientPlatform = request.headers.get('X-Client-Platform');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );

    await apiClient('/api/auth/me');

    expect(clientPlatform).toBe('ios');
  });

  it('nền tảng không phải android/ios thì KHÔNG bịa X-Client-Platform', async () => {
    // `react-native-web` có trong dependencies nên `Platform.OS === 'web'` là
    // trạng thái đạt tới được. Backend chỉ hiểu `android|ios`; khai khống
    // 'android' ở đây là tự nhận một lệnh chặn thanh toán (PAY_4031) mà nền tảng
    // đó không hề bị ràng buộc. `X-Client-Type: mobile` vẫn đủ để backend trả
    // refresh token trong body.
    datNenTang('web');
    let clientType: string | null = null;
    let coHeaderNenTang = true;
    server.use(
      http.get(`${BASE}/api/auth/me`, ({ request }) => {
        clientType = request.headers.get('X-Client-Type');
        coHeaderNenTang = request.headers.has('X-Client-Platform');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );

    await apiClient('/api/auth/me');

    expect(clientType).toBe('mobile');
    expect(coHeaderNenTang).toBe(false);
  });
});

describe('refresh token tự lưu (thay cookie native)', () => {
  it('gửi refresh token đã lưu qua header X-Refresh-Token', async () => {
    // `AuthController.extractRefreshToken()` đọc header TRƯỚC, rồi mới tới body
    // JSON, rồi mới tới cookie. App không còn cookie nào nên header là đường duy nhất.
    await luuRefreshToken('rt-cua-may-nay');
    let headerThayDuoc: string | null = null;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, ({ request }) => {
        headerThayDuoc = request.headers.get('X-Refresh-Token');
        return HttpResponse.json(envelope({ accessToken: 'at-moi', tokenType: 'Bearer' }));
      }),
    );

    await expect(refreshSession()).resolves.toBe('at-moi');

    expect(headerThayDuoc).toBe('rt-cua-may-nay');
  });

  it('chưa có refresh token nào thì KHÔNG gọi /api/auth/refresh, ném luôn', async () => {
    // Gọi `/refresh` rỗng chỉ nhận về 401 và làm chậm lúc khởi động app (một
    // round trip mạng trước khi vào được màn hình đăng nhập). `onUnhandledRequest:
    // 'error'` không bắt được việc này vì handler vẫn tồn tại — phải tự đếm.
    await xoaRefreshToken();
    let soLanGoi = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        soLanGoi += 1;
        return HttpResponse.json(envelope({ accessToken: 'at-moi', tokenType: 'Bearer' }));
      }),
    );

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });

    expect(soLanGoi).toBe(0);
  });

  it('chưa có refresh token: lỗi vẫn phải là ApiClientError 401 để giao diện mời đăng nhập lại', async () => {
    // `toUserMessage()` chỉ trả action 'LOGIN' cho `ApiClientError` có status 401;
    // mọi lỗi khác thành "Đã có lỗi xảy ra / thử lại sau ít phút / RETRY" — lời
    // khuyên sai hoàn toàn với một phiên không tồn tại. Kiểm qua đúng hàm quy đổi
    // thật thay vì chỉ kiểm tên lớp lỗi.
    await xoaRefreshToken();

    const loi = await refreshSession().then(
      () => null,
      (e: unknown) => e,
    );

    expect(toUserMessage(loi).action).toBe('LOGIN');
  });

  it('refresh trả refreshToken mới thì ghi đè token đã lưu (backend rotate token)', async () => {
    await luuRefreshToken('rt-cu');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(
          envelope({ accessToken: 'at-moi', refreshToken: 'rt-moi', tokenType: 'Bearer' }),
        ),
      ),
    );

    await refreshSession();

    // Không ghi lại token mới nghĩa là lần refresh SAU vẫn gửi `rt-cu` đã bị
    // backend thu hồi khi rotate — phiên chết sau đúng một vòng refresh.
    await expect(docRefreshToken()).resolves.toBe('rt-moi');
  });

  it('refresh không trả refreshToken thì KHÔNG ghi gì vào keystore', async () => {
    // `TokenResponse.refreshToken` là `null` với client web. Nếu client ghi đè vô
    // điều kiện, một phản hồi hình dạng đó sẽ đè lên token đang dùng được.
    //
    // ĐÃ ĐO khi làm falsification: hành vi này được HAI guard độc lập bảo vệ —
    // `if (tokenRes.refreshToken)` ở client.ts và `if (!token)` trong
    // `luuRefreshToken()`. Phá đúng một trong hai thì test này VẪN xanh, vì guard
    // còn lại đỡ. Nên test này cố ý khoá KẾT QUẢ (không ghi, token cũ còn nguyên)
    // chứ không khoá một dòng cụ thể; muốn thấy nó đỏ phải bỏ cả hai guard. Guard
    // bên trong `session.ts` có điểm phá riêng, một dòng, ở `session.test.ts`
    // ("token rỗng thì không chạm vào keystore").
    await luuRefreshToken('rt-con-dung-duoc');
    const kho = jest.requireMock('expo-secure-store');
    kho.setItemAsync.mockClear();
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(
          envelope({ accessToken: 'at-moi', refreshToken: null, tokenType: 'Bearer' }),
        ),
      ),
    );

    await refreshSession();

    expect(kho.setItemAsync).not.toHaveBeenCalled();
    await expect(docRefreshToken()).resolves.toBe('rt-con-dung-duoc');
  });

  it('refresh bị 401 thì xoá token đã lưu (token chết sau khi cài lại app trên iOS)', async () => {
    // Trên iOS dữ liệu SecureStore sống qua lần cài lại app cùng bundle ID, nên
    // một refresh token đã bị thu hồi có thể còn nằm đó. Không xoá thì mỗi lần
    // mở app lại tốn một request 401 và không bao giờ tự thoát khỏi vòng đó.
    await luuRefreshToken('rt-da-chet');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope(null, { status: 401, code: 'AUTH_1003' }), { status: 401 }),
      ),
    );

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);

    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('refresh thất bại vì MẤT MẠNG thì GIỮ token đã lưu', async () => {
    // Phân biệt "backend từ chối token" với "không gọi tới được backend". Xoá
    // token khi mất mạng sẽ bắt người dùng đăng nhập lại bằng Google chỉ vì mở
    // app lúc đang offline — và họ cũng không đăng nhập lại được, vì offline.
    await luuRefreshToken('rt-con-tot');
    server.use(http.post(`${BASE}/api/auth/refresh`, () => HttpResponse.error()));

    await expect(refreshSession()).rejects.toMatchObject({ status: 0 });

    await expect(docRefreshToken()).resolves.toBe('rt-con-tot');
  });

  it('đăng xuất giữa lúc refresh đang chạy thì KHÔNG ghi refresh token mới vào keystore', async () => {
    // Cùng cơ chế sessionEpoch đã bảo vệ access token: token mới nhận về sau khi
    // người dùng đã đăng xuất là rác. Ghi nó xuống keystore sẽ hồi sinh phiên đã
    // chết ở lần MỞ APP SAU — một lỗi còn khó thấy hơn vì nó không xảy ra ngay.
    await luuRefreshToken('rt-truoc-khi-dang-xuat');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, async () => {
        await delay(50);
        return HttpResponse.json(
          envelope({ accessToken: 'at-moi', refreshToken: 'rt-rac', tokenType: 'Bearer' }),
        );
      }),
    );

    const pending = refreshSession();
    await new Promise((resolve) => setTimeout(resolve, 10));
    setAccessToken(null);
    await pending.catch(() => undefined);

    await expect(docRefreshToken()).resolves.toBe('rt-truoc-khi-dang-xuat');
    expect(getAccessToken()).toBeNull();
  });
});
