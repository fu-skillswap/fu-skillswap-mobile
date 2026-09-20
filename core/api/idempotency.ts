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
 * - Object: các khoá được sắp xếp lại theo thứ tự chữ cái trước khi tuần tự hoá,
 *   nên `{ a: 1, b: 2 }` và `{ b: 2, a: 1 }` cho cùng dấu vân tay.
 * - Array: giữ nguyên thứ tự phần tử, vì thứ tự trong mảng là dữ liệu có ý nghĩa
 *   (ví dụ thứ tự khung giờ được chọn), nên đổi thứ tự phần tử là đổi payload.
 * - Giá trị nguyên thuỷ (string, number, boolean, null) và undefined được tuần tự
 *   hoá trực tiếp; "không truyền payload" và "payload = undefined" dùng chung một
 *   dấu vân tay cố định để các thao tác không có body (ví dụ check-in) vẫn ổn định
 *   qua nhiều lần gọi.
 */
function fingerprint(payload: unknown): string {
  return JSON.stringify(normalize(payload));
}

/** Chuẩn hoá giá trị thành cấu trúc có thứ tự khoá cố định để JSON.stringify ổn định */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (isPlainObject(value)) {
    const sortedKeys = Object.keys(value).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = normalize(value[key]);
    }
    return result;
  }

  // Giá trị nguyên thuỷ, null, undefined, hoặc các đối tượng khác (Date, ...):
  // JSON.stringify tự xử lý ổn định, không cần chuẩn hoá thêm.
  return value;
}

/** Kiểm tra một giá trị có phải object thuần (không phải array, null, Date, ...) */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
