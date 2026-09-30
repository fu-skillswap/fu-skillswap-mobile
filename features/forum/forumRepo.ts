/**
 * @file forumRepo.ts
 * @description Toàn bộ lời gọi `/api/forum/*`. Không React, không state —
 * tên hàm giữ quy ước `repositories/` của FE web để đối chiếu hai bên.
 */

import { apiClient } from '@/core/api/client';
import type { CursorPageResponse } from '@/core/api/pagination';
import type {
  ForumCommentResponse,
  ForumCommentUpsertRequest,
  ForumPostResponse,
  ForumPostUpsertRequest,
  ForumReportCreateRequest,
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

  /** Tạo bài viết mới (forum.md §3.5) */
  createPost(input: ForumPostUpsertRequest) {
    return apiClient<ForumPostResponse>('/api/forum/posts', { method: 'POST', data: input });
  },

  /** Sửa bài viết của chính mình; backend từ chối bài của người khác bằng 403 (forum.md §3.6) */
  updatePost(postId: string, input: ForumPostUpsertRequest) {
    return apiClient<ForumPostResponse>(`/api/forum/posts/${postId}`, {
      method: 'PUT',
      data: input,
    });
  },

  /** Xoá mềm bài viết của chính mình (forum.md §3.7) */
  deletePost(postId: string) {
    return apiClient<ForumPostResponse>(`/api/forum/posts/${postId}`, { method: 'DELETE' });
  },

  /** Thả like bài viết; backend trả về bài đã cập nhật (forum.md §5.1) */
  likePost(postId: string) {
    return apiClient<ForumPostResponse>(`/api/forum/posts/${postId}/reaction`, {
      method: 'PUT',
      data: { reactionType: 'LIKE' },
    });
  },

  /** Bỏ like bài viết; backend trả về bài đã cập nhật (forum.md §5.2) */
  unlikePost(postId: string) {
    return apiClient<ForumPostResponse>(`/api/forum/posts/${postId}/reaction`, {
      method: 'DELETE',
    });
  },

  /** Thả like bình luận (forum.md §5.3) */
  likeComment(commentId: string) {
    return apiClient<ForumCommentResponse>(`/api/forum/comments/${commentId}/reaction`, {
      method: 'PUT',
      data: { reactionType: 'LIKE' },
    });
  },

  /** Bỏ like bình luận (forum.md §5.4) */
  unlikeComment(commentId: string) {
    return apiClient<ForumCommentResponse>(`/api/forum/comments/${commentId}/reaction`, {
      method: 'DELETE',
    });
  },

  /**
   * Tạo bình luận, hoặc trả lời một bình luận gốc (forum.md §4.3).
   *
   * `input.replyToCommentId` phải là ID bình luận GỐC — repo không tự quy đổi,
   * việc đó thuộc `resolveReplyTarget`; ở đây mà đoán thêm thì có hai nơi cùng
   * biết một luật và chúng sẽ lệch nhau.
   */
  createComment(postId: string, input: ForumCommentUpsertRequest) {
    return apiClient<ForumCommentResponse>(`/api/forum/posts/${postId}/comments`, {
      method: 'POST',
      data: input,
    });
  },

  /**
   * Xoá bình luận của chính mình (forum.md §4.5); backend từ chối bình luận của
   * người khác bằng 403. Xoá bình luận gốc thì backend xoá luôn mọi reply của nó
   * và trừ đúng số đó vào `commentCount` của bài.
   */
  deleteComment(commentId: string) {
    return apiClient<ForumCommentResponse>(`/api/forum/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Báo cáo một bài viết hoặc bình luận (forum.md §6.1).
   *
   * Trả về `unknown`: `forum.md` chỉ nói phản hồi là `ForumReportResponse` mà
   * không mô tả trường nào, và không chỗ nào trên mobile cần đọc nó. Bịa ra một
   * DTO để typecheck xanh là đúng lớp lỗi mà Global Constraints cấm.
   */
  createReport(input: ForumReportCreateRequest) {
    return apiClient<unknown>('/api/forum/reports', { method: 'POST', data: input });
  },
};
