/**
 * @file kokoRepo.ts
 * @description Gọi AI service của Koko (`POST {AI_URL}/v1/chat`).
 *
 * Đi qua `apiClient` chung, chỉ đổi `baseURL` theo từng request, vì service xác
 * thực bằng CHÍNH access token của backend (`app/security.py` giải đúng khoá và
 * thuật toán của `JwtTokenProvider`). Nhờ vậy được luôn cơ chế 401 → làm mới
 * token → gửi lại của client, không phải viết lại lần hai.
 *
 * Gửi `stream: false`: luồng SSE cần đọc thân phản hồi theo từng mảnh, mà
 * `fetch`/XHR của React Native không cho làm thế nếu không thêm thư viện native.
 * Service hỗ trợ sẵn chế độ JSON một lần cho đúng trường hợp này.
 */

import { apiClient } from '@/core/api/client';
import { getEnv, isMockMode } from '@/core/config/env';
import type { KokoChatResponse, KokoMessage } from '@/features/koko/types';

/** Origin giả của AI ở chế độ mock — handler MSW chặn đúng địa chỉ này */
export const AI_URL_MOCK = 'https://ai.mock';

/**
 * Câu trả lời đi qua hai lượt gọi model (phân loại câu hỏi rồi mới sinh trả
 * lời), có khi kèm tra cứu tài liệu và gọi backend — 20 giây mặc định của client
 * là quá ngắn.
 */
const THOI_GIAN_CHO_MS = 60_000;

/** Origin AI đang dùng; chuỗi rỗng nghĩa là Koko chưa bật được */
export function aiBaseUrl(): string {
  const { aiUrl } = getEnv();
  if (aiUrl) {
    return aiUrl;
  }
  return isMockMode() ? AI_URL_MOCK : '';
}

/** Koko có dùng được không — quyết định có dựng lối vào (card, hàng ghim) hay không */
export function kokoKhaDung(): boolean {
  return aiBaseUrl().length > 0;
}

export const kokoRepo = {
  chat(messages: KokoMessage[]) {
    return apiClient<KokoChatResponse>('/v1/chat', {
      method: 'POST',
      baseURL: aiBaseUrl(),
      timeout: THOI_GIAN_CHO_MS,
      data: { messages, stream: false },
    });
  },
};
