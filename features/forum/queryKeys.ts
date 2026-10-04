/**
 * @file queryKeys.ts
 * @description Khoá query của diễn đàn, gom một chỗ để invalidate không bị lệch.
 * Mọi khoá bắt đầu bằng 'forum' nên invalidate cả nhánh chỉ cần `forumKeys.all`.
 */

import type { ForumListFilters } from '@/features/forum/types';

export const forumKeys = {
  all: ['forum'] as const,
  topics: () => [...forumKeys.all, 'topics'] as const,
  feed: () => [...forumKeys.all, 'feed'] as const,
  /**
   * Tiền tố chung của MỌI danh sách có lọc.
   *
   * `posts(filters)` gắn thêm bộ lọc vào khoá, nên mỗi bộ lọc là một entry cache
   * riêng. Cập nhật lạc quan cần chạm tới tất cả chúng mà không biết trước bộ
   * lọc nào đang sống, nên phải có tiền tố để khớp theo nhánh.
   */
  postsAll: () => [...forumKeys.all, 'posts'] as const,
  posts: (filters: ForumListFilters) => [...forumKeys.postsAll(), filters] as const,
  post: (postId: string) => [...forumKeys.all, 'post', postId] as const,
  comments: (postId: string) => [...forumKeys.all, 'comments', postId] as const,
};
