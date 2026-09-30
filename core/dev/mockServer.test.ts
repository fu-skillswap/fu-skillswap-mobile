import { resetEnvCache } from '@/core/config/env';

/**
 * Hai điều được kiểm ở đây, cả hai đều là ràng buộc thật chứ không phải chi tiết
 * cài đặt:
 *
 * 1. Bản phát hành KHÔNG nạp MSW. Nếu `msw/native` bị `import` ở tầng module thì
 *    Metro đưa cả MSW vào bundle phát hành dù không ai gọi tới — và quan trọng
 *    hơn, một bản build lên Google Play sẽ mang theo lớp chặn HTTP.
 * 2. Bật hai lần chỉ có tác dụng một lần. `app/_layout.tsx` render lại khi Fast
 *    Refresh, và hai `setupServer().listen()` chồng nhau để lại hai interceptor.
 */
/**
 * `__DEV__` được khai báo là `const` trong typings của React Native nên không
 * gán trực tiếp được — phải đi qua `globalThis`. Cùng khuôn với
 * `core/config/env.test.ts`.
 */
function datDev(value: boolean): void {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}

describe('startMockServerIfEnabled', () => {
  const devGoc = __DEV__;
  const coGoc = process.env.EXPO_PUBLIC_MOCK_MODE;
  /** Chính app in dòng này ra Metro để người dùng biết chế độ mock đang chạy */
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    datDev(devGoc);
    process.env.EXPO_PUBLIC_MOCK_MODE = coGoc;
    resetEnvCache();
    jest.resetModules();
  });

  it('BẢN PHÁT HÀNH thì không nạp msw/native, dù cờ mock bật', () => {
    datDev(false);
    process.env.EXPO_PUBLIC_MOCK_MODE = '1';
    resetEnvCache();

    const daNap = jest.fn();
    jest.doMock('msw/native', () => {
      daNap();
      return { setupServer: () => ({ listen: jest.fn() }) };
    });

    const { startMockServerIfEnabled } = jest.requireActual<
      typeof import('@/core/dev/mockServer')
    >('@/core/dev/mockServer');

    expect(() => startMockServerIfEnabled()).not.toThrow();
    expect(daNap).not.toHaveBeenCalled();
  });

  it('cờ mock TẮT trong bản dev thì cũng không nạp msw/native', () => {
    datDev(true);
    process.env.EXPO_PUBLIC_MOCK_MODE = '';
    resetEnvCache();

    const daNap = jest.fn();
    jest.doMock('msw/native', () => {
      daNap();
      return { setupServer: () => ({ listen: jest.fn() }) };
    });

    const { startMockServerIfEnabled } = jest.requireActual<
      typeof import('@/core/dev/mockServer')
    >('@/core/dev/mockServer');

    startMockServerIfEnabled();

    expect(daNap).not.toHaveBeenCalled();
  });

  it('bản dev và cờ bật thì bật server đúng MỘT lần, dù gọi hai lần', () => {
    datDev(true);
    process.env.EXPO_PUBLIC_MOCK_MODE = '1';
    resetEnvCache();

    const listen = jest.fn();
    jest.doMock('msw/native', () => ({ setupServer: () => ({ listen }) }));

    const { startMockServerIfEnabled } = jest.requireActual<
      typeof import('@/core/dev/mockServer')
    >('@/core/dev/mockServer');

    startMockServerIfEnabled();
    startMockServerIfEnabled();

    expect(listen).toHaveBeenCalledTimes(1);
    // `bypass` chứ không phải 'error': endpoint chưa mock phải được cho đi thật,
    // nếu không app chết ở mọi màn hình đang dựng dở.
    expect(listen).toHaveBeenCalledWith({ onUnhandledRequest: 'bypass' });
    // Dòng log là cách duy nhất người dùng biết chế độ mock đang chạy khi xem
    // Metro — không phải log rác, nên nó được assert thay vì bị bỏ qua.
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[mock]'));
  });
});
