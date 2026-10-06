/**
 * @file hoiThoaiKoko.ts
 * @description Logic thuần của màn Chat với Koko: lịch sử gửi lên service, làm
 * sạch câu trả lời, nhãn nguồn và thông điệp lỗi. Không đụng React để test được
 * từng luật một.
 */

import { ApiClientError, toUserMessage } from '@/core/api/errors';
import type { KokoMessage, TinKoko } from '@/features/koko/types';

/** Giới hạn mỗi tin của service (`MAX_MESSAGE_CHARS`); quá thì service cắt lặng lẽ */
export const TOI_DA_KY_TU = 2000;

/** Service chỉ đọc 20 tin cuối (`CHAT_MAX_HISTORY`) — gửi thừa chỉ tốn băng thông */
export const LICH_SU_TOI_DA = 20;

/** Bốn câu hỏi gợi ý — cùng bộ với `KouKouQuickActions` của bản web */
export const GOI_Y = [
  { khoa: 'mentor', nhan: 'Tìm mentor hợp mục tiêu', cauHoi: 'Tìm mentor phù hợp với mục tiêu của mình' },
  { khoa: 'dat-lich', nhan: 'Cách đặt lịch với mentor', cauHoi: 'Hướng dẫn cách đặt lịch với mentor' },
  { khoa: 'scoin', nhan: 'S-coin dùng thế nào?', cauHoi: 'Giải thích về S-coin và cách sử dụng' },
  { khoa: 'ky-nang', nhan: 'Gợi ý kỹ năng nên học', cauHoi: 'Gợi ý kỹ năng nên học dựa trên mục tiêu' },
] as const;

/**
 * Lịch sử gửi lên cho một lượt hỏi. Bỏ các tin đã gửi hỏng (chúng chưa từng có
 * câu trả lời, gửi kèm sẽ làm model trả lời cả câu cũ lẫn câu mới) và chỉ giữ
 * `LICH_SU_TOI_DA` tin cuối.
 */
export function lichSuGui(tin: readonly TinKoko[]): KokoMessage[] {
  return tin
    .filter((t) => !t.loi && t.noiDung.trim().length > 0)
    .slice(-LICH_SU_TOI_DA)
    .map((t) => ({ role: t.vaiTro, content: t.noiDung }));
}

/**
 * Bỏ cú pháp markdown mà `Text` của React Native sẽ in nguyên ra màn. Prompt dặn
 * model "không dùng markdown phức tạp" nhưng model vẫn hay in `**đậm**`, tiêu đề
 * `#` và gạch đầu dòng `*`.
 */
export function lamSachTraLoi(noiDung: string): string {
  return noiDung
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NHAN_NGUON: Record<string, string> = {
  knowledge_base: 'Tài liệu SkillSwap',
  search_mentors: 'Danh sách mentor',
  my_bookings: 'Lịch hẹn của bạn',
};

/** Nhãn tiếng Việt cho các nguồn service đã tra; nguồn lạ thì bỏ qua */
export function nhanNguon(nguon: readonly string[] | undefined): string[] {
  return [...new Set(nguon ?? [])].flatMap((n) => (NHAN_NGUON[n] ? [NHAN_NGUON[n]] : []));
}

/**
 * Câu báo lỗi đặt ngay dưới tin gửi hỏng. Với 429/502/503 service đã viết sẵn
 * câu tiếng Việt cho người dùng ("Bạn đã hỏi khá nhiều trong một giờ qua…",
 * "Trợ lý AI đang tạm nghỉ…") — dùng nguyên câu đó.
 */
export function thongDiepLoiKoko(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 0) {
      return error.code === 'ECONNABORTED'
        ? 'Koko trả lời quá lâu. Thử hỏi lại nhé.'
        : 'Không có kết nối. Kiểm tra mạng rồi thử lại.';
    }
    if ([429, 502, 503].includes(error.status) && error.message && !/status code/i.test(error.message)) {
      return error.message;
    }
    if (error.status === 401) {
      return 'Phiên đăng nhập đã kết thúc. Đăng nhập lại để hỏi tiếp.';
    }
  }
  const { title, description } = toUserMessage(error);
  return `${title}. ${description}`;
}

/** Chỉ tin cuối cùng được gửi lại — gửi lại tin nằm giữa sẽ làm câu trả lời lệch chỗ */
export function coTheGuiLai(tin: readonly TinKoko[], id: string): boolean {
  const cuoi = tin[tin.length - 1];
  return cuoi !== undefined && cuoi.id === id && cuoi.vaiTro === 'user' && Boolean(cuoi.loi);
}

/**
 * Tên gọi trong lời chào: bỏ họ (từ đầu), giữ tên đệm và tên — "Nguyễn Thu Hà"
 * thành "Thu Hà", đúng như `KokoChat.dc.html`. Tên một chữ thì giữ nguyên.
 */
export function tenGoi(hoTen: string | null | undefined): string {
  const phan = (hoTen ?? '').trim().split(/\s+/).filter(Boolean);
  return phan.length > 1 ? phan.slice(1).join(' ') : (phan[0] ?? '');
}

/** Id tạm cho tin trên máy — chỉ cần duy nhất trong một hội thoại */
export function taoIdTin(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
