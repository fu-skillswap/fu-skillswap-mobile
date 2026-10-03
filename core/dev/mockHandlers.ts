/**
 * @file mockHandlers.ts
 * @description Gom handler mock của mọi feature và bật MSW.
 *
 * Đây là **điểm đổi hướng duy nhất** của chế độ mock: `metro.config.js` thay file
 * này bằng `mockHandlers.empty.ts` khi `EXPO_PUBLIC_MOCK_MODE !== '1'`, nên toàn
 * bộ MSW lẫn fixture không đi vào graph của Metro. Vì vậy `msw/native` chỉ được
 * import ở ĐÂY, không ở `mockServer.ts` — hai điểm import là hai chỗ phải nhớ
 * đổi hướng, và chỗ bị quên sẽ lặng lẽ kéo MSW vào bundle phát hành.
 *
 * Cũng là nơi DUY NHẤT trong `core/` được import từ `features/`, và là ngoại lệ
 * duy nhất cho luật "`core/` không import từ `features/`": file này chỉ tồn tại
 * cho chế độ dev. Nếu về sau có test guard kiến trúc cho luật đó, **phải** loại
 * trừ `core/dev/` và ghi rõ lý do — không nới luật cho cả `core/`.
 */

// PHẢI đứng trước `msw/native`: MSW chạm tới `MessageEvent` và các global web
// khác ngay lúc module được đánh giá, mà Hermes không có chúng. Xem
// `core/dev/mswPolyfills.ts` — thiếu dòng này thì app chết trắng khi mở ở chế
// độ mock, dù toàn bộ test Jest vẫn xanh (Jest chạy trên Node, có sẵn hết).
import '@/core/dev/mswPolyfills';

import { setupServer } from 'msw/native';

import { authMockHandlers } from '@/core/auth/mocks/handlers';
import { forumMockHandlers } from '@/features/forum/mocks/handlers';
import { profileMockHandlers } from '@/features/profile/mocks/handlers';

export const mockHandlers = [
  ...authMockHandlers,
  ...forumMockHandlers,
  ...profileMockHandlers,
];

/**
 * Bật MSW với toàn bộ handler mock.
 *
 * `onUnhandledRequest: 'bypass'` — endpoint nào chưa có handler thì cho đi thật.
 * Đặt `'error'` sẽ làm app chết ở mọi màn hình chưa mock, khiến chế độ mock vô
 * dụng đúng lúc đang dựng dở dang.
 */
export function batMsw(): void {
  setupServer(...mockHandlers).listen({ onUnhandledRequest: 'bypass' });
}
