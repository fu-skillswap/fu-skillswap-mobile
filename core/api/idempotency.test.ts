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

  it('hai giá trị Date khác nhau trong cùng một trường thì sinh key khác nhau', () => {
    const store = createIdempotencyStore();

    expect(
      store.keyFor('booking:create:b1', { at: new Date('2026-01-01T00:00:00.000Z') })
    ).toBe('uuid-1');
    expect(
      store.keyFor('booking:create:b1', { at: new Date('2026-01-02T00:00:00.000Z') })
    ).toBe('uuid-2');
  });

  it('cùng một giá trị Date (kể cả tạo lại bằng instance khác) thì giữ nguyên key', () => {
    const store = createIdempotencyStore();

    expect(
      store.keyFor('booking:create:b1', { at: new Date('2026-01-01T00:00:00.000Z') })
    ).toBe('uuid-1');
    expect(
      store.keyFor('booking:create:b1', { at: new Date('2026-01-01T00:00:00.000Z') })
    ).toBe('uuid-1');
  });

  it('payload chứa Map thì báo lỗi rõ ràng thay vì âm thầm gán key', () => {
    const store = createIdempotencyStore();

    expect(() =>
      store.keyFor('booking:create:b1', { data: new Map([[1, 2]]) })
    ).toThrow(/không thể tính dấu vân tay/i);
  });

  it('payload là class instance (không phải object thuần) thì báo lỗi rõ ràng', () => {
    const store = createIdempotencyStore();

    class Slot {
      id = 'a';
    }

    expect(() => store.keyFor('booking:create:b1', new Slot())).toThrow(
      /không thể tính dấu vân tay/i
    );
  });

  it('payload có tham chiếu vòng (circular) thì báo lỗi rõ ràng, không làm sập stack', () => {
    const store = createIdempotencyStore();

    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    expect(() => store.keyFor('booking:create:b1', circular)).toThrow(
      /tham chiếu vòng/i
    );
  });

  it('keyFor không truyền payload và keyFor với payload undefined dùng chung một dấu vân tay', () => {
    const store = createIdempotencyStore();

    expect(store.keyFor('checkin:c2')).toBe('uuid-1');
    expect(store.keyFor('checkin:c2', undefined)).toBe('uuid-1');
  });
});
