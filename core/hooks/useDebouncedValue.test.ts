import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('trả giá trị ban đầu ngay lập tức', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));

    expect(result.current).toBe('a');
  });

  /**
   * Đếm RIÊNG các hẹn giờ của hook, nhận ra qua `delayMs`.
   *
   * Không dùng `jest.getTimerCount()`: nó đếm mọi hẹn giờ đang treo của cả tiến
   * trình (React, RNTL, scheduler) — đo thật là 9 cái ngay lúc mount — nên con số
   * đó không nói được gì về hook này.
   */
  function demHenGio(delayMs: number) {
    const spy = jest.spyOn(globalThis, 'setTimeout');
    return {
      soLan: () => spy.mock.calls.filter((call) => call[1] === delayMs).length,
      thoi: () => spy.mockRestore(),
    };
  }

  it('KHÔNG đặt hẹn giờ khi giá trị chưa đổi so với giá trị đang giữ', async () => {
    // Hẹn giờ đó chỉ gọi `setDebounced(giá trị y như cũ)`. Trông như vô hại vì
    // React có đường tắt "eager state", nhưng đường tắt ấy chỉ chạy khi fiber
    // không còn việc đang chờ (`fiber.lanes === 0`) — màn hình dùng TanStack Query
    // gần như luôn còn việc đang chờ. Hệ quả thật: cú setState vô nghĩa đó rơi ra
    // ngoài act() ở biên giữa thân test và afterEach gỡ cây, và `npm test` in
    // "An update to ForumFeedScreen inside a test was not wrapped in act(...)"
    // vài phần trăm số lần chạy.
    const dem = demHenGio(300);
    try {
      const { rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
        initialProps: { v: 'a' },
      });

      // lúc mount: value === debounced
      expect(dem.soLan()).toBe(0);

      // render lại với CÙNG giá trị cũng không được sinh hẹn giờ nào
      await rerender({ v: 'a' });
      expect(dem.soLan()).toBe(0);

      // đổi thật thì mới có đúng MỘT hẹn giờ
      await rerender({ v: 'ab' });
      expect(dem.soLan()).toBe(1);

      // và sau khi phát xong, effect chạy lại KHÔNG đặt thêm hẹn giờ nào nữa
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(dem.soLan()).toBe(1);
    } finally {
      dem.thoi();
    }
  });

  it('gõ rồi xoá về đúng giá trị cũ thì không đặt thêm hẹn giờ vô nghĩa', async () => {
    const dem = demHenGio(300);
    try {
      const { result, rerender } = await renderHook(
        ({ v }: { v: string }) => useDebouncedValue(v, 300),
        { initialProps: { v: 'a' } },
      );

      await rerender({ v: 'ab' });
      expect(dem.soLan()).toBe(1);

      // quay về 'a' — bằng đúng giá trị đang giữ, nên không còn gì để phát
      await rerender({ v: 'a' });
      expect(dem.soLan()).toBe(1);

      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(result.current).toBe('a');
    } finally {
      dem.thoi();
    }
  });

  it('chưa hết thời gian chờ thì vẫn giữ giá trị cũ', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });

    await rerender({ v: 'ab' });
    await act(async () => {
      jest.advanceTimersByTime(299);
    });

    expect(result.current).toBe('a');
  });

  it('hết thời gian chờ thì phát ra giá trị mới', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'a' },
    });

    await rerender({ v: 'ab' });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('ab');
  });

  it('gõ liên tục chỉ phát ra giá trị CUỐI, không phát giá trị trung gian', async () => {
    // Đây là lý do hook này tồn tại. Nếu thiếu `clearTimeout` trong cleanup, mỗi
    // ký tự sẽ tự đặt hẹn giờ riêng và lần lượt phát ra 's', 'sp', 'spr'... —
    // mỗi giá trị là một query key mới, tức một request HTTP thừa.
    const seen: string[] = [];
    const { rerender } = await renderHook(
      ({ v }: { v: string }) => {
        seen.push(useDebouncedValue(v, 300));
      },
      { initialProps: { v: '' } },
    );

    for (const v of ['s', 'sp', 'spr', 'spri', 'sprin', 'spring']) {
      await rerender({ v });
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
    }
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(Array.from(new Set(seen))).toEqual(['', 'spring']);
  });
});
