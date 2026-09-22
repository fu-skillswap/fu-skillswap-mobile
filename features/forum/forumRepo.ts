/**
 * @file forumRepo.ts
 * @description Toàn bộ lời gọi `/api/forum/*`. Không React, không state —
 * tên hàm giữ quy ước `repositories/` của FE web để đối chiếu hai bên.
 */

import { apiClient } from '@/core/api/client';
import type { CursorPageResponse } from '@/core/api/pagination';
import type {
  ForumCommentResponse,
  ForumPostResponse,
  ForumTopicResponse,
} from '@/features/forum/types';

/** Tham số phân trang cursor dùng chung */
export interface CursorParams {
  cursor?: string;
  limit?: number;
}

/** Bộ lọc của `GET /api/forum/posts` */
export interface ForumPostFilters extends CursorParams {
  keyword?: string;
  forumTopicId?: string;
  mine?: boolean;
}

/**
 * Bỏ các tham số rỗng thay vì gửi chuỗi trống lên backend.
 * `keyword=` khiến backend hiểu là "tìm chuỗi rỗng" chứ không phải "không lọc".
 */
function cleanParams(params: Record<string, string | number | boolean | undefined>) {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export const forumRepo = {
  /** Danh sách chủ đề, gọi trước khi hiện bộ lọc hoặc form đăng bài */
  getTopics() {
    return apiClient<ForumTopicResponse[]>('/api/forum/topics');
  },

  /**
   * Newsfeed ưu tiên bài cùng ngành học của người dùng.
   * Không nhận bộ lọc — muốn lọc thì dùng `getPosts`.
   */
  getFeed(params: CursorParams) {
    return apiClient<CursorPageResponse<ForumPostResponse>>('/api/forum/feed', {
      params: cleanParams({ ...params }),
    });
  },

  /** Tra cứu bài viết theo từ khoá, chủ đề, hoặc chỉ bài của tôi */
  getPosts(params: ForumPostFilters) {
    return apiClient<CursorPageResponse<ForumPostResponse>>('/api/forum/posts', {
      params: cleanParams({ ...params }),
    });
  },

  /** Chi tiết một bài viết */
  getPost(postId: string) {
    return apiClient<ForumPostResponse>(`/api/forum/posts/${postId}`);
  },

  /** Bình luận của một bài, backend trả từ cũ nhất đến mới nhất */
  getComments(postId: string, params: CursorParams) {
    return apiClient<CursorPageResponse<ForumCommentResponse>>(
      `/api/forum/posts/${postId}/comments`,
      { params: cleanParams({ ...params }) },
    );
  },
};
