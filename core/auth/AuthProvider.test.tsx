import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests, apiClient } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { AuthProvider, useAuth } from '@/core/auth/AuthProvider';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/auth/googleSignIn', () => ({
  configureGoogleSignIn: jest.fn(),
  getGoogleIdToken: jest.fn().mockResolvedValue('id-token-abc'),
  signOutGoogle: jest.fn().mockResolvedValue(undefined),
  GoogleSignInCancelledError: class extends Error {},
}));

/**
 * Keystore giả giữ trong RAM. Cố ý KHÔNG mock `@/core/auth/session`: mock ở đúng
 * biên native để `session.ts`, `client.ts` và `authRepo.ts` THẬT cùng nằm trong
 * đường chạy. Nhờ vậy các test dưới đây kiểm được câu hỏi thật sự quan trọng —
 * "phiên có sống qua lần mở app sau hay không" — bằng chính đường code sẽ chạy
 * trên thiết bị, chứ không qua một seam do test dựng ra.
 */
jest.mock('expo-secure-store', () =>
  require('@/core/auth/__testing__/khoBaoMatGiaLap').taoKhoBaoMatGiaLap(),
);

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
afterEach(async () => {
  server.resetHandlers();
  __resetApiClientForTests();
  jest.clearAllMocks();
  await xoaRefreshToken();
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
  it('khởi động app: refresh bằng token đã lưu thành công thì vào trạng thái đã đăng nhập', async () => {
    // Đây là lý do tồn tại của cả thay đổi này: phiên sống qua lần tắt app nhờ
    // refresh token nằm trong keystore, không nhờ cookie native nữa.
    await luuRefreshToken('rt-con-tot');
    let headerThayDuoc: string | null = null;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, ({ request }) => {
        headerThayDuoc = request.headers.get('X-Refresh-Token');
        return HttpResponse.json(envelope({ accessToken: 'at-1', tokenType: 'Bearer' }));
      }),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.publicId).toBe('u-1');
    expect(headerThayDuoc).toBe('rt-con-tot');
  });

  it('khởi động app: máy chưa lưu token nào thì KHÔNG gọi /api/auth/refresh', async () => {
    // Một máy vừa cài app (hoặc vừa đăng xuất) không có gì để refresh. Gọi API
    // rỗng chỉ để nhận 401 là chèn một round trip mạng vào đúng lúc khởi động,
    // trước khi màn hình đăng nhập kịp hiện ra.
    let soLanGoiRefresh = 0;
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () => {
        soLanGoiRefresh += 1;
        return HttpResponse.json(envelope(null, 401, 'AUTH_1003'), { status: 401 });
      }),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    expect(soLanGoiRefresh).toBe(0);
  });

  it('khởi động app: token đã lưu bị backend từ chối (401) thì xoá nó và ra màn hình đăng nhập', async () => {
    // Trên iOS, dữ liệu SecureStore sống qua lần CÀI LẠI app cùng bundle ID, nên
    // một refresh token đã bị thu hồi hoàn toàn có thể còn nằm trong Keychain sau
    // khi cài lại. Không xoá thì mỗi lần mở app lại tốn một request 401 và máy đó
    // không bao giờ tự thoát khỏi vòng lặp vô ích ấy.
    await luuRefreshToken('rt-da-chet');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(envelope(null, 401, 'AUTH_1003'), { status: 401 }),
      ),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('đăng nhập Google: KHÔNG xin nonce, gửi mỗi credential, lưu refresh token rồi nạp hồ sơ', async () => {
    // AuthProvider ghi log chẩn đoán spike R1 khi __DEV__ === true (đúng như
    // trong Jest) — chặn console.log riêng cho test này, không tắt toàn cục,
    // để output `npm test` giữ nguyên tinh khiết mà không che các console.log
    // thật sự là lỗi ở các test khác.
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    let loginBody: unknown = null;
    let soLanGoiNonce = 0;
    server.use(
      // Handler nonce vẫn được khai báo ở ĐÂY (chỉ trong test này) để đếm: nếu
      // AuthProvider còn gọi nó, `soLanGoiNonce` sẽ khác 0. Bỏ handler đi thì
      // `onUnhandledRequest: 'error'` cũng bắt được, nhưng thông báo lỗi sẽ nói
      // về một request lạ chứ không nói về chính điều test này tuyên bố.
      http.get(`${BASE}/api/auth/google/nonce`, () => {
        soLanGoiNonce += 1;
        return HttpResponse.json(envelope({ nonce: 'n-1', expiresAt: '2026-09-20T00:05:00Z' }));
      }),
      http.post(`${BASE}/api/auth/google/mobile`, async ({ request }) => {
        loginBody = await request.json();
        return HttpResponse.json(
          envelope({ accessToken: 'at-1', refreshToken: 'rt-vua-cap', tokenType: 'Bearer' }),
        );
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
    // Mỗi lần đăng nhập mà còn xin nonce là một round trip dư VÀ một nonce
    // dùng-một-lần bị đốt vô ích ở backend.
    expect(soLanGoiNonce).toBe(0);
    expect(loginBody).toEqual({ credential: 'id-token-abc' });
    // Không lưu được refresh token thì phiên này chết ngay khi tắt app.
    await expect(docRefreshToken()).resolves.toBe('rt-vua-cap');

    logSpy.mockRestore();
  });

  it('đăng xuất: gọi logout, xoá refresh token đã lưu và về trạng thái chưa đăng nhập', async () => {
    await luuRefreshToken('rt-con-tot');
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
    // Còn sót token trong keystore thì lần mở app sau sẽ tự đăng nhập lại vào
    // đúng tài khoản người dùng vừa chủ động thoát.
    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('đăng xuất khi logout lỗi mạng vẫn kết thúc phiên cục bộ VÀ xoá token đã lưu', async () => {
    // Nếu phần dọn dẹp nằm trong nhánh thành công thay vì `finally`, người dùng
    // bấm thoát lúc mất mạng sẽ vẫn ở trạng thái đã đăng nhập với token còn
    // sống — tưởng đã thoát mà thực ra chưa, và lần mở app sau còn vào lại được
    // bằng refresh token nằm trong keystore. Test này khoá nhánh `finally` ở mức
    // AuthProvider; cùng bất biến đó ở mức repository do authRepo.test.ts khoá.
    await luuRefreshToken('rt-con-tot');
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

    // Fix 4 (đợt review cuối): state phiên phải được dọn xong trong khối `finally`
    // TRƯỚC mọi bước dọn dẹp chậm, nên một lỗi ở bất kỳ đâu sau đó cũng không thể
    // để lại phiên nửa chừng (status 'authenticated' mà accessToken đã mất).
    //
    // GHI CHÚ cho người đọc sau: trước đây còn một test riêng cho tình huống
    // "`clearSessionCookies()` trong `finally` reject". Tình huống đó biến mất
    // cùng cookie manager: bước dọn dẹp bền duy nhất còn lại là
    // `xoaRefreshToken()`, và nó KHÔNG BAO GIỜ ném (bọc try/catch trong
    // `session.ts`, có test riêng ở `session.test.ts` và `authRepo.test.ts`).
    // Nên thứ tự trong `finally` giờ được khoá bởi đúng test này.
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('phiên chết giữa lúc đang dùng (401 lần hai) thì xoá cả refresh token đã lưu', async () => {
    // Đường này KHÔNG đi qua `authRepo.logout()`: nó là `setUnauthenticatedHandler`
    // của client bị gọi vì request bị retry vẫn 401 sau một lần refresh thành công.
    // Nếu chỉ `logout()` mới xoá token thì ở đây token còn nguyên trong keystore,
    // và lần mở app sau sẽ tự đăng nhập lại vào một phiên vừa bị tuyên là chết.
    await luuRefreshToken('rt-ban-dau');
    server.use(
      http.post(`${BASE}/api/auth/refresh`, () =>
        HttpResponse.json(
          envelope({ accessToken: 'at-moi', refreshToken: 'rt-con-song', tokenType: 'Bearer' }),
        ),
      ),
      http.get(`${BASE}/api/auth/me`, () => HttpResponse.json(envelope(ME))),
      // Luôn 401 kể cả với token mới: refresh thành công nhưng request vẫn bị từ
      // chối → interceptor coi là phiên chết thật.
      http.get(`${BASE}/api/me/profile`, () =>
        HttpResponse.json(envelope(null, 401, 'AUTH_1001'), { status: 401 }),
      ),
    );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    // Chốt lại điều kiện xuất phát: keystore ĐANG có token sống (do lần refresh
    // lúc khởi động rotate ra). Không chốt thì test có thể xanh chỉ vì keystore
    // vốn đã rỗng từ đầu.
    await expect(docRefreshToken()).resolves.toBe('rt-con-song');

    await act(async () => {
      await apiClient('/api/me/profile').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await waitFor(async () => {
      await expect(docRefreshToken()).resolves.toBeNull();
    });
  });

  it('đăng xuất: xoá sạch cache TanStack Query để tài khoản sau không thấy dữ liệu tài khoản trước', async () => {
    // Trên thiết bị dùng chung, nếu cache (gcTime 5 phút) không bị xoá khi đăng
    // xuất, tài khoản B đăng nhập sau vẫn có thể render thoáng qua dữ liệu đã
    // cache của tài khoản A trước khi các query refetch xong.
    await luuRefreshToken('rt-con-tot');
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
