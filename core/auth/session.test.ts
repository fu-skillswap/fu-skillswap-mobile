import * as SecureStore from 'expo-secure-store';

import {
  KHOA_REFRESH_TOKEN,
  docRefreshToken,
  luuRefreshToken,
  xoaRefreshToken,
} from '@/core/auth/session';

/**
 * Mock được dựng hoàn toàn bên trong factory của `jest.mock` (không tham chiếu
 * biến ngoài) vì factory bị Jest hoist lên trên mọi khai báo `const`/`import`
 * trong file.
 *
 * Hình dạng mock khớp export THẬT của `expo-secure-store@57.0.4` — đã mở
 * `node_modules/expo-secure-store/package.json` (`"main": "build/SecureStore.js"`)
 * và chính file đó để đọc: module CHỈ có named export (`getItemAsync`,
 * `setItemAsync`, `deleteItemAsync`, `getItem`, `setItem`, `isAvailableAsync`,
 * `canUseBiometricAuthentication`, các hằng `WHEN_UNLOCKED*`...) và **KHÔNG có
 * default export**. Nếu mock bịa thêm `default`, code viết
 * `import SecureStore from 'expo-secure-store'` sẽ chạy trong test mà vỡ trên
 * máy thật — đúng lớp lỗi "xác minh trên một thứ do chính mình dựng ra".
 */
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const khoThat = jest.mocked(SecureStore);

beforeEach(() => {
  jest.clearAllMocks();
  khoThat.getItemAsync.mockResolvedValue(null);
  khoThat.setItemAsync.mockResolvedValue(undefined);
  khoThat.deleteItemAsync.mockResolvedValue(undefined);
});

describe('khoá lưu refresh token', () => {
  it('khớp luật đặt tên khoá của expo-secure-store', () => {
    // `ensureValidKey()` trong node_modules/expo-secure-store/build/SecureStore.js
    // NÉM nếu khoá không khớp `/^[\w.-]+$/` (ví dụ có `:` hoặc khoảng trắng).
    // Lỗi đó chỉ nổ trên thiết bị thật, ở đúng lúc đang đăng nhập — regex dưới
    // đây được copy từ chính source của package để chặn nó từ tầng test.
    expect(KHOA_REFRESH_TOKEN).toMatch(/^[\w.-]+$/);
  });
});

describe('luuRefreshToken', () => {
  it('ghi token vào keystore đúng khoá và báo đã lưu được', async () => {
    await expect(luuRefreshToken('rt-abc')).resolves.toBe(true);

    expect(khoThat.setItemAsync).toHaveBeenCalledTimes(1);
    expect(khoThat.setItemAsync).toHaveBeenCalledWith(KHOA_REFRESH_TOKEN, 'rt-abc');
  });

  it('keystore ném thì báo KHÔNG lưu được nhưng không ném ra ngoài', async () => {
    // Máy không có keystore khả dụng thì SecureStore ném. Ném tiếp ra ngoài sẽ
    // làm một lần đăng nhập VỪA THÀNH CÔNG báo lỗi cho người dùng, dù access
    // token đã nằm trong RAM và app hoàn toàn dùng được tới khi tắt.
    khoThat.setItemAsync.mockRejectedValue(new Error('keystore unavailable'));

    await expect(luuRefreshToken('rt-abc')).resolves.toBe(false);
  });

  it('token rỗng thì không chạm vào keystore', async () => {
    // Chuỗi rỗng là giá trị HỢP LỆ với SecureStore (`isValidValue` chỉ kiểm
    // `typeof value === 'string'`), nên nếu không chặn ở đây nó sẽ được ghi
    // thật và tạo ra một phiên trông như đang tồn tại mà mọi lần refresh đều 401.
    await expect(luuRefreshToken('')).resolves.toBe(false);

    expect(khoThat.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('docRefreshToken', () => {
  it('trả đúng token đã lưu, đọc đúng khoá', async () => {
    khoThat.getItemAsync.mockResolvedValue('rt-da-luu');

    await expect(docRefreshToken()).resolves.toBe('rt-da-luu');
    expect(khoThat.getItemAsync).toHaveBeenCalledWith(KHOA_REFRESH_TOKEN);
  });

  it('chưa có khoá nào thì trả null', async () => {
    // Doc Expo v57: "getItemAsync resolves with `null` if there is no entry for
    // the given key or if the key has been invalidated."
    khoThat.getItemAsync.mockResolvedValue(null);

    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('native module trả undefined thì vẫn là null, không phải undefined', async () => {
    // Đã ĐO, không suy luận: dưới jest-expo, native module `ExpoSecureStore`
    // bị auto-mock nên `getItemAsync` resolve `undefined` chứ không phải `null`.
    // Nếu không chuẩn hoá ở đây, `undefined` sẽ chảy lên client.ts và lộ ra
    // dưới dạng header `X-Refresh-Token: undefined`.
    khoThat.getItemAsync.mockResolvedValue(undefined as unknown as string | null);

    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('token đã lưu là chuỗi rỗng thì coi như chưa có phiên', async () => {
    khoThat.getItemAsync.mockResolvedValue('');

    await expect(docRefreshToken()).resolves.toBeNull();
  });

  it('keystore ném thì coi như chưa có phiên, KHÔNG ném ra ngoài', async () => {
    // Đây là lời gọi nằm trên đường khởi động app (refreshAccessToken đọc token
    // đã lưu). Một phiên không đọc được chỉ được phép dẫn tới màn hình đăng
    // nhập, không được phép làm app chết lúc khởi động.
    khoThat.getItemAsync.mockRejectedValue(new Error('keystore unavailable'));

    await expect(docRefreshToken()).resolves.toBeNull();
  });
});

describe('xoaRefreshToken', () => {
  it('xoá đúng khoá trong keystore', async () => {
    await xoaRefreshToken();

    expect(khoThat.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(khoThat.deleteItemAsync).toHaveBeenCalledWith(KHOA_REFRESH_TOKEN);
  });

  it('keystore ném thì không ném ra ngoài', async () => {
    // `xoaRefreshToken()` chạy trong nhánh dọn dẹp của đăng xuất. Ném ở đây sẽ
    // làm `authRepo.logout()` reject dù phiên đã bị kết thúc xong xuôi.
    khoThat.deleteItemAsync.mockRejectedValue(new Error('keystore unavailable'));

    await expect(xoaRefreshToken()).resolves.toBeUndefined();
  });
});
