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

  it('giữ nguyên key cho cùng một thao tác và cùng payload để retry an toàn', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create:b1', { slotId: 'a', goal: 'X' })).toBe('uuid-1');
    expect(store.keyFor('booking:create:b1', { slotId: 'a', goal: 'X' })).toBe('uuid-1');
  });

  it('payload đổi thì sinh key mới để tránh backend trả 409', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create:b1', { slotId: 'a', goal: 'X' })).toBe('uuid-1');
    expect(store.keyFor('booking:create:b1', { slotId: 'a', goal: 'Y' })).toBe('uuid-2');
  });

  it('payload chỉ khác thứ tự khoá thì vẫn coi là giống nhau', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create:b1', { slotId: 'a', goal: 'X' })).toBe('uuid-1');
    expect(store.keyFor('booking:create:b1', { goal: 'X', slotId: 'a' })).toBe('uuid-1');
  });

  it('object lồng nhau đổi thứ tự khoá vẫn coi là giống nhau', () => {
    const store = createIdempotencyStore();

    expect(
      store.keyFor('booking:create:b1', { slot: { id: 'a', date: '2026-01-01' }, goal: 'X' })
    ).toBe('uuid-1');
    expect(
      store.keyFor('booking:create:b1', { goal: 'X', slot: { date: '2026-01-01', id: 'a' } })
    ).toBe('uuid-1');
  });

  it('thứ tự phần tử trong mảng đổi thì coi là payload khác nhau', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create:b1', { tags: ['a', 'b'] })).toBe('uuid-1');
    expect(store.keyFor('booking:create:b1', { tags: ['b', 'a'] })).toBe('uuid-2');
  });

  it('gọi keyFor không có payload thì ổn định qua nhiều lần gọi', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('checkin:c1')).toBe('uuid-1');
    expect(store.keyFor('checkin:c1')).toBe('uuid-1');
  });

  it('mỗi thao tác khác nhau có key riêng', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:accept:b1')).toBe('uuid-1');
    expect(store.keyFor('booking:accept:b2')).toBe('uuid-2');
  });

  it('release xong thì lần sau sinh key mới', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('booking:create', { goal: 'X' })).toBe('uuid-1');
    store.release('booking:create');
    expect(store.keyFor('booking:create', { goal: 'X' })).toBe('uuid-2');
  });

  it('hai store tạo độc lập không dùng chung state', () => {
    const storeA = createIdempotencyStore();
    const storeB = createIdempotencyStore();

    expect(storeA.keyFor('booking:create:b1', { goal: 'X' })).toBe('uuid-1');
    expect(storeB.keyFor('booking:create:b1', { goal: 'X' })).toBe('uuid-2');
    expect(storeA.keyFor('booking:create:b1', { goal: 'X' })).toBe('uuid-1');
    expect(storeB.keyFor('booking:create:b1', { goal: 'X' })).toBe('uuid-2');
  });
});
