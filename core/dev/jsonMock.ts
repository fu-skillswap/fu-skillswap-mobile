/**
 * @file jsonMock.ts
 * @description Dựng phản hồi JSON cho handler MSW, thay cho `HttpResponse.json()`.
 *
 * ## Vì sao không dùng `HttpResponse.json()`
 *
 * Bộ chặn XHR của MSW đọc thân phản hồi **chỉ qua một đường duy nhất**
 * (`@mswjs/interceptors/lib/browser/XMLHttpRequest-*.mjs:487`):
 *
 * ```js
 * if (response.body) {
 *   const reader = response.body.getReader();
 *   ...
 * }
 * ```
 *
 * `Response` của React Native (bản whatwg-fetch) **không có thuộc tính `body`**.
 * Điều kiện là `false`, khối đọc bị bỏ qua, và `responseText` ở lại rỗng. Không
 * có lỗi nào được ném: status và header về đúng, chỉ dữ liệu là biến mất.
 *
 * Triệu chứng thật trên máy ảo Android 2026-10-03: đăng nhập chế độ mock "thành
 * công", `status` chuyển `authenticated`, nhưng `user` là `""` thay vì đối tượng
 * người dùng, nên `resolveAuthRoute` không đọc được vai trò và màn hình login
 * đứng yên — không điều hướng, không báo lỗi.
 *
 * Đổi sang `new Response(JSON.stringify(...))` **KHÔNG đủ**, dù nhiều hướng dẫn
 * trên mạng nói vậy: vấn đề không nằm ở cách dựng thân mà ở chỗ MSW đòi
 * `response.body` phải là một `ReadableStream`. Phải cấp đúng thứ đó.
 *
 * ## Vì sao để ở `core/dev/` chứ không vá `HttpResponse` trong `mswPolyfills.ts`
 *
 * Vá global sẽ chỉ có tác dụng trên thiết bị — Jest import handler trực tiếp,
 * không đi qua `mockHandlers.ts` nên không nạp polyfill. Khi đó test và máy thật
 * dựng phản hồi bằng hai đường khác nhau, đúng lớp lỗi "xác minh trên một thứ
 * không phải thứ đang chạy" mà repo này đã dính nhiều lần. Helper tường minh thì
 * cả hai môi trường chạy chung một dòng code.
 */

import { ReadableStream as ReadableStreamPolyfill } from 'web-streams-polyfill';

/**
 * `ReadableStream` của môi trường nếu có, nếu không thì bản polyfill.
 *
 * Node (Jest) có sẵn từ v18; Hermes không có. Ưu tiên bản của môi trường để
 * test chạy trên đúng thứ Node thật dùng.
 */
const ReadableStreamDung =
  (globalThis as unknown as { ReadableStream?: typeof ReadableStreamPolyfill }).ReadableStream ??
  ReadableStreamPolyfill;

/** Một stream phát đúng một mảnh rồi đóng */
function streamTuChuoi(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStreamDung({
    start(controller: { enqueue: (c: Uint8Array) => void; close: () => void }) {
      controller.enqueue(bytes);
      controller.close();
    },
  }) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Phản hồi JSON cho handler MSW. Thay thế trực tiếp cho `HttpResponse.json()`.
 *
 * Gắn `body` bằng `defineProperty` thay vì truyền vào constructor: `Response`
 * của React Native không nhận `ReadableStream` làm thân, và `body` của nó là
 * thuộc tính chỉ-đọc trên prototype. Ghi đè trên chính instance là cách duy
 * nhất để `response.body` có giá trị mà không phải tự dựng lại cả lớp.
 */
export function jsonMock(body: unknown, init?: { status?: number }): Response {
  const text = JSON.stringify(body);
  const response = new Response(text, {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
  Object.defineProperty(response, 'body', {
    value: streamTuChuoi(text),
    configurable: true,
    writable: true,
  });
  return response;
}
