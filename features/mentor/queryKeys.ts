/**
 * @file queryKeys.ts
 * @description Khoá query nhánh mentor, gom một chỗ để invalidate không bị lệch.
 */

import type { MentorSearchFilters } from '@/features/mentor/mentorRepo';

export const mentorKeys = {
  all: ['mentor'] as const,
  recommendations: (limit?: number) => [...mentorKeys.all, 'recommendations', limit] as const,
  /** Tiền tố chung của MỌI danh sách tìm kiếm — xem `forumKeys.postsAll` */
  searchAll: () => [...mentorKeys.all, 'search'] as const,
  search: (filters: MentorSearchFilters) => [...mentorKeys.searchAll(), filters] as const,
  detail: (mentorUserId: string) => [...mentorKeys.all, 'detail', mentorUserId] as const,
  reviews: (mentorUserId: string) => [...mentorKeys.all, 'reviews', mentorUserId] as const,
};
