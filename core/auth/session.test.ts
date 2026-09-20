import { Platform } from 'react-native';

import {
  REFRESH_COOKIE_NAME,
  clearSessionCookies,
  hasRefreshCookie,
  persistSessionCookies,
} from '@/core/auth/session';

const mockCookieManager = {
  flush: jest.fn().mockResolvedValue(undefined),
  clearAll: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue({}),
};

jest.mock('@react-native-cookies/cookies', () => ({
  __esModule: true,
  default: mockCookieManager,
}));

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
