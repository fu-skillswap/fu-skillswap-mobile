import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { __resetApiClientForTests, getAccessToken, setAccessToken } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { authRepo } from '@/core/auth/authRepo';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';

/** Keystore giả — `core/auth/session.ts` thật chạy trên nó, xem JSDoc của helper */
jest.mock('expo-secure-store', () =>
  require('@/core/auth/__testing__/khoBaoMatGiaLap').taoKhoBaoMatGiaLap(),
);

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
afterEach(async () => {
  server.resetHandlers();
  __resetApiClientForTests();
  await xoaRefreshToken();
});
afterAll(() => server.close());

describe('authRepo', () => {
  // Endpoint mobile-only `POST /api/auth/google/mobile` ĐÃ tồn tại trên backend.
  // Body chỉ có `{ credential }`: `GoogleAuthService.verifyMobilePayload()` gọi
  // `verifyPayload(payload, null, ...)`, tức bỏ hẳn bước so khớp claim `nonce`
  // (thư viện Google Sign-In miễn phí không đưa được claim đó vào ID Token).
  // Chống replay là việc của `GoogleMobileTokenReplayService` ở phía backend.
  it('đăng nhập Google gửi body CHỈ gồm credential, không có nonce', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${BASE}/api/auth/google/mobile`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          envelope({ accessToken: 'at-1', refreshToken: 'rt-1', tokenType: 'Bearer' }),
        );
      }),
    );

    await authRepo.loginWithGoogle({ credential: 'cred-1' });

    // `toEqual` so khớp CHÍNH XÁC tập khoá: còn sót `nonce` là đỏ. Backend mobile
    // không cấp nonce nữa, gửi kèm chỉ là một field rác không ai đọc.
    expect(body).toEqual({ credential: 'cred-1' });
    expect(getAccessToken()).toBe('at-1');
  });

  it('đăng nhập Google lưu refreshToken xuống keystore', async () => {
    // Đây là thay thế cho cookie HttpOnly cũ. Không lưu thì phiên chỉ sống tới
    // lúc tắt app: lần mở sau `refreshAccessToken()` không có gì để gửi và người
    // dùng phải đăng nhập lại bằng Google mỗi lần.
    server.use(
      http.post(`${BASE}/api/auth/google/mobile`, () =>
        HttpResponse.json(
          envelope({ accessToken: 'at-1', refreshToken: 'rt-cua-phien-moi', tokenType: 'Bearer' }),
        ),
      ),
    );

    await authRepo.loginWithGoogle({ credential: 'cred-1' });

    await expect(docRefreshToken()).resolves.toBe('rt-cua-phien-moi');
  });

  it('phản hồi không có refreshToken thì không ghi gì vào keystore', async () => {
    // `TokenResponse.refreshToken` là `null` với client web. Nếu backend trả về
    // hình dạng đó cho mobile (cấu hình sai, hoặc header nhận diện client bị mất),
    // app không được ghi `null`/chuỗi rỗng xuống keystore rồi tưởng mình có phiên
    // bền — nó phải để trống để lần mở app sau ra thẳng màn hình đăng nhập.
    //
    // ĐÃ ĐO khi làm falsification: hành vi này được HAI guard độc lập bảo vệ —
    // `if (token.refreshToken)` ở đây và `if (!token)` trong `luuRefreshToken()`.
    // Phá đúng một trong hai thì test VẪN xanh vì guard còn lại đỡ. Test này cố ý
    // khoá KẾT QUẢ (không ghi gì) chứ không khoá một dòng cụ thể; guard bên trong
    // `session.ts` có điểm phá riêng, một dòng, ở `session.test.ts`.
    const kho = jest.requireMock('expo-secure-store');
    // Test file này không gọi `jest.clearAllMocks()`, nên phải tự xoá bộ đếm —
    // không thì các test trước đó đã làm `setItemAsync` khác 0 từ trước.
    kho.setItemAsync.mockClear();
    server.use(
      http.post(`${BASE}/api/auth/google/mobile`, () =>
        HttpResponse.json(envelope({ accessToken: 'at-1', refreshToken: null, tokenType: 'Bearer' })),
      ),
    );

    await authRepo.loginWithGoogle({ credential: 'cred-1' });

    expect(kho.setItemAsync).not.toHaveBeenCalled();
    await expect(docRefreshToken()).resolves.toBeNull();
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

  it('đăng xuất gọi đúng endpoint, gửi refresh token đã lưu và xoá nó', async () => {
    // `AuthController.logout()` dùng CÙNG `extractRefreshToken()` như `/refresh`:
    // header `X-Refresh-Token` trước, rồi body, rồi cookie. Không gửi token thì
    // backend không biết thu hồi phiên nào, và phiên đó sống tiếp tới khi hết hạn.
    let called = 0;
    let headerThayDuoc: string | null = null;
    await luuRefreshToken('rt-dang-dung');
    server.use(
      http.post(`${BASE}/api/auth/logout`, ({ request }) => {
        called += 1;
        headerThayDuoc = request.headers.get('X-Refresh-Token');
        return HttpResponse.json(envelope(null));
      }),
    );

    await authRepo.logout();

    expect(called).toBe(1);
    expect(headerThayDuoc).toBe('rt-dang-dung');
    expect(getAccessToken()).toBeNull();
    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('đăng xuất thất bại vẫn phải xoá access token VÀ refresh token đã lưu', async () => {
    // Nếu việc dọn dẹp chỉ nằm ở nhánh thành công, một lần logout lỗi mạng sẽ để
    // lại token còn sống: người dùng tưởng đã thoát nhưng mọi request sau đó vẫn
    // mang Authorization, và lần mở app sau còn tự đăng nhập lại được bằng refresh
    // token nằm trong keystore. Test này khoá nhánh `finally`.
    setAccessToken('at-con-song');
    await luuRefreshToken('rt-con-song');
    server.use(http.post(`${BASE}/api/auth/logout`, () => HttpResponse.error()));

    await expect(authRepo.logout()).rejects.toBeInstanceOf(ApiClientError);

    expect(getAccessToken()).toBeNull();
    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('keystore ném lúc xoá thì đăng xuất vẫn kết thúc bình thường, không reject', async () => {
    // Máy không có keystore khả dụng (hoặc khoá đã bị hệ thống vô hiệu hoá) làm
    // `deleteItemAsync` NÉM. Lỗi đó không được nổi lên thành một lần `signOut()`
    // thất bại: phiên đã bị thu hồi ở backend và access token đã bị xoá khỏi RAM,
    // nên về phía người dùng việc đăng xuất đã xong. `session.ts` phải nuốt nó.
    const kho = jest.requireMock('expo-secure-store');
    kho.deleteItemAsync.mockRejectedValueOnce(new Error('keystore unavailable'));
    server.use(http.post(`${BASE}/api/auth/logout`, () => HttpResponse.json(envelope(null))));

    await expect(authRepo.logout()).resolves.toBeUndefined();

    expect(getAccessToken()).toBeNull();
  });
});
