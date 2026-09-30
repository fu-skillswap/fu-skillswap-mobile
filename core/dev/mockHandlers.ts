/**
 * @file mockHandlers.ts
 * @description Gom handler mock của mọi feature thành một mảng.
 *
 * Đây là nơi DUY NHẤT trong `core/` được import từ `features/`, và là ngoại lệ
 * duy nhất cho luật "`core/` không import từ `features/`": file này chỉ tồn tại
 * cho chế độ dev và không nằm trong đường chạy của bản phát hành (`mockServer.ts`
 * chỉ `require()` nó bên trong nhánh `isMockMode()`).
 *
 * Nếu về sau có test guard kiến trúc cho luật đó, **phải** loại trừ `core/dev/`
 * và ghi rõ lý do — không nới luật cho cả `core/`.
 */

import { authMockHandlers } from '@/core/auth/mocks/handlers';
import { forumMockHandlers } from '@/features/forum/mocks/handlers';
import { profileMockHandlers } from '@/features/profile/mocks/handlers';

export const mockHandlers = [
  ...authMockHandlers,
  ...forumMockHandlers,
  ...profileMockHandlers,
];
