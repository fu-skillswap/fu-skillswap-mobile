/**
 * @file mentorRepo.ts
 * @description Toàn bộ lời gọi `/api/mentors/*`. Không React, không state.
 *
 * Lưu ý về phân quyền (`mentor-discovery.md` §2, §4.2): `GET /api/mentors`,
 * `GET /api/mentors/{id}` và `/reviews` là CÔNG KHAI, còn
 * `GET /api/mentors/recommendations` BẮT BUỘC đăng nhập. Tab Đặt lịch nằm sau
 * gate của `(tabs)` nên luôn có token, nhưng đừng dựa vào điều đó ở tầng này.
 */

import { apiClient } from '@/core/api/client';
import type { PageResponse } from '@/core/api/pagination';
import type {
  MentorDiscoveryCardResponse,
  MentorDiscoveryDetailResponse,
  MentorRecommendationResponse,
  MentorReviewResponse,
  MentorSortBy,
} from '@/features/mentor/types';

export interface MentorSearchFilters {
  page?: number;
  size?: number;
  keyword?: string;
  campusId?: string;
  specializationId?: string;
  sortBy?: MentorSortBy;
  direction?: 'ASC' | 'DESC';
}

export interface ReviewPageParams {
  page?: number;
  size?: number;
  sortBy?: 'createdAt' | 'rating';
  direction?: 'ASC' | 'DESC';
}

/**
 * Bỏ các tham số rỗng thay vì gửi chuỗi trống.
 *
 * Lọc theo `undefined` và chuỗi rỗng, KHÔNG theo tính truthy: `page: 0` là trang
 * đầu và phải được gửi đi. Giống `cleanParams` của `features/forum/forumRepo.ts`
 * — hai bản riêng vì hai nhánh có thể lệch nhau về sau.
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

export const mentorRepo = {
  /** Gợi ý mentor theo ngành học; trả về MẢNG, không phải trang (§4.2) */
  getRecommendations(limit?: number) {
    return apiClient<MentorRecommendationResponse[]>('/api/mentors/recommendations', {
      params: cleanParams({ limit }),
    });
  },

  /** Tìm và lọc mentor (§2) */
  searchMentors(filters: MentorSearchFilters) {
    return apiClient<PageResponse<MentorDiscoveryCardResponse>>('/api/mentors', {
      params: cleanParams({ ...filters }),
    });
  },

  /** Hồ sơ mentor đầy đủ, kèm danh sách dịch vụ (§3) */
  getMentor(mentorUserId: string) {
    return apiClient<MentorDiscoveryDetailResponse>(`/api/mentors/${mentorUserId}`);
  },

  /** Đánh giá của một mentor (§4.1) */
  getMentorReviews(mentorUserId: string, params: ReviewPageParams) {
    return apiClient<PageResponse<MentorReviewResponse>>(`/api/mentors/${mentorUserId}/reviews`, {
      params: cleanParams({ ...params }),
    });
  },
};
