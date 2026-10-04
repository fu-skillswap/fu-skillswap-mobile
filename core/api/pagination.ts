/**
 * @file pagination.ts
 * @description Kiểu phân trang cursor của backend và hai helper dùng chung.
 *
 * `cursor` là token opaque do backend mã hoá: không decode, không parse, không
 * tự sinh — chỉ chuyền nguyên văn giá trị `nextCursor` nhận được vào lần gọi sau.
 */

/** Một trang dữ liệu theo cursor, dùng cho bài viết, newsfeed và bình luận */
export interface CursorPageResponse<T> {
  items: T[];
  /** Token trang kế tiếp; null nghĩa là hết dữ liệu */
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  /** Số item mỗi trang (mặc định 20, tối đa 50) */
  limit: number;
}

/**
 * Lấy cursor cho `getNextPageParam` của TanStack Query.
 * Trả `undefined` để báo hết trang — `hasNext` là nguồn sự thật, không phải
 * sự tồn tại của `nextCursor`.
 */
export function getNextCursor<T>(page: CursorPageResponse<T>): string | undefined {
  return page.hasNext && page.nextCursor ? page.nextCursor : undefined;
}

/** Gộp các trang của một infinite query thành một mảng phẳng để render */
export function flattenPages<T>(pages: CursorPageResponse<T>[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.items);
}

/**
 * Một trang dữ liệu theo OFFSET, dùng cho nhánh mentor.
 *
 * Khác hẳn `CursorPageResponse` ở trên: nhánh mentor của backend phân trang bằng
 * `page`/`size` chứ không bằng token cursor (`mentor-discovery.md` §2). Hai bộ
 * kiểu tồn tại song song có chủ ý — đừng cố gộp chúng lại.
 */
export interface PageResponse<T> {
  content: T[];
  /** Số trang hiện tại, bắt đầu từ 0 */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  /** Đã là trang cuối hay chưa — NGUỒN SỰ THẬT để quyết định còn trang nữa không */
  last: boolean;
}

/**
 * Lấy số trang kế tiếp cho `getNextPageParam` của TanStack Query.
 *
 * Dựa vào `last`, KHÔNG tự tính `page + 1 < totalPages`: backend giới hạn deep
 * pagination ở 20 trang đầu, nên `totalPages` có thể lớn hơn số trang thật sự lấy
 * được và phép tự tính sẽ xin một trang không tồn tại.
 */
export function getNextPageNumber<T>(page: PageResponse<T>): number | undefined {
  return page.last ? undefined : page.page + 1;
}

/** Gộp các trang offset của một infinite query thành một mảng phẳng để render */
export function flattenOffsetPages<T>(pages: PageResponse<T>[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.content);
}
