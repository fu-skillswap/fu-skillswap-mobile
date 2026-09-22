/**
 * @file useDebouncedValue.ts
 * @description Hoãn việc lan truyền một giá trị cho tới khi nó ngừng đổi.
 *
 * Dùng cho ô tìm kiếm: nếu đưa thẳng từng ký tự vào query key của TanStack
 * Query thì mỗi phím gõ là một query key mới, tức một request HTTP và một entry
 * cache sống hết `gcTime`. Gõ "spring" sinh 6 request và 6 entry cache.
 */

import { useEffect, useState } from 'react';

/** Trả về `value` sau khi nó đã đứng yên `delayMs` mili giây */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Mỗi lần `value` đổi, bộ hẹn giờ cũ bị huỷ — nếu không, giá trị trung gian
    // vẫn được phát ra sau đó và toàn bộ việc hoãn trở thành vô nghĩa.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
