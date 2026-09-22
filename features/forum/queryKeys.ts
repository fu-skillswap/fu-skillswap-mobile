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
  posts: (filters: ForumListFilters) => [...forumKeys.all, 'posts', filters] as const,
  post: (postId: string) => [...forumKeys.all, 'post', postId] as const,
  comments: (postId: string) => [...forumKeys.all, 'comments', postId] as const,
};
