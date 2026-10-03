/**
 * @file mswPolyfills.ts
 * @description Các global của web mà MSW cần nhưng Hermes KHÔNG có.
 *
 * Phải import file này TRƯỚC `msw/native`, ở ngay dòng đầu của
 * `core/dev/mockHandlers.ts`. MSW chạm tới các global này ngay lúc module được
 * đánh giá, nên polyfill đặt trong `useEffect` hay trong hàm là quá muộn.
 *
 * VÌ SAO 427 TEST XANH MÀ THIẾT BỊ VẪN CHẾT: Jest chạy trên Node, nơi `URL`,
 * `TextEncoder`, `Event`, `EventTarget`, `MessageEvent` và `BroadcastChannel`
 * đều có sẵn. Hermes không có. Lỗi thật gặp trên máy ảo 2026-10-03 là
 * `Uncaught Error: Property 'MessageEvent' doesn't exist` ném từ
 * `mockHandlers.ts:17`, làm app chết trắng ngay khi mở ở chế độ mock.
 *
 * File này chỉ nằm trong bundle khi chế độ mock BẬT: nó được import từ
 * `mockHandlers.ts`, và `metro.config.js` đổi hướng file đó sang
 * `mockHandlers.empty.ts` khi `EXPO_PUBLIC_MOCK_MODE !== '1'`.
 */

import 'react-native-url-polyfill/auto';
import 'fast-text-encoding';

/**
 * Gán qua một `Record<string, unknown>` thay vì kiểu có cấu trúc.
 *
 * `globalThis` đã được khai kiểu DOM đầy đủ, nên gán một lớp tối giản vào
 * `globalThis.Event` sẽ bị `tsc` từ chối vì thiếu `NONE`/`CAPTURING_PHASE`/...
 * Đây là polyfill cho một runtime KHÔNG có các lớp đó, nên việc nó không khớp
 * toàn bộ bề mặt DOM là đúng — ta chỉ cung cấp phần MSW thực sự chạm tới.
 */
const g = globalThis as unknown as Record<string, unknown>;

/**
 * `EventTarget` tối giản.
 *
 * Hermes mới có sẵn `Event`/`EventTarget` ở một số bản, nên mọi thứ dưới đây
 * đều kiểm `typeof === 'undefined'` trước: ghi đè bản có sẵn của runtime là
 * cách nhanh nhất để hỏng những thứ đang chạy tốt.
 */
if (typeof g.EventTarget === 'undefined') {
  class EventTargetToiGian {
    private cacBoNghe = new Map<string, Set<(su: unknown) => void>>();

    addEventListener(loai: string, boNghe: (su: unknown) => void): void {
      const tap = this.cacBoNghe.get(loai) ?? new Set();
      tap.add(boNghe);
      this.cacBoNghe.set(loai, tap);
    }

    removeEventListener(loai: string, boNghe: (su: unknown) => void): void {
      this.cacBoNghe.get(loai)?.delete(boNghe);
    }

    dispatchEvent(suKien: { type: string }): boolean {
      // Lặp trên BẢN SAO: một bộ nghe tự gỡ mình ra trong lúc chạy là chuyện
      // bình thường, và sửa Set đang được lặp sẽ bỏ sót bộ nghe kế tiếp.
      for (const boNghe of [...(this.cacBoNghe.get(suKien.type) ?? [])]) {
        boNghe(suKien);
      }
      return true;
    }
  }
  g.EventTarget = EventTargetToiGian;
}

if (typeof g.Event === 'undefined') {
  class EventToiGian {
    readonly type: string;
    constructor(type: string) {
      this.type = type;
    }
  }
  g.Event = EventToiGian;
}

/** Chính là global đã làm app chết: MSW tham chiếu nó lúc nạp module */
if (typeof g.MessageEvent === 'undefined') {
  class MessageEventToiGian {
    readonly type: string;
    readonly data: unknown;
    constructor(type: string, khoiTao?: { data?: unknown }) {
      this.type = type;
      this.data = khoiTao?.data;
    }
  }
  g.MessageEvent = MessageEventToiGian;
}

/**
 * `XMLHttpRequestUpload` rỗng — cố ý không bao giờ có instance nào.
 *
 * Bộ chặn XHR của MSW dùng nó ở ĐÚNG MỘT chỗ, và chỉ để phân loại:
 *
 *     const events = target instanceof XMLHttpRequestUpload
 *       ? this.uploadEvents : this.events;
 *
 * (`@mswjs/interceptors/lib/browser/XMLHttpRequest-*.mjs`). React Native không
 * có lớp này, nên chỉ cần một lớp để phép `instanceof` chạy được mà không ném
 * `ReferenceError`. Nó luôn trả `false`, và đó là kết quả ĐÚNG: ta không theo
 * dõi tiến độ tải lên, nên mọi sự kiện đi vào `this.events` là chính xác.
 *
 * Lỗi thật trước khi có nó, ngay khi axios gửi request đầu tiên:
 * `ReferenceError: Property 'XMLHttpRequestUpload' doesn't exist`.
 *
 * `ProgressEvent` thì KHÔNG cần polyfill: MSW tự mang bản của nó và đã có guard
 * `typeof ProgressEvent !== "undefined"`, kèm chú thích "`ProgressEvent` is not
 * supported in React Native".
 */
if (typeof g.XMLHttpRequestUpload === 'undefined') {
  class XMLHttpRequestUploadToiGian {}
  g.XMLHttpRequestUpload = XMLHttpRequestUploadToiGian;
}

/**
 * `getAllResponseHeaders()` của React Native trả `null`, MSW lại gọi thẳng
 * `.split()` lên nó.
 *
 * Đây KHÔNG phải thiếu global mà là khác biệt hành vi giữa hai bản cài XHR:
 *
 * - RN (`Libraries/Network/XMLHttpRequest.js:462`): `if (!this.responseHeaders)
 *   return null;` — kèm chú thích "according to the spec, return null if no
 *   response has been received".
 * - MSW (`XMLHttpRequest-*.mjs:205`): `headersString.split(/[\r\n]+/)` không
 *   kiểm null.
 *
 * Trình duyệt thực tế trả chuỗi rỗng trong tình huống này, nên MSW chưa bao giờ
 * phải phòng. Lỗi thật: `TypeError: Cannot read property 'split' of null`, ném
 * ra sau khi handler đã trả lời xong — tức request mock chạy đúng, chỉ khâu
 * dựng lại Response là vỡ.
 *
 * Shim trả `''` thay cho `null`. Chỉ bọc đúng trường hợp null, mọi giá trị khác
 * đi qua nguyên vẹn.
 */
{
  const xhr = g.XMLHttpRequest as { prototype: Record<string, unknown> } | undefined;
  const proto = xhr?.prototype;
  if (proto && typeof proto.getAllResponseHeaders === 'function') {
    const goc = proto.getAllResponseHeaders as (this: unknown) => string | null;
    proto.getAllResponseHeaders = function getAllResponseHeaders(this: unknown): string {
      return goc.call(this) ?? '';
    };
  }
}

/**
 * `BroadcastChannel` giả, KHÔNG truyền tin đi đâu cả.
 *
 * MSW dùng nó để đồng bộ giữa nhiều tab trình duyệt — khái niệm không tồn tại
 * trong một app di động chỉ có một tiến trình JS. Một bản no-op là đủ, và cố
 * dựng cơ chế truyền tin thật ở đây là làm thừa cho một thứ không ai dùng.
 */
if (typeof g.BroadcastChannel === 'undefined') {
  class BroadcastChannelToiGian {
    readonly name: string;
    onmessage: ((su: unknown) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(): void {}
    close(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return true;
    }
  }
  g.BroadcastChannel = BroadcastChannelToiGian;
}
