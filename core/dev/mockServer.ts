/**
 * @file mockServer.ts
 * @description Bật MSW ngay trong app để xem giao diện khi backend chưa sẵn sàng.
 *
 * Hai điều bắt buộc về cách file này được viết:
 *
 * 1. **Không import `msw/native` ở đây.** Nó chỉ được import trong
 *    `core/dev/mockHandlers.ts` — file duy nhất mà `metro.config.js` đổi hướng
 *    sang bản rỗng khi chế độ mock tắt. Thêm một điểm import thứ hai là thêm một
 *    chỗ phải nhớ đổi hướng, và chỗ bị quên sẽ lặng lẽ kéo MSW vào bundle phát
 *    hành. Xem `mockHandlers.empty.ts` để biết vì sao `require()` trong nhánh
 *    `if` KHÔNG đủ.
 * 2. **Server chỉ được bật một lần.** `app/_layout.tsx` render lại khi Fast
 *    Refresh hay đổi theme, và bật MSW hai lần để lại hai interceptor chồng nhau.
 */

import { isMockMode } from '@/core/config/env';

let daBat = false;

/** Bật MSW nếu chế độ mock đang bật; ngược lại không làm gì cả */
export function startMockServerIfEnabled(): void {
  if (!isMockMode() || daBat) {
    return;
  }
  daBat = true;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { batMsw } = require('@/core/dev/mockHandlers') as typeof import('@/core/dev/mockHandlers');
  batMsw();
  console.log('[mock] MSW đã bật — mọi /api/* được trả lời bằng dữ liệu giả');
}

/** Đặt lại chốt — chỉ dùng trong test */
export function __resetMockServerForTests(): void {
  daBat = false;
}
