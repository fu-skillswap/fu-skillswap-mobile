/**
 * @file useMentorQueries.ts
 * @description Các hook đọc dữ liệu nhánh mentor.
 *
 * Phân trang ở đây là OFFSET (`page`/`size`), không phải cursor như diễn đàn —
 * nên dùng `getNextPageNumber`/`flattenOffsetPages`, KHÔNG dùng
 * `getNextCursor`/`flattenPages`. Hai bộ tồn tại song song có chủ ý.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { flattenOffsetPages, getNextPageNumber } from '@/core/api/pagination';
import { mentorRepo } from '@/features/mentor/mentorRepo';
import type { BoLocTimMentor } from '@/features/mentor/mentorRepo';
import { mentorKeys } from '@/features/mentor/queryKeys';

/**
 * Chốt chặn ĐỒNG BỘ cho việc tải trang kế, dùng chung cho mọi infinite query
 * của nhánh mentor.
 *
 * FlatList bắn `onEndReached` nhiều lần liên tiếp trong cùng một frame. Nếu chỉ
 * dựa vào `isFetchingNextPage`, cả hai lần gọi đều đọc cùng một giá trị `false`
 * của lần render cũ — React chưa kịp render lại — và cùng một số trang được gửi
 * đi hai lần: trang đó bị nối vào danh sách hai lượt và người dùng thấy bản ghi
 * trùng. Ref đổi ngay lập tức nên lần gọi thứ hai bị chặn.
 *
 * Chốt chặn nằm TRONG hook chứ không ở màn hình: diễn đàn đã sinh ra hai bản
 * `useRef` y hệt nhau (`ForumFeedScreen`, `PostDetailScreen`) vì để màn hình tự
 * dựng. Nhánh mentor có hai danh sách nữa, và mỗi bản sao là một chỗ để quên.
 */
function useChotChanTrangKe(query: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}) {
  const dangTaiTrangKe = useRef(false);

  return () => {
    if (dangTaiTrangKe.current || !query.hasNextPage || query.isFetchingNextPage) return;
    dangTaiTrangKe.current = true;
    void query.fetchNextPage().finally(() => {
      dangTaiTrangKe.current = false;
    });
  };
}

/**
 * Gợi ý mentor theo ngành học (cần đăng nhập).
 *
 * `limit` phải vào CẢ khoá query lẫn request: thiếu ở khoá thì `limit=3` và
 * `limit=10` dùng chung một ô cache và màn hình thứ hai nhận đúng số bản ghi của
 * màn hình thứ nhất; thiếu ở request thì backend trả về số mặc định.
 */
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
 *
 * `filters` không nhận `page` — xem JSDoc của `BoLocTimMentor`. Thứ tự spread
 * trong `queryFn` cũng cố ý đặt `page: pageParam` SAU `...filters`.
 *
 * Trả thêm `taiTrangKe()` đã bọc chốt chặn chống bấm trùng — màn hình nối thẳng
 * vào `onEndReached` của FlatList, KHÔNG tự dựng `useRef` lần nữa.
 */
export function useMentorSearch(filters: BoLocTimMentor, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: mentorKeys.search(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => mentorRepo.searchMentors({ ...filters, page: pageParam }),
    getNextPageParam: getNextPageNumber,
    enabled,
  });

  const mentors = useMemo(() => flattenOffsetPages(query.data?.pages), [query.data]);
  const taiTrangKe = useChotChanTrangKe(query);

  return { ...query, mentors, taiTrangKe };
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

/**
 * Đánh giá của một mentor.
 *
 * Khoá phải là `mentorKeys.reviews(id)` chứ KHÔNG phải `detail(id)`: màn hồ sơ
 * chạy hook này cùng lúc với `useMentor(id)`, trùng khoá là hai truy vấn khác
 * hình dạng cùng ghi vào một ô cache.
 *
 * Trả thêm `taiTrangKe()` đã bọc chốt chặn — lý do ở `useChotChanTrangKe`.
 */
export function useMentorReviews(mentorUserId: string) {
  const query = useInfiniteQuery({
    queryKey: mentorKeys.reviews(mentorUserId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => mentorRepo.getMentorReviews(mentorUserId, { page: pageParam }),
    getNextPageParam: getNextPageNumber,
    enabled: mentorUserId.length > 0,
  });

  const reviews = useMemo(() => flattenOffsetPages(query.data?.pages), [query.data]);
  const taiTrangKe = useChotChanTrangKe(query);

  return { ...query, reviews, taiTrangKe };
}
