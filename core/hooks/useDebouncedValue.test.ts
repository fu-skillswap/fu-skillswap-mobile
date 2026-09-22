import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('trả giá trị ban đầu ngay lập tức', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));

    expect(result.current).toBe('a');
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
