import CookieManager from '@preeternal/react-native-cookie-manager';
import { Platform } from 'react-native';

import {
  REFRESH_COOKIE_NAME,
  clearSessionCookies,
  hasRefreshCookie,
  persistSessionCookies,
} from '@/core/auth/session';

/**
 * Mock được tạo hoàn toàn bên trong factory của `jest.mock` (không tham chiếu
 * biến ngoài) vì factory bị Jest hoist lên trên mọi khai báo `const`/`import`
 * trong file — nếu để đối tượng mock ở ngoài rồi tham chiếu vào trong factory,
 * factory sẽ chạy trước khi biến đó được gán và chỉ nhận `undefined`.
 *
 * Hình dạng trả về `{ __esModule: true, default: {...} }` khớp với cách
 * `@preeternal/react-native-cookie-manager` export thật: package export
 * `export default CookieManager` (ESM), nên khi Metro/Babel biên dịch sang
 * CommonJS ở runtime, module sẽ có đúng hai khoá này.
 */
jest.mock('@preeternal/react-native-cookie-manager', () => ({
  __esModule: true,
  default: {
    flush: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue({}),
  },
}));

const mockCookieManager = jest.mocked(CookieManager);

/** Platform.OS là thuộc tính chỉ đọc theo typings của RN, phải ghi đè qua defineProperty */
function setPlatform(os: 'android' | 'ios'): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCookieManager.get.mockResolvedValue({});
  setPlatform('android');
});

describe('session', () => {
  it('trên Android thì ghi cookie xuống đĩa', async () => {
    setPlatform('android');

    await persistSessionCookies();

    expect(mockCookieManager.flush).toHaveBeenCalledTimes(1);
  });

  it('trên iOS thì không gọi flush', async () => {
    setPlatform('ios');

    await persistSessionCookies();

    expect(mockCookieManager.flush).not.toHaveBeenCalled();
  });

  it('xoá toàn bộ cookie khi đăng xuất', async () => {
    await clearSessionCookies();

    expect(mockCookieManager.clearAll).toHaveBeenCalledTimes(1);
  });

  it('nhận ra refresh cookie đang tồn tại', async () => {
    mockCookieManager.get.mockResolvedValue({
      [REFRESH_COOKIE_NAME]: { name: REFRESH_COOKIE_NAME, value: 'abc' },
    });

    await expect(hasRefreshCookie()).resolves.toBe(true);
    expect(mockCookieManager.get).toHaveBeenCalledWith('https://api.skillswap.asia/api/auth');
  });

  it('báo không có refresh cookie khi cookie store rỗng', async () => {
    await expect(hasRefreshCookie()).resolves.toBe(false);
  });

  it('cookie store lỗi thì coi như chưa có phiên, không ném ra ngoài', async () => {
    mockCookieManager.get.mockRejectedValue(new Error('cookie store unavailable'));

    await expect(hasRefreshCookie()).resolves.toBe(false);
  });
});
