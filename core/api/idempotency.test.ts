import { createIdempotencyStore, idempotencyHeaders, newIdempotencyKey } from '@/core/api/idempotency';

let counter = 0;

jest.mock('expo-crypto', () => ({
  randomUUID: () => `uuid-${(counter += 1)}`,
}));

beforeEach(() => {
  counter = 0;
});

describe('idempotency', () => {
  it('sinh key mới mỗi lần gọi', () => {
    expect(newIdempotencyKey()).toBe('uuid-1');
    expect(newIdempotencyKey()).toBe('uuid-2');
  });

  it('tạo đúng tên header backend yêu cầu', () => {
    expect(idempotencyHeaders('abc')).toEqual({ 'Idempotency-Key': 'abc' });
  });

  it('giữ nguyên key cho cùng một thao tác để retry an toàn', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:accept:b1')).toBe('uuid-1');
    expect(store.keyFor('booking:accept:b1')).toBe('uuid-1');
  });

  it('mỗi thao tác khác nhau có key riêng', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:accept:b1')).toBe('uuid-1');
    expect(store.keyFor('booking:accept:b2')).toBe('uuid-2');
  });

  it('release xong thì lần sau sinh key mới', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create')).toBe('uuid-1');
    store.release('booking:create');
    expect(store.keyFor('booking:create')).toBe('uuid-2');
  });
});
