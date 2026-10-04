/**
 * @file mentorBlogRepo.ts
 * @description Blog của mentor đang đăng nhập (`MentorBlogController.java`,
 * `/api/me/blog/posts`) — cùng endpoint bản web dùng.
 */

import { apiClient } from '@/core/api/client';
import type {
  BlogExpectedVersionRequest,
  MentorBlogPostCreateRequest,
  MentorBlogPostDetailResponse,
  MentorBlogPostUpdateRequest,
} from '@/features/mentorBlog/types';

export const mentorBlogRepo = {
  /** Backend trả tối đa 50 bài gần nhất, KHÔNG phân trang */
  list() {
    return apiClient<MentorBlogPostDetailResponse[]>('/api/me/blog/posts');
  },

  get(postId: string) {
    return apiClient<MentorBlogPostDetailResponse>(`/api/me/blog/posts/${postId}`);
  },

  /** Luôn tạo BẢN NHÁP; muốn đăng thì gọi `publish` sau */
  create(input: MentorBlogPostCreateRequest) {
    return apiClient<MentorBlogPostDetailResponse>('/api/me/blog/posts', { method: 'POST', body: input });
  },

  update(postId: string, input: MentorBlogPostUpdateRequest) {
    return apiClient<MentorBlogPostDetailResponse>(`/api/me/blog/posts/${postId}`, { method: 'PUT', body: input });
  },

  publish(postId: string, input: BlogExpectedVersionRequest) {
    return apiClient<MentorBlogPostDetailResponse>(`/api/me/blog/posts/${postId}/publish`, {
      method: 'POST',
      body: input,
    });
  },

  archive(postId: string, input: BlogExpectedVersionRequest) {
    return apiClient<MentorBlogPostDetailResponse>(`/api/me/blog/posts/${postId}/archive`, {
      method: 'POST',
      body: input,
    });
  },
};
