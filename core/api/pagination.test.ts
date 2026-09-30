import { flattenPages, getNextCursor } from '@/core/api/pagination';
import type { CursorPageResponse } from '@/core/api/pagination';

function page<T>(items: T[], overrides: Partial<CursorPageResponse<T>> = {}): CursorPageResponse<T> {
  return {
    items,
    nextCursor: null,
    prevCursor: null,
    hasNext: false,
    hasPrev: false,
    limit: 20,
    ...overrides,
  };
}

describe('getNextCursor', () => {
  it('trả về cursor khi backend báo còn trang sau', () => {
    expect(getNextCursor(page([1], { hasNext: true, nextCursor: 'abc' }))).toBe('abc');
  });

  it('trả về undefined khi hasNext là false, dù nextCursor còn giá trị', () => {
    // TanStack Query dừng phân trang khi getNextPageParam trả undefined.
    // hasNext là nguồn sự thật; tin vào nextCursor còn sót sẽ gọi thừa một trang rỗng.
    expect(getNextCursor(page([1], { hasNext: false, nextCursor: 'abc' }))).toBeUndefined();
  });

  it('trả về undefined khi hết cursor', () => {
    expect(getNextCursor(page([1], { hasNext: true, nextCursor: null }))).toBeUndefined();
  });
});

describe('flattenPages', () => {
  it('nối các trang theo đúng thứ tự', () => {
    expect(flattenPages([page([1, 2]), page([3])])).toEqual([1, 2, 3]);
  });

  it('chưa có trang nào thì trả mảng rỗng, không phải undefined', () => {
    // Màn hình render danh sách ngay lần đầu, trước khi có dữ liệu.
    expect(flattenPages(undefined)).toEqual([]);
  });
});
