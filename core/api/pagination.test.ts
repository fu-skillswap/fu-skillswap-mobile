import {
  flattenOffsetPages,
  flattenPages,
  getNextCursor,
  getNextPageNumber,
} from '@/core/api/pagination';
import type { CursorPageResponse, PageResponse } from '@/core/api/pagination';

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

describe('getNextPageNumber', () => {
  function trang<T>(items: T[], overrides: Partial<PageResponse<T>> = {}): PageResponse<T> {
    return {
      content: items,
      page: 0,
      size: 12,
      totalElements: items.length,
      totalPages: 1,
      last: true,
      ...overrides,
    };
  }

  it('chưa phải trang cuối thì trả về số trang kế tiếp', () => {
    expect(getNextPageNumber(trang([1], { page: 0, totalPages: 3, last: false }))).toBe(1);
  });

  it('trang cuối thì trả undefined để TanStack dừng lại', () => {
    expect(getNextPageNumber(trang([1], { page: 2, totalPages: 3, last: true }))).toBeUndefined();
  });

  it('`last` là nguồn sự thật, KHÔNG phải so page với totalPages', () => {
    // Backend giới hạn deep pagination ở 20 trang đầu (mentor-discovery.md §2):
    // `totalPages` có thể lớn hơn số trang thật sự lấy được. Tự tính
    // `page + 1 < totalPages` sẽ xin trang thứ 21 và nhận lỗi.
    expect(getNextPageNumber(trang([1], { page: 5, totalPages: 999, last: true }))).toBeUndefined();
  });

  it('trang rỗng nhưng chưa phải cuối thì VẪN đi tiếp', () => {
    // Một trang rỗng ở giữa không có nghĩa là hết dữ liệu; chỉ `last` nói điều đó.
    expect(getNextPageNumber(trang([], { page: 1, totalPages: 5, last: false }))).toBe(2);
  });

  it('không nhầm số trang kế tiếp với một hằng số', () => {
    // Phép phá của riêng người thực hiện: `return page.last ? undefined : 1` vẫn
    // làm xanh ba test trên vì chúng chỉ đi từ trang 0 sang 1. Test này buộc
    // helper phải thật sự đọc `page` hiện tại.
    expect(getNextPageNumber(trang([1], { page: 7, totalPages: 999, last: false }))).toBe(8);
  });
});

describe('flattenOffsetPages', () => {
  it('gộp nhiều trang thành một mảng phẳng, giữ thứ tự', () => {
    const pages: PageResponse<number>[] = [
      { content: [1, 2], page: 0, size: 2, totalElements: 4, totalPages: 2, last: false },
      { content: [3, 4], page: 1, size: 2, totalElements: 4, totalPages: 2, last: true },
    ];

    expect(flattenOffsetPages(pages)).toEqual([1, 2, 3, 4]);
  });

  it('chưa có trang nào thì trả mảng rỗng, không phải undefined', () => {
    expect(flattenOffsetPages(undefined)).toEqual([]);
  });

  it('đọc `content` chứ không đọc `items` của bộ cursor', () => {
    // Phép phá của riêng người thực hiện: hai bộ phân trang sống cạnh nhau trong
    // cùng một file, rất dễ copy sang `page.items` — lúc đó mảng ra toàn undefined
    // chứ không rỗng, và test chỉ đếm độ dài sẽ không bắt được.
    const pages: PageResponse<string>[] = [
      { content: ['a'], page: 0, size: 1, totalElements: 1, totalPages: 1, last: true },
    ];

    expect(flattenOffsetPages(pages)).toEqual(['a']);
  });
});
