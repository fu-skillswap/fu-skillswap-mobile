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
