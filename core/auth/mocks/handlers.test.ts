/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của `/api/auth/*` bằng cách cho CODE THẬT đọc
 * chúng — `authRepo`, `refreshSession`, `session.ts` và `resolveAuthRoute`, không
 * assert vào fixture. Đây là cách duy nhất bắt được lỗi "mock bịa hình dạng DTO":
 * một mock trả `{accessToken}` thiếu `tokenType`/`refreshToken` vẫn khớp mọi
 * assertion viết tay, nhưng lệch kiểu `TokenResponse` thật — và riêng việc thiếu
 * `refreshToken` sẽ làm chế độ mock mất phiên sau mỗi lần tắt app.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests, getAccessToken, refreshSession } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { authRepo } from '@/core/auth/authRepo';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { MOCK_USER, __resetMockAuthForTests, authMockHandlers } from '@/core/auth/mocks/handlers';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';

/**
 * Keystore giả giữ trong RAM, thay `expo-secure-store`. Mock ở đúng biên native
 * để `session.ts` thật nằm trong đường chạy: chế độ mock trên thiết bị cũng ghi
 * vào keystore thật, nên luồng "lưu rồi đọc lại" phải được kiểm ở đây chứ không
 * được giả định.
 */
jest.mock('expo-secure-store', () =>
  require('@/core/auth/__testing__/khoBaoMatGiaLap').taoKhoBaoMatGiaLap(),
);

const server = setupServer(...authMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(async () => {
  __resetMockAuthForTests();
  __resetApiClientForTests();
  await xoaRefreshToken();
});
afterAll(() => server.close());

describe('handler mock của xác thực', () => {
  it('máy chưa có phiên: refresh thất bại bằng 401 để app dừng ở màn hình đăng nhập', async () => {
    // Keystore rỗng. Lỗi phải là `ApiClientError` status 401 — đó là thứ
    // `toUserMessage()` quy về action LOGIN; một `Error` thường sẽ thành "thử lại
    // sau ít phút", lời khuyên vô nghĩa với một phiên không tồn tại.
    // (Việc KHÔNG tốn round trip mạng nào trong tình huống này được `client.test.ts`
    // khoá bằng một bộ đếm request riêng.)
    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
  });

  it('đổi credential lấy phiên trả ĐỦ accessToken, refreshToken lẫn tokenType', async () => {
    // `TokenResponse` của client mobile có ba field. Thiếu `tokenType` hay
    // `refreshToken` là đúng lớp lỗi "mock bịa hình dạng hẹp hơn kiểu thật".
    const token = await authRepo.loginWithGoogle({ credential: 'id-token-gia' });

    expect(token.accessToken.length).toBeGreaterThan(0);
    expect(token.tokenType).toBe('Bearer');
    expect(token.refreshToken).toEqual(expect.any(String));
    // `authRepo.loginWithGoogle` nạp token vào client — chứng tỏ các request sau
    // của app sẽ mang Authorization.
    expect(getAccessToken()).toBe(token.accessToken);
    // ...và ghi refresh token xuống keystore, thứ cho phép phiên sống qua lần
    // tắt app. Đọc lại bằng `docRefreshToken()` thật thay vì tin vào fixture.
    await expect(docRefreshToken()).resolves.toBe(token.refreshToken);
  });

  it('mở lại app sau khi tiến trình đã chết: refresh VÀ /me đều đi qua được', async () => {
    await authRepo.loginWithGoogle({ credential: 'id-token-gia' });

    // Mô phỏng đúng một lần kill app rồi mở lại: biến module `daDangNhap` của
    // handler mock trở về `false` (tiến trình mới), còn keystore thì KHÔNG mất gì
    // — đó chính là lý do tầng phiên tồn tại. Handler `/refresh` phải nhận ra
    // phiên qua chính refresh token được xuất trình, chứ không qua trạng thái
    // trong RAM; nếu không thì refresh được mà `/me` lại 401, và app kẹt ở một
    // trạng thái bản thật không hề có.
    __resetMockAuthForTests();
    __resetApiClientForTests();

    await expect(refreshSession()).resolves.toEqual(expect.any(String));
    await expect(authRepo.getMe()).resolves.toMatchObject({ publicId: MOCK_USER.publicId });
  });

  it('refresh token không phải của phiên giả thì mock trả 401, không cho đi tiếp', async () => {
    // Handler mock phải SO KHỚP giá trị trong header `X-Refresh-Token`, không được
    // chấp nhận bất cứ gì. Nếu nó cho qua mọi thứ thì chế độ mock sẽ che đúng lớp
    // lỗi cần thấy nhất: app gửi token sai, gửi token rỗng, hoặc quên hẳn header.
    await luuRefreshToken('rt-khong-phai-cua-mock');

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiClientError);
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
  });

  it('người dùng giả đi qua được `resolveAuthRoute` để vào các tab', async () => {
    // Đây là mục tiêu của cả task: bấm đăng nhập là vào thẳng các tab. Dùng
    // đúng hàm điều hướng thật thay vì tự đọc `roles` — một MOCK_USER chỉ có
    // vai trò ADMIN sẽ rơi vào màn hình "không hỗ trợ" mà không test nào biết.
    await authRepo.loginWithGoogle({ credential: 'id-token-gia' });
    const me = await authRepo.getMe();

    expect(me.publicId).toBe(MOCK_USER.publicId);
    expect(resolveAuthRoute('authenticated', me)).toEqual({ kind: 'tabs' });
  });

  it('đăng xuất xoá phiên giả: keystore sạch và refresh sau đó thất bại', async () => {
    await authRepo.loginWithGoogle({ credential: 'id-token-gia' });
    await authRepo.logout();

    await expect(docRefreshToken()).resolves.toBeNull();
    await expect(refreshSession()).rejects.toThrow();
  });
});
