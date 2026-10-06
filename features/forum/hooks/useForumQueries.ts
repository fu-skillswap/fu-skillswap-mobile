/**
 * @file useForumQueries.ts
 * @description Các hook đọc dữ liệu diễn đàn.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { flattenPages, getNextCursor } from '@/core/api/pagination';
import { forumRepo } from '@/features/forum/forumRepo';
import { forumKeys } from '@/features/forum/queryKeys';
import type { ForumListFilters } from '@/features/forum/types';

/**
 * Chốt chặn ĐỒNG BỘ cho việc tải trang kế — cùng lý do và cùng cách làm như
 * `useChotChanTrangKe` của `features/mentor/hooks/useMentorQueries.ts` (bản
 * riêng vì hai feature không import chéo nhau): FlatList bắn `onEndReached`
 * nhiều lần trong cùng một frame, cả hai lần cùng đọc `isFetchingNextPage ===
 * false` của lần render cũ nên cùng một cursor bị gửi hai lượt. Ref đổi ngay
 * lập tức nên lần gọi thứ hai bị chặn.
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

/** Có bộ lọc nào đang bật không */
function hasFilters(filters: ForumListFilters): boolean {
  return Boolean(filters.keyword) || Boolean(filters.forumTopicId) || filters.mine === true;
}

/** Danh sách chủ đề để dựng hàng chip và form đăng bài */
export function useForumTopics() {
  return useQuery({
    queryKey: forumKeys.topics(),
    queryFn: () => forumRepo.getTopics(),
    // Chủ đề gần như không đổi; không cần tải lại liên tục.
    staleTime: 60 * 60_000,
  });
}

/**
 * Danh sách bài viết.
 *
 * Không có bộ lọc → `/api/forum/feed` (newsfeed ưu tiên theo ngành học).
 * Có bất kỳ bộ lọc nào → `/api/forum/posts`. Gom luật này vào một chỗ để màn
 * hình không phải tự nhớ.
 */
export function useForumList(filters: ForumListFilters) {
  const filtered = hasFilters(filters);

  const query = useInfiniteQuery({
    queryKey: filtered ? forumKeys.posts(filters) : forumKeys.feed(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      filtered
        ? forumRepo.getPosts({ ...filters, cursor: pageParam })
        : forumRepo.getFeed({ cursor: pageParam }),
    getNextPageParam: getNextCursor,
  });

  const posts = useMemo(() => flattenPages(query.data?.pages), [query.data]);

  return { ...query, posts };
}

/**
 * Chi tiết một bài viết.
 *
 * `enabled` tồn tại vì màn hình soạn bài dùng chung hook này: ở chế độ TẠO MỚI
 * nó không có `postId` nào, và thiếu chốt này thì mỗi lần mở form đăng bài sẽ
 * có một `GET /api/forum/posts/` (đường dẫn cụt) rời máy. Query bị tắt đứng yên
 * ở `isPending`, nên nơi gọi phải tự biết khi nào được hỏi tới trạng thái đó.
 */
export function useForumPost(postId: string) {
  return useQuery({
    queryKey: forumKeys.post(postId),
    queryFn: () => forumRepo.getPost(postId),
    enabled: postId.length > 0,
  });
}

/**
 * Bình luận GỐC của một bài.
 *
 * Backend KHÔNG trả reply ở đây (chỉ `replyCount`), nên danh sách này là phẳng
 * và mọi phần tử đều là gốc; reply của từng gốc tải bằng `useCommentReplies`.
 *
 * Trả thêm `taiTrangKe()` đã bọc chốt chặn — màn hình nối thẳng vào
 * `onEndReached`, KHÔNG tự dựng `useRef` lần nữa.
 */
export function useForumComments(postId: string) {
  const query = useInfiniteQuery({
    queryKey: forumKeys.comments(postId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => forumRepo.getComments(postId, { cursor: pageParam }),
    getNextPageParam: getNextCursor,
  });

  const comments = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const taiTrangKe = useChotChanTrangKe(query);

  return { ...query, comments, taiTrangKe };
}

/**
 * Reply của một bình luận gốc (`GET /api/forum/comments/{id}/replies`).
 *
 * Chỉ được gọi khi người dùng MỞ luồng reply — màn hình dựng component chứa
 * hook này chỉ lúc đã mở, nên mỗi bình luận gốc không tự bắn một request.
 * Khoá nằm dưới `forumKeys.comments(postId)` (xem `queryKeys.ts`).
 */
export function useCommentReplies(postId: string, commentId: string) {
  const query = useInfiniteQuery({
    queryKey: forumKeys.replies(postId, commentId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => forumRepo.getCommentReplies(commentId, { cursor: pageParam }),
    getNextPageParam: getNextCursor,
  });

  const replies = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const taiTrangKe = useChotChanTrangKe(query);

  return { ...query, replies, taiTrangKe };
}
