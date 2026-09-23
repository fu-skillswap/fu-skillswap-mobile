/**
 * @file useForumQueries.ts
 * @description Các hook đọc dữ liệu diễn đàn.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { flattenPages, getNextCursor } from '@/core/api/pagination';
import { buildCommentTree } from '@/features/forum/commentTree';
import { forumRepo } from '@/features/forum/forumRepo';
import { forumKeys } from '@/features/forum/queryKeys';
import type { ForumListFilters } from '@/features/forum/types';

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

/** Bình luận của một bài, đã dựng thành cây 1 cấp */
export function useForumComments(postId: string) {
  const query = useInfiniteQuery({
    queryKey: forumKeys.comments(postId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => forumRepo.getComments(postId, { cursor: pageParam }),
    getNextPageParam: getNextCursor,
  });

  const comments = useMemo(
    () => buildCommentTree(flattenPages(query.data?.pages)),
    [query.data],
  );

  return { ...query, comments };
}
