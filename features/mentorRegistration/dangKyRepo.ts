/**
 * @file dangKyRepo.ts
 * @description REST của luồng đăng ký mentor — đúng các endpoint bản web gọi
 * (`repositories/mentorProfileRepo.ts` của FE web):
 * `MentorProfileController`, `MentorProfileItemController`,
 * `MentorVerificationController`.
 */

import { apiClient } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import type {
  MentorAchievementResponse,
  MentorFeaturedProjectResponse,
  MentorProfileResponse,
} from '@/features/mentorMode/types';
import type {
  ConfirmDocumentRequest,
  MentorAchievementRequest,
  MentorFeaturedProjectRequest,
  MentorProfileUpsertRequest,
  MentorVerificationRequestResponse,
  SubmitVerificationRequest,
  UploadIntentRequest,
  UploadIntentResponse,
} from '@/features/mentorRegistration/types';

export const dangKyRepo = {
  /**
   * Hồ sơ xác thực gần nhất. Trả `null` khi backend đáp 404 "Chưa có hồ sơ xác
   * thực mentor nào" — trạng thái bình thường của người chưa đăng ký lần nào.
   */
  async getVerification(): Promise<MentorVerificationRequestResponse | null> {
    try {
      return await apiClient<MentorVerificationRequestResponse>('/api/me/mentor-verification');
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /** Mở (hoặc lấy lại) hồ sơ xác thực đang hoạt động — backend tự trả bản đang có */
  requestVerification() {
    return apiClient<MentorVerificationRequestResponse>('/api/me/mentor-verification/request', { method: 'POST' });
  },

  saveProfile(input: MentorProfileUpsertRequest) {
    return apiClient<MentorProfileResponse>('/api/me/mentor-profile', { method: 'PUT', body: input });
  },

  createProject(input: MentorFeaturedProjectRequest) {
    return apiClient<MentorFeaturedProjectResponse>('/api/me/mentor-projects', { method: 'POST', body: input });
  },
  updateProject(id: string, input: MentorFeaturedProjectRequest) {
    return apiClient<MentorFeaturedProjectResponse>(`/api/me/mentor-projects/${id}`, { method: 'PUT', body: input });
  },
  deleteProject(id: string) {
    return apiClient<null>(`/api/me/mentor-projects/${id}`, { method: 'DELETE' });
  },

  createAchievement(input: MentorAchievementRequest) {
    return apiClient<MentorAchievementResponse>('/api/me/mentor-achievements', { method: 'POST', body: input });
  },
  updateAchievement(id: string, input: MentorAchievementRequest) {
    return apiClient<MentorAchievementResponse>(`/api/me/mentor-achievements/${id}`, { method: 'PUT', body: input });
  },
  deleteAchievement(id: string) {
    return apiClient<null>(`/api/me/mentor-achievements/${id}`, { method: 'DELETE' });
  },

  createUploadIntent(input: UploadIntentRequest) {
    return apiClient<UploadIntentResponse>('/api/me/mentor-verification/documents/upload-intents', {
      method: 'POST',
      body: input,
    });
  },
  confirmDocument(input: ConfirmDocumentRequest) {
    return apiClient<MentorVerificationRequestResponse>('/api/me/mentor-verification/documents', {
      method: 'POST',
      body: input,
    });
  },
  deleteDocument(documentId: string) {
    return apiClient<MentorVerificationRequestResponse>(`/api/me/mentor-verification/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  submit(input: SubmitVerificationRequest) {
    return apiClient<MentorVerificationRequestResponse>('/api/me/mentor-verification/submit', {
      method: 'POST',
      body: input,
    });
  },
  withdraw() {
    return apiClient<MentorVerificationRequestResponse>('/api/me/mentor-verification/withdraw', { method: 'POST' });
  },
};
