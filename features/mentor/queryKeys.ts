/**
 * @file queryKeys.ts
 * @description Khoá query nhánh mentor, gom một chỗ để invalidate không bị lệch.
 */

import type { BoLocTimMentor } from '@/features/mentor/mentorRepo';

export const mentorKeys = {
  all: ['mentor'] as const,
  recommendations: (limit?: number) => [...mentorKeys.all, 'recommendations', limit] as const,
  /** Tiền tố chung của MỌI danh sách tìm kiếm — xem `forumKeys.postsAll` */
  searchAll: () => [...mentorKeys.all, 'search'] as const,
  /**
   * Khoá một danh sách tìm kiếm.
   *
   * KHÔNG nhận `page`: số trang do `useInfiniteQuery` quản qua `pageParam`, nên
   * một `page` trong bộ lọc chỉ làm nhiễu khoá. Xem `BoLocTimMentor` ở
   * `mentorRepo.ts`. `size` thì vẫn vào khoá — hai kích thước trang khác nhau là
   * hai danh sách khác nhau.
   */
  search: (filters: BoLocTimMentor) =>
    [...mentorKeys.searchAll(), filters] as const,
  detail: (mentorUserId: string) => [...mentorKeys.all, 'detail', mentorUserId] as const,
  reviews: (mentorUserId: string) => [...mentorKeys.all, 'reviews', mentorUserId] as const,
};
