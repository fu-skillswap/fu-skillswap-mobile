import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { setupFocusManager } from '@/core/net/appFocus';

describe('setupFocusManager', () => {
  let phat: ((status: AppStateStatus) => void) | undefined;
  const go = jest.fn();

  beforeEach(() => {
    phat = undefined;
    go.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      phat = handler as (status: AppStateStatus) => void;
      return { remove: go };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    focusManager.setFocused(undefined);
  });

  it('app xuống nền thì TanStack coi là mất focus, quay lại thì có focus', () => {
    const huy = setupFocusManager();

    phat!('background');
    expect(focusManager.isFocused()).toBe(false);

    phat!('active');
    expect(focusManager.isFocused()).toBe(true);

    huy();
  });

  it('quay lại app thì query đã cũ tự tải lại', async () => {
    const huy = setupFocusManager();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // `mount()` là thứ `QueryClientProvider` làm: đăng ký nghe `focusManager`.
    queryClient.mount();
    const queryFn = jest.fn().mockResolvedValue('ok');
    const observer = new QueryObserver(queryClient, { queryKey: ['x'], queryFn, staleTime: 0 });
    const boNghe = observer.subscribe(() => {});

    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(queryFn).toHaveBeenCalledTimes(1);

      phat!('background');
      phat!('active');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(queryFn).toHaveBeenCalledTimes(2);
    } finally {
      boNghe();
      queryClient.clear();
      queryClient.unmount();
      huy();
    }
  });

  it('huỷ đăng ký thì gỡ listener của AppState', () => {
    const huy = setupFocusManager();
    huy();
    expect(go).toHaveBeenCalledTimes(1);
  });
});
