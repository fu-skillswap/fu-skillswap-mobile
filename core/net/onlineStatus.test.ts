import { isExplicitlyOffline } from '@/core/net/onlineStatus';

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
