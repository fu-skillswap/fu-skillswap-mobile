import { GoogleSignin } from '@react-native-google-signin/google-signin';

import {
  GoogleSignInCancelledError,
  configureGoogleSignIn,
  getGoogleIdToken,
} from '@/core/auth/googleSignIn';

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
 * Không dùng `jest.mocked(GoogleSignin)` ở đây: nó ràng type của `signIn` vào
 * `SignInResponse` thật của thư viện, trong khi bài test cố ý còn kiểm cả dạng
 * phản hồi CŨ (`{ idToken }` không có `type`/`data`) — dạng thư viện từng trả
 * trước khi có `SignInResponse`. Ép kiểu về một type mock lỏng để giữ nguyên
 * khả năng gọi `mockResolvedValue` với cả hai dạng phản hồi mới lẫn cũ.
 */
interface MockedGoogleSignin {
  configure: jest.Mock;
  hasPlayServices: jest.Mock;
  signIn: jest.Mock;
  signOut: jest.Mock;
}

const mockGoogleSignin = GoogleSignin as unknown as MockedGoogleSignin;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('googleSignIn', () => {
  it('cấu hình bằng web client id lấy từ môi trường', () => {
    configureGoogleSignIn();

    expect(mockGoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'test-web-client-id.apps.googleusercontent.com' }),
    );
  });

  it('kiểm tra Play Services rồi trả về id token (dạng phản hồi mới)', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'id-token-abc' },
    });

    await expect(getGoogleIdToken()).resolves.toBe('id-token-abc');
    expect(mockGoogleSignin.hasPlayServices).toHaveBeenCalled();
  });

  it('đọc được cả dạng phản hồi cũ trả thẳng idToken', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ idToken: 'id-token-cu' });

    await expect(getGoogleIdToken()).resolves.toBe('id-token-cu');
  });

  it('người dùng bấm huỷ → ném GoogleSignInCancelledError', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  });

  it('thư viện ném lỗi huỷ theo mã cũ → cũng quy về GoogleSignInCancelledError', async () => {
    mockGoogleSignin.signIn.mockRejectedValue({ code: '12501' });

    await expect(getGoogleIdToken()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
  });

  it('không có id token → báo lỗi rõ ràng', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'success', data: {} });

    await expect(getGoogleIdToken()).rejects.toThrow('Không lấy được Google ID token');
  });
});
