/**
 * @file idempotency.ts
 * @description Sinh và ghi nhớ Idempotency-Key cho các thao tác ghi của backend.
 * Quy tắc của backend: retry sau lỗi mạng phải dùng đúng key cũ với đúng payload cũ;
 * đổi payload (đổi slot, sửa mục tiêu học tập) thì phải sinh key mới.
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

/** Kho key theo thao tác, giúp retry giữ nguyên key cũ */
export interface IdempotencyStore {
  /** Lấy key của thao tác; lần đầu sinh mới, các lần sau trả lại key cũ */
  keyFor(operationId: string): string;
  /** Xoá key sau khi thao tác kết thúc (thành công hoặc bị người dùng huỷ) */
  release(operationId: string): void;
}

/** Tạo một kho key rỗng */
export function createIdempotencyStore(): IdempotencyStore {
  const keys = new Map<string, string>();

  return {
    keyFor(operationId: string): string {
      const existing = keys.get(operationId);
      if (existing) {
        return existing;
      }
      const key = newIdempotencyKey();
      keys.set(operationId, key);
      return key;
    },
    release(operationId: string): void {
      keys.delete(operationId);
    },
  };
}
