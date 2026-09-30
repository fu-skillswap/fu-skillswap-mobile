/**
 * @file mockHandlers.empty.ts
 * @description Bản rỗng thay cho `mockHandlers.ts` trong mọi bản build KHÔNG bật
 * chế độ mock. Không import gì cả — đó chính là điểm của nó.
 *
 * `metro.config.js` đổi hướng `core/dev/mockHandlers` sang file này khi
 * `EXPO_PUBLIC_MOCK_MODE !== '1'`, nhờ vậy MSW và toàn bộ fixture không đi vào
 * graph của Metro.
 *
 * Vì sao phải làm tới mức này: đặt `require('msw/native')` bên trong một nhánh
 * `if` **không** giữ được MSW khỏi bundle. `require()` chỉ hoãn việc THỰC THI;
 * Metro phân tích tĩnh và vẫn đưa module vào graph bất kể nhánh nào chạy.
 *
 * Đã đo trên bundle thật (`npx expo export --platform android`), không phải suy
 * luận: 4.1MB → 5.0MB, tức **+1.0MB (+26%)** chỉ vì phần mock; và `grep` trên
 * file `.hbc` tìm thấy cả `setupServer`, `onUnhandledRequest` lẫn fixture
 * `HE180001`, `mock-nonce-0001`.
 *
 * Lưu ý: chế độ mock vẫn KHÔNG thể kích hoạt trong bản phát hành dù có MSW trong
 * bundle, vì `isMockMode()` đòi `__DEV__`. File này giải quyết chuyện kích thước
 * bundle và bề mặt tấn công, không phải một lỗ bảo mật đang mở.
 */

export const mockHandlers: never[] = [];

/** Không làm gì — bản build này không có MSW */
export function batMsw(): void {
  // Cố ý rỗng.
}
