/**
 * @file idempotency.ts
 * @description Sinh và ghi nhớ Idempotency-Key cho các thao tác ghi của backend.
 * Quy tắc của backend: retry sau lỗi mạng phải dùng đúng key cũ với đúng payload cũ;
 * đổi payload (đổi slot, sửa mục tiêu học tập) thì phải sinh key mới, vì dùng lại key
 * cũ với payload khác sẽ bị backend trả 409 Conflict.
 */

import * as Crypto from 'expo-crypto';

/** Sinh một Idempotency-Key mới */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

/** Tạo header Idempotency-Key theo đúng tên backend yêu cầu */
export function idempotencyHeaders(key: string): { 'Idempotency-Key': string } {
  return { 'Idempotency-Key': key };
}

/**
 * Tính "dấu vân tay" ổn định của một payload bất kỳ, dùng để so sánh hai payload
 * có tương đương nhau hay không trước khi quyết định giữ hay sinh key mới.
 *
 * Nguyên tắc:
 * - Object thuần (plain object, prototype là `Object.prototype` hoặc `null`):
 *   các khoá được sắp xếp lại theo thứ tự chữ cái trước khi tuần tự hoá, nên
 *   `{ a: 1, b: 2 }` và `{ b: 2, a: 1 }` cho cùng dấu vân tay.
 * - Array: giữ nguyên thứ tự phần tử, vì thứ tự trong mảng là dữ liệu có ý nghĩa
 *   (ví dụ thứ tự khung giờ được chọn), nên đổi thứ tự phần tử là đổi payload.
 * - Date: quy về chuỗi ISO (`toISOString()`), vì hai Date khác thời điểm phải
 *   cho ra hai dấu vân tay khác nhau — giống như khi Date được serialize vào
 *   body request thật.
 * - Giá trị nguyên thuỷ (string, number, boolean, null) được tuần tự hoá trực
 *   tiếp qua `JSON.stringify`.
 * - "Không truyền payload" và "payload = undefined" dùng chung một dấu vân tay
 *   cố định (sentinel), để các thao tác không có body (ví dụ check-in) vẫn ổn
 *   định qua nhiều lần gọi mà không phụ thuộc hành vi `JSON.stringify(undefined)`
 *   (hàm này trả về giá trị `undefined`, không phải chuỗi — xem `fingerprint`).
 * - Map, Set, RegExp, class instance, function, ... (bất kỳ object không phải
 *   plain object/array/Date) không có cấu trúc khoá ổn định để tuần tự hoá —
 *   thay vì âm thầm gộp về `{}` (gây trùng dấu vân tay cho các payload khác
 *   nhau, dẫn tới backend trả 409 dù payload đã đổi thật), hàm sẽ ném lỗi rõ
 *   ràng ngay khi phát hiện.
 * - Payload có tham chiếu vòng (circular reference) cũng ném lỗi rõ ràng thay
 *   vì làm sập call stack.
 */
function fingerprint(payload: unknown): string {
  if (payload === undefined) {
    // Sentinel cố định cho "không có payload". JSON.stringify(undefined) trả
    // về giá trị undefined (không phải chuỗi "undefined"), nên nếu không xử lý
    // riêng, fingerprint() sẽ trả runtime undefined trong khi khai báo kiểu là
    // string — type nói dối. Chuỗi dưới đây không thể trùng với JSON.stringify
    // của bất kỳ payload thật nào vì nó không có dấu ngoặc/ngoặc kép hợp lệ.
    return '__no_payload__';
  }
  return JSON.stringify(normalize(payload, new WeakSet<object>()));
}

/**
 * Chuẩn hoá giá trị thành cấu trúc có thứ tự khoá cố định để JSON.stringify ổn định.
 * `seen` dùng để phát hiện tham chiếu vòng trong quá trình đệ quy xuống object/array.
 */
function normalize(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'function') {
    throw new Error(
      'Không thể tính dấu vân tay ổn định cho payload chứa function: function không tuần tự hoá được và không có ý nghĩa trong body request. Hãy loại bỏ giá trị này khỏi payload trước khi gọi keyFor.'
    );
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(
        'Payload có tham chiếu vòng (circular reference) trong một mảng: không thể tính dấu vân tay ổn định cho payload này.'
      );
    }
    seen.add(value);
    const result = value.map((item) => normalize(item, seen));
    seen.delete(value);
    return result;
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new Error(
        'Payload có tham chiếu vòng (circular reference) trong một object: không thể tính dấu vân tay ổn định cho payload này.'
      );
    }
    seen.add(value);
    const sortedKeys = Object.keys(value).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = normalize(value[key], seen);
    }
    seen.delete(value);
    return result;
  }

  if (typeof value === 'object' && value !== null) {
    // Map, Set, RegExp, class instance, ...: không phải plain object, array
    // hay Date, nên không có quy tắc chuẩn hoá ổn định. Object.keys() của các
    // giá trị này thường trả về [] (rỗng), nên nếu không chặn ở đây, chúng sẽ
    // âm thầm gộp về `{}` — hai payload khác nhau (ví dụ hai Map khác dữ liệu)
    // sẽ cho cùng một dấu vân tay, dẫn tới tái dùng key cũ và bị backend trả
    // 409 Conflict dù payload thực đã đổi. Thất bại ngay và rõ ràng còn hơn.
    const typeName = value.constructor?.name ?? 'không rõ';
    throw new Error(
      `Không thể tính dấu vân tay ổn định cho payload chứa đối tượng loại "${typeName}" (không phải object thuần, array hoặc Date). Hãy chuyển giá trị này sang dạng thuần (object/array/string/number/boolean/null) trước khi dùng làm payload cho keyFor.`
    );
  }

  if (typeof value === 'symbol' || typeof value === 'bigint') {
    // symbol và bigint không khớp nhánh object ở trên (typeof của chúng không
    // phải 'object') nên nếu không chặn riêng, chúng sẽ rơi thẳng xuống
    // `return value` cuối cùng. Với symbol, JSON.stringify(symbol) trả về
    // runtime undefined (fingerprint() sẽ trả undefined dù khai báo kiểu là
    // string — type nói dối), còn symbol lồng trong object thì bị
    // JSON.stringify âm thầm bỏ qua (gộp trùng dấu vân tay với object không
    // có trường đó — cùng kiểu collision đã chặn cho Map/Set ở trên). Với
    // bigint, JSON.stringify ném TypeError runtime mù mờ. Cả hai đều ném lỗi
    // rõ ràng ngay tại đây thay vì để rơi vào các hành vi ngầm đó.
    const typeName = typeof value;
    throw new Error(
      `Không thể tính dấu vân tay ổn định cho payload chứa giá trị kiểu "${typeName}" (không tuần tự hoá được bằng JSON.stringify). Hãy chuyển giá trị này sang dạng thuần (string/number/boolean/null) trước khi dùng làm payload cho keyFor.`
    );
  }

  // Giá trị nguyên thuỷ (string, number, boolean) hoặc null: JSON.stringify
  // tự xử lý ổn định, không cần chuẩn hoá thêm.
  return value;
}

/**
 * Kiểm tra một giá trị có phải object thuần (plain object) hay không: object
 * có prototype là `Object.prototype` (tạo bằng `{}` hoặc `new Object()`) hoặc
 * `null` (tạo bằng `Object.create(null)`). Loại trừ array (đã được xử lý riêng
 * trước khi gọi hàm này), Date, Map, Set, RegExp, class instance, và mọi
 * object khác có prototype riêng — dùng `typeof` đơn thuần sẽ không loại trừ
 * được các trường hợp này.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Một entry ghi nhớ trong kho: key hiện tại và dấu vân tay của payload đã sinh ra nó */
interface StoreEntry {
  fingerprint: string;
  key: string;
}

/** Kho key theo thao tác, giúp retry giữ nguyên key cũ và đổi payload thì sinh key mới */
export interface IdempotencyStore {
  /**
   * Key cho một thao tác. Payload giữ nguyên thì trả lại key cũ (retry an toàn);
   * payload đổi thì tự sinh key mới (tránh 409 của backend).
   *
   * Kho chỉ nhớ payload gần nhất của mỗi operationId. Nếu quay lại một payload
   * đã dùng trước đó (không phải payload gần nhất), hàm này sẽ sinh key mới —
   * đây là hành vi đúng và an toàn, vì một key mới đi với một payload chưa từng
   * dùng luôn được backend chấp nhận; không phải lỗi.
   */
  keyFor(operationId: string, payload?: unknown): string;
  /** Quên key của thao tác sau khi nó kết thúc hẳn. */
  release(operationId: string): void;
}

/** Tạo một kho key rỗng, độc lập với mọi kho khác (không dùng state cấp module) */
export function createIdempotencyStore(): IdempotencyStore {
  const entries = new Map<string, StoreEntry>();

  return {
    keyFor(operationId: string, payload?: unknown): string {
      const nextFingerprint = fingerprint(payload);
      const existing = entries.get(operationId);

      if (existing && existing.fingerprint === nextFingerprint) {
        return existing.key;
      }

      const key = newIdempotencyKey();
      entries.set(operationId, { fingerprint: nextFingerprint, key });
      return key;
    },
    release(operationId: string): void {
      entries.delete(operationId);
    },
  };
}
