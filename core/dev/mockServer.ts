/**
 * @file mockServer.ts
 * @description Bật MSW ngay trong app để xem giao diện khi backend chưa sẵn sàng.
 *
 * Ba điều bắt buộc về cách file này được viết:
 *
 * 1. `msw/native` được nạp bằng `require()` BÊN TRONG nhánh guard, không phải
 *    `import` ở đầu file. Metro không tree-shake tốt: một `import` ở tầng module
 *    kéo cả MSW vào bundle phát hành dù không ai gọi tới.
 * 2. Server chỉ được bật một lần. `app/_layout.tsx` render lại khi Fast Refresh
 *    hay đổi theme, và bật MSW hai lần để lại hai interceptor chồng nhau.
 * 3. `onUnhandledRequest: 'bypass'`. Endpoint nào chưa có handler thì cho đi
 *    thật; đặt `'error'` sẽ làm app chết ở mọi màn hình chưa mock, khiến chế độ
 *    mock vô dụng đúng lúc đang dựng dở dang.
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
  const { setupServer } = require('msw/native') as typeof import('msw/native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockHandlers } = require('@/core/dev/mockHandlers') as typeof import('@/core/dev/mockHandlers');

  setupServer(...mockHandlers).listen({ onUnhandledRequest: 'bypass' });
  console.log('[mock] MSW đã bật — mọi /api/* được trả lời bằng dữ liệu giả');
}

/** Đặt lại chốt — chỉ dùng trong test */
export function __resetMockServerForTests(): void {
  daBat = false;
}
