/**
 * @file chatRepo.ts
 * @description Gọi REST của nhánh chat (`ChatController.java`,
 * `/api/me/conversations`). Realtime (STOMP) CHƯA dùng ở bản mobile: app chưa có
 * `@stomp/stompjs`, nên màn hình tải lại theo chu kỳ — xem `hooks/useChat.ts`.
 */

import { apiClient } from '@/core/api/client';
import type { CursorPageResponse } from '@/core/api/pagination';
import type {
  ConversationReadResponse,
  ConversationResponse,
  MessageResponse,
  SendMessageRequest,
} from '@/features/chat/types';

export const chatRepo = {
  /** Hộp thư — phân trang cursor, `cursor` là chuỗi mờ backend trả */
  getConversations(cursor?: string | null, limit = 20) {
    return apiClient<CursorPageResponse<ConversationResponse>>('/api/me/conversations', {
      params: cursor ? { cursor, limit } : { limit },
    });
  },

  getConversation(conversationId: string) {
    return apiClient<ConversationResponse>(`/api/me/conversations/${conversationId}`);
  },

  /**
   * Một cửa sổ tin nhắn. Không truyền `beforeSequence` thì là các tin MỚI NHẤT.
   * Backend không hứa thứ tự — màn hình tự sắp theo `sequence` tăng dần.
   */
  getMessages(conversationId: string, beforeSequence?: number | null, limit = 30) {
    return apiClient<MessageResponse[]>(`/api/me/conversations/${conversationId}/messages`, {
      params: beforeSequence != null ? { beforeSequence, limit } : { limit },
    });
  },

  sendMessage(conversationId: string, input: SendMessageRequest) {
    return apiClient<MessageResponse>(`/api/me/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: input,
    });
  },

  markRead(conversationId: string, lastReadSequence: number) {
    return apiClient<ConversationReadResponse>(`/api/me/conversations/${conversationId}/read`, {
      method: 'PATCH',
      body: { lastReadSequence },
    });
  },
};
