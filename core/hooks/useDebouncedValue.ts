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
    // KHÔNG đặt hẹn giờ khi chẳng có gì để phát ra (`value` đã bằng giá trị đang
    // giữ) — đúng tình huống lúc mount, và lúc người dùng gõ rồi xoá về đúng giá
    // trị cũ. Bộ hẹn giờ đó chỉ gọi `setDebounced(giá trị y như cũ)`.
    //
    // Nó KHÔNG vô hại như trông thấy. React có đường tắt "eager state": trong
    // `dispatchSetState`, nếu state tính trước bằng state hiện tại thì nó thoát
    // sớm, không gọi `scheduleUpdateOnFiber`, nên không re-render và không có
    // cảnh báo act(). NHƯNG đường tắt đó có điều kiện — xem
    // `dispatchSetStateInternal` trong react-reconciler:
    //
    //     if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && ...)
    //
    // tức nó chỉ chạy khi fiber KHÔNG còn việc đang chờ. Màn hình dùng TanStack
    // Query gần như luôn có việc đang chờ (refetch nền, notifyManager, retry),
    // nên hẹn giờ vô nghĩa này vẫn đi tới `scheduleUpdateOnFiber`. Nếu nó nổ
    // ngoài phạm vi act() — ví dụ đúng lúc Jest chuyển từ thân test sang
    // afterEach gỡ cây — React in "An update to ... was not wrapped in act(...)".
    // Đã đo: nhường 400ms ngoài act ở cuối mỗi test của ForumFeedScreen làm 6/11
    // test in cảnh báo, tất cả đều là hẹn giờ lúc mount với giá trị y như cũ.
    // Dưới tải song song của `npm test` nó thành flake ~6%.
    if (Object.is(value, debounced)) return;

    const timer = setTimeout(() => setDebounced(value), delayMs);
    // Mỗi lần `value` đổi, bộ hẹn giờ cũ bị huỷ — nếu không, giá trị trung gian
    // vẫn được phát ra sau đó và toàn bộ việc hoãn trở thành vô nghĩa.
    return () => clearTimeout(timer);
    // `debounced` nằm trong deps để effect chạy lại SAU khi hẹn giờ phát giá
    // trị: lần đó `value === debounced` nên nhánh thoát sớm ở trên cắt mạch, không
    // có vòng lặp vô hạn.
  }, [value, delayMs, debounced]);

  return debounced;
}
