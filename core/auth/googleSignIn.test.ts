import { GoogleSignin } from '@react-native-google-signin/google-signin';

import {
  GoogleSignInCancelledError,
  GoogleSignInConfigError,
  MOCK_ID_TOKEN,
  __resetGoogleSignInConfiguredForTests,
  configureGoogleSignIn,
  getGoogleIdToken,
  signOutGoogle,
} from '@/core/auth/googleSignIn';
import { resetEnvCache } from '@/core/config/env';

/**
 * Mock được tạo hoàn toàn bên trong factory của `jest.mock` (không tham chiếu
 * biến ngoài) vì factory bị Jest hoist lên trên mọi khai báo `const`/`import`
 * trong file — nếu để đối tượng mock ở ngoài rồi tham chiếu vào trong factory,
 * factory sẽ chạy trước khi biến đó được gán và chỉ nhận `undefined`.
 */
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  statusCodes: { SIGN_IN_CANCELLED: '12501' },
}));

/**
 * `jest.mocked` giữ nguyên chữ ký thật của thư viện, nên mọi lỗi gõ sai tên
 * trường hay sai kiểu tham số trong test vẫn bị `tsc` bắt.
 */
const mockGoogleSignin = jest.mocked(GoogleSignin);

/**
 * Riêng `signIn` phải nới lỏng kiểu trả về: `SignInResponse` của thư viện là một
 * union đóng (`{ type: 'success' | 'cancelled' }`), trong khi bài test cố ý còn
 * kiểm cả dạng phản hồi CŨ (`{ idToken }` không có `type`/`data`). Chỉ ép kiểu
 * đúng một method này, không ép cả đối tượng — `configure`, `hasPlayServices`
 * và `signOut` giữ nguyên kiểm tra kiểu.
 */
const mockSignIn = mockGoogleSignin.signIn as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Trạng thái "đã cấu hình" (Fix 2) được memo hoá ở module-scope, sống sót
  // qua nhiều `it` trong cùng file test — phải đặt lại mỗi lần để mỗi test
  // thấy đúng hành vi "lần gọi đầu tiên" của mình.
  __resetGoogleSignInConfiguredForTests();
});

describe('googleSignIn', () => {
  it('cấu hình bằng web client id lấy từ môi trường', () => {
    configureGoogleSignIn();

    expect(mockGoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'test-web-client-id.apps.googleusercontent.com' }),
    );
  });

  it('getGoogleIdToken tự cấu hình trước nếu chưa cấu hình (Fix 2: không còn cấu hình nhiệt tình lúc khởi động)', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-abc' } });

    await getGoogleIdToken();

    expect(mockGoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'test-web-client-id.apps.googleusercontent.com' }),
    );
  });

  it('gọi getGoogleIdToken nhiều lần chỉ cấu hình đúng một lần (memo hoá)', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-abc' } });

    await getGoogleIdToken();
    await getGoogleIdToken();

    expect(mockGoogleSignin.configure).toHaveBeenCalledTimes(1);
  });

  it('signOutGoogle cũng tự cấu hình trước nếu chưa cấu hình', async () => {
    await signOutGoogle();

    expect(mockGoogleSignin.configure).toHaveBeenCalledTimes(1);
    expect(mockGoogleSignin.signOut).toHaveBeenCalledTimes(1);
  });

  it('kiểm tra Play Services rồi trả về id token (dạng phản hồi mới)', async () => {
    mockSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'id-token-abc' },
    });

    await expect(getGoogleIdToken()).resolves.toBe('id-token-abc');
    expect(mockGoogleSignin.hasPlayServices).toHaveBeenCalled();
  });

  it('đọc được cả dạng phản hồi cũ trả thẳng idToken', async () => {
    // Typings của v16.1.5 không còn sinh ra dạng này (`SignInResponse` là union
    // đóng gồm 'success' và 'cancelled'), nên đây là lớp phòng thủ cho runtime
    // cũ chứ không phải nhánh có thật ở bản đang cài.
    mockSignIn.mockResolvedValue({ idToken: 'id-token-cu' });

    await expect(getGoogleIdToken()).resolves.toBe('id-token-cu');
  });

  it('người dùng bấm huỷ → ném GoogleSignInCancelledError', async () => {
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  });

  it('thư viện ném lỗi huỷ theo mã cũ → cũng quy về GoogleSignInCancelledError', async () => {
    mockSignIn.mockRejectedValue({ code: '12501' });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  });

  it('không có id token → báo lỗi rõ ràng', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: {} });

    await expect(getGoogleIdToken()).rejects.toThrow('Không lấy được Google ID token');
  });

  it('DEVELOPER_ERROR (mã 10) → ném GoogleSignInConfigError, KHÔNG phải lỗi chung', async () => {
    // Gặp thật trên máy ảo 2026-10-03: Android OAuth client chưa đăng ký cặp
    // package + SHA-1 trong cùng project với `webClientId`. Trước khi tách lớp
    // lỗi này ra, nó rơi vào nhánh "lỗi không rõ" và app mời người dùng "thử
    // lại sau ít phút" — một lời khuyên không bao giờ đúng, vì chờ bao lâu
    // cũng không hết.
    mockSignIn.mockRejectedValue({
      code: '10',
      message: 'DEVELOPER_ERROR: Follow troubleshooting instructions at ...',
    });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInConfigError);
  });

  it('DEVELOPER_ERROR dạng SỐ 10 cũng nhận ra', async () => {
    // Thư viện trả `code` khi là chuỗi khi là số tuỳ đường ném, nên so sánh
    // phải chuẩn hoá về chuỗi.
    mockSignIn.mockRejectedValue({ code: 10 });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInConfigError);
  });

  it('lỗi native khác KHÔNG bị nhận nhầm thành lỗi cấu hình', async () => {
    mockSignIn.mockRejectedValue({ code: '7', message: 'NETWORK_ERROR' });

    await expect(getGoogleIdToken()).rejects.not.toBeInstanceOf(GoogleSignInConfigError);
  });
});

/** `__DEV__` là `const` trong typings RN, phải gán qua `globalThis` */
function datDev(value: boolean): void {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}

describe('getGoogleIdToken trong chế độ mock', () => {
  const devGoc = __DEV__;
  const coGoc = process.env.EXPO_PUBLIC_MOCK_MODE;

  afterEach(() => {
    datDev(devGoc);
    process.env.EXPO_PUBLIC_MOCK_MODE = coGoc;
    resetEnvCache();
  });

  it('mock mode bật thì trả token giả và KHÔNG gọi thư viện native', async () => {
    // Máy chưa có Android OAuth client nên lời gọi native chắc chắn ném lỗi.
    // Đây là lý do seam này tồn tại.
    datDev(true);
    process.env.EXPO_PUBLIC_MOCK_MODE = '1';
    resetEnvCache();

    const token = await getGoogleIdToken();

    expect(token).toBe(MOCK_ID_TOKEN);
    expect(mockSignIn).not.toHaveBeenCalled();
    // Cũng không được cấu hình thư viện: `configureGoogleSignIn()` đọc
    // EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID và ném nếu thiếu, mà chế độ mock tồn tại
    // đúng để chạy được khi chưa có biến đó.
    expect(mockGoogleSignin.configure).not.toHaveBeenCalled();
  });

  it('mock mode TẮT thì vẫn đi qua thư viện native như cũ', async () => {
    datDev(true);
    process.env.EXPO_PUBLIC_MOCK_MODE = '';
    resetEnvCache();
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'token-that' } });

    await expect(getGoogleIdToken()).resolves.toBe('token-that');

    expect(mockSignIn).toHaveBeenCalled();
  });

  it('BẢN PHÁT HÀNH thì đi đường native kể cả khi cờ mock bật', async () => {
    // Vế `__DEV__` của `isMockMode()` phải chặn được ở đây, nếu không bản lên
    // Google Play sẽ tự nhận một token giả và coi như đã đăng nhập.
    datDev(false);
    process.env.EXPO_PUBLIC_MOCK_MODE = '1';
    resetEnvCache();
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'token-that' } });

    await expect(getGoogleIdToken()).resolves.toBe('token-that');

    expect(mockSignIn).toHaveBeenCalled();
  });
});
