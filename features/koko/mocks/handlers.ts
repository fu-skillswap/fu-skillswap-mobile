/**
 * @file handlers.ts
 * @description Handler MSW cho AI service của Koko ở chế độ mock — đúng hình dạng
 * `ChatResponse` thật (`content`, `requestId`, `sourcesUsed`, camelCase).
 *
 * Trả lời theo từ khoá của câu hỏi cuối để xem được cả ba kiểu bong bóng: có lối
 * sang tab Mentor (`search_mentors`), có lối sang Lịch hẹn (`my_bookings`) và câu
 * trả lời thường. Câu chứa "lỗi" trả 503 kèm `detail` như service thật, để xem
 * nút "Gửi lại".
 */

import { http } from 'msw';

import { jsonMock } from '@/core/dev/jsonMock';
import { aiBaseUrl, AI_URL_MOCK } from '@/features/koko/kokoRepo';

const base = aiBaseUrl() || AI_URL_MOCK;

function traLoi(cauHoi: string): { content: string; sourcesUsed: string[] } {
  const c = cauHoi.toLowerCase();
  if (c.includes('mentor')) {
    return {
      content:
        'Mình tìm được vài mentor hợp với bạn:\n- **Trần Minh Quân**: review CV và luyện phỏng vấn intern.\n- **Lê Thu Trang**: định hướng lộ trình Product.\nBạn mở danh sách mentor để xem lịch trống nhé.',
      sourcesUsed: ['search_mentors'],
    };
  }
  if (c.includes('lịch') || c.includes('đặt')) {
    return {
      content:
        'Để đặt lịch: mở hồ sơ mentor, chọn dịch vụ, chọn khung giờ còn trống rồi gửi yêu cầu. Mentor xác nhận xong, buổi học sẽ nằm ở tab Lịch hẹn.',
      sourcesUsed: ['knowledge_base', 'my_bookings'],
    };
  }
  return {
    content: 'S-coin là đơn vị thanh toán trên SkillSwap. Giá bạn thấy đã gồm phí nền tảng.',
    sourcesUsed: ['knowledge_base'],
  };
}

export const kokoMockHandlers = [
  http.post(`${base}/v1/chat`, async ({ request }) => {
    const body = (await request.json()) as { messages?: { role: string; content: string }[] };
    const cuoi = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')?.content ?? '';
    // Giả độ trễ của hai lượt gọi model để thấy bong bóng "đang soạn".
    await new Promise((r) => setTimeout(r, 900));
    if (cuoi.toLowerCase().includes('lỗi')) {
      return jsonMock({ detail: 'Trợ lý AI đang tạm nghỉ, bạn quay lại sau nhé.' }, { status: 503 });
    }
    return jsonMock({ ...traLoi(cuoi), requestId: `rid-${Date.now()}` });
  }),
];
