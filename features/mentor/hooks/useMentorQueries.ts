/**
 * @file useMentorQueries.ts
 * @description Các hook đọc dữ liệu nhánh mentor.
 *
 * Phân trang ở đây là OFFSET (`page`/`size`), không phải cursor như diễn đàn —
 * nên dùng `getNextPageNumber`/`flattenOffsetPages`, KHÔNG dùng
 * `getNextCursor`/`flattenPages`. Hai bộ tồn tại song song có chủ ý.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { flattenOffsetPages, getNextPageNumber } from '@/core/api/pagination';
import { mentorRepo } from '@/features/mentor/mentorRepo';
import type { MentorSearchFilters } from '@/features/mentor/mentorRepo';
import { mentorKeys } from '@/features/mentor/queryKeys';

/** Gợi ý mentor theo ngành học (cần đăng nhập) */
export function useMentorRecommendations(limit?: number) {
  return useQuery({
    queryKey: mentorKeys.recommendations(limit),
    queryFn: () => mentorRepo.getRecommendations(limit),
    // Gợi ý được backend tính lại không thường xuyên; không cần tải lại liên tục.
    staleTime: 5 * 60_000,
  });
}

/**
 * Tìm và lọc mentor, cuộn tới đâu tải tới đó.
 *
 * `enabled` là tham số TƯỜNG MINH chứ không suy ra từ `filters`: màn hình là nơi
 * biết người dùng đang xem gợi ý hay đang tìm kiếm, và `useMentorSearch({})` là
 * một truy vấn hợp lệ (xem toàn bộ mentor) nên hook không thể tự đoán.
 */
export function useMentorSearch(filters: MentorSearchFilters, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: mentorKeys.search(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => mentorRepo.searchMentors({ ...filters, page: pageParam }),
    getNextPageParam: getNextPageNumber,
    enabled,
  });

  const mentors = useMemo(() => flattenOffsetPages(query.data?.pages), [query.data]);

  return { ...query, mentors };
}

/** Hồ sơ mentor đầy đủ */
export function useMentor(mentorUserId: string) {
  return useQuery({
    queryKey: mentorKeys.detail(mentorUserId),
    queryFn: () => mentorRepo.getMentor(mentorUserId),
    // Route có thể render một nhịp trước khi có tham số; thiếu chốt này thì một
    // `GET /api/mentors/` (đường dẫn cụt) rời máy.
    enabled: mentorUserId.length > 0,
  });
}

/** Đánh giá của một mentor */
export function useMentorReviews(mentorUserId: string) {
  const query = useInfiniteQuery({
    queryKey: mentorKeys.reviews(mentorUserId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => mentorRepo.getMentorReviews(mentorUserId, { page: pageParam }),
    getNextPageParam: getNextPageNumber,
    enabled: mentorUserId.length > 0,
  });

  const reviews = useMemo(() => flattenOffsetPages(query.data?.pages), [query.data]);

  return { ...query, reviews };
}
