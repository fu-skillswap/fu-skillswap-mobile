/**
 * @file types.ts
 * @description Hợp đồng của AI service (`fu-skillswap-ai`, `app/routers/chat.py`).
 *
 * Service KHÔNG giữ trạng thái hội thoại: mỗi lượt app gửi lại toàn bộ lịch sử,
 * service tự cắt còn 20 tin cuối và mỗi tin 2000 ký tự (`sanitize_history`).
 */

/** Một tin trong lịch sử gửi lên — chỉ hai vai này được service giữ lại */
export interface KokoMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** `ChatRequest` — `stream: false` để nhận JSON một lần (xem `kokoRepo.ts`) */
export interface KokoChatRequest {
  messages: KokoMessage[];
  stream: false;
}

/** `ChatResponse` — service trả camelCase */
export interface KokoChatResponse {
  content: string;
  requestId: string;
  /**
   * Nguồn dữ liệu service đã tra trước khi trả lời: `knowledge_base`,
   * `search_mentors`, `my_bookings`. Mảng rỗng là trả lời từ kiến thức chung.
   */
  sourcesUsed: string[];
}

/** Một tin hiển thị trên màn — giữ trong bộ đệm TanStack Query, không ghi xuống đĩa */
export interface TinKoko {
  id: string;
  vaiTro: 'user' | 'assistant';
  noiDung: string;
  /** Tin của người dùng gửi không được: thông điệp lỗi để hiện ngay dưới bong bóng */
  loi?: string | null;
  /** Tin của Koko: nguồn đã tra (`sourcesUsed`) */
  nguon?: string[];
}
