import { isExplicitlyOffline, setupOnlineManager } from '@/core/net/onlineStatus';

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  useNetworkState: jest.fn(() => ({})),
}));

jest.mock('@tanstack/react-query', () => ({
  onlineManager: { setOnline: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isExplicitlyOffline', () => {
  it('chưa biết trạng thái (mọi trường undefined) thì KHÔNG coi là mất mạng', () => {
    // expo-network trả về trạng thái rỗng trong khoảnh khắc đầu tiên sau khi mở
    // app. Coi đó là mất mạng sẽ làm banner nháy đỏ dù mạng vẫn tốt.
    expect(isExplicitlyOffline({})).toBe(false);
  });

  it('isConnected false thì là mất mạng', () => {
    expect(isExplicitlyOffline({ isConnected: false })).toBe(true);
  });

  it('có kết nối nhưng internet không tới được thì vẫn là mất mạng', () => {
    expect(isExplicitlyOffline({ isConnected: true, isInternetReachable: false })).toBe(true);
  });

  it('kết nối bình thường thì không phải mất mạng', () => {
    expect(isExplicitlyOffline({ isConnected: true, isInternetReachable: true })).toBe(false);
  });

  it('có kết nối, chưa biết internet có tới được không thì chưa kết luận mất mạng', () => {
    expect(isExplicitlyOffline({ isConnected: true })).toBe(false);
  });
});

describe('setupOnlineManager', () => {
  // Đây là đoạn keo nối mạng vào TanStack Query, và cũng là chỗ dễ giấu hai lỗi
  // nặng nhất mà không test nào khác nhìn thấy: đảo cực (app treo trắng vì query
  // bị tạm dừng trong khi máy vẫn có mạng) và rò listener khi màn hình remount.
  it('mất mạng thì báo offline, có mạng lại thì báo online (không đảo cực)', () => {
    const { addNetworkStateListener } = jest.requireMock('expo-network');
    const { onlineManager } = jest.requireMock('@tanstack/react-query');

    setupOnlineManager();
    const listener = addNetworkStateListener.mock.calls[0]?.[0] as (s: unknown) => void;

    listener({ isConnected: false });
    expect(onlineManager.setOnline).toHaveBeenLastCalledWith(false);

    listener({ isConnected: true, isInternetReachable: true });
    expect(onlineManager.setOnline).toHaveBeenLastCalledWith(true);
  });

  it('chưa biết trạng thái thì vẫn coi là online, không tạm dừng query oan', () => {
    const { addNetworkStateListener } = jest.requireMock('expo-network');
    const { onlineManager } = jest.requireMock('@tanstack/react-query');

    setupOnlineManager();
    const listener = addNetworkStateListener.mock.calls[0]?.[0] as (s: unknown) => void;

    listener({});

    expect(onlineManager.setOnline).toHaveBeenLastCalledWith(true);
  });

  it('hàm trả về gỡ đúng listener đã đăng ký', () => {
    const { addNetworkStateListener } = jest.requireMock('expo-network');
    const remove = jest.fn();
    addNetworkStateListener.mockReturnValueOnce({ remove });

    const unsubscribe = setupOnlineManager();
    expect(remove).not.toHaveBeenCalled();

    unsubscribe();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
