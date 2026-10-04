/**
 * @file profileRepo.ts
 * @description Đọc hồ sơ sinh viên. Endpoint và hình dạng theo `identity.md` §5.1.
 * Không React, không state — giữ đúng quy ước `repositories/` của FE web.
 */

import { apiClient } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import type { StudentProfileResponse } from '@/features/profile/types';

export const profileRepo = {
  /**
   * Hồ sơ sinh viên của chính mình.
   *
   * Trả `null` khi backend đáp 404 — theo `identity.md` §5.1 đó là trạng thái
   * BÌNH THƯỜNG của người vừa đăng nhập lần đầu, không phải lỗi. Mọi mã lỗi
   * khác (401 hết phiên, 5xx backend sập, mất mạng) vẫn ném ra để màn hình phân
   * biệt được "chưa có hồ sơ" với "không đọc được hồ sơ".
   */
  async getStudentProfile(): Promise<StudentProfileResponse | null> {
    try {
      return await apiClient<StudentProfileResponse>('/api/me/student-profile');
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
};
