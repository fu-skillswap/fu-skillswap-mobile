/**
 * @file loiLichDay.ts
 * @description Câu lỗi riêng cho các thao tác ở tab Lịch dạy, nơi câu chung của
 * `toUserMessage()` nói sai hoặc lộ mã thô.
 *
 * Backend ném nhiều lỗi nghiệp vụ dưới mã chung (`RESOURCE_CONFLICT` → 409
 * `SYS_0007`, `BAD_REQUEST` → 400 `SYS_0002`) và đặt MÃ THẬT vào `message`. Với
 * 409, `toUserMessage()` luôn nói "Dữ liệu đã được cập nhật…" — câu sai cho một
 * khung giờ trùng; với 400 nó in thẳng `message`, tức mã thô
 * `AVAILABILITY_RANGE_TOO_LARGE`. Nguồn: `MentorAvailabilityService.java`,
 * `MentorServiceRetirementPortImpl.java`, `shared/exception/ErrorCode.java`.
 */

import { ApiClientError, toUserMessage } from '@/core/api/errors';

/** `MentorAvailabilityService.MAXIMUM_PARENT_SLOT_DURATION_MINUTES = 720` */
export const SLOT_DAI_TOI_DA_GIO = 12;

/** `ErrorCode.AVAILABILITY_TEMPLATE_VERSION_CONFLICT` / `GENERATED_SLOT_MANAGED_BY_TEMPLATE` */
const MA_SLOT_TU_LICH_LAP = new Set(['AVAIL_4302', 'AVAIL_4313']);

/** Câu lỗi khi tạo giờ rảnh (`POST /api/me/availability-slots`) */
export function moTaLoiTaoSlot(loi: unknown): string {
  if (loi instanceof ApiClientError) {
    if (loi.message === 'AVAILABILITY_RANGE_TOO_LARGE') {
      return `Một khung giờ rảnh dài tối đa ${SLOT_DAI_TOI_DA_GIO} tiếng. Hãy chia thành nhiều khung.`;
    }
    // `existsOverlappingActiveSlot` → RESOURCE_CONFLICT kèm câu tiếng Việt về
    // trùng lịch; mọi 409 khác của bước tạo cũng là xung đột khung giờ.
    if (loi.status === 409) {
      return 'Khung giờ này trùng với một giờ rảnh khác của bạn. Hãy chọn giờ khác.';
    }
  }
  return toUserMessage(loi).description;
}

/** Câu lỗi khi ngừng nhận lịch một slot (`POST /{slotId}/deactivate`) */
export function moTaLoiNgungSlot(loi: unknown): string {
  if (loi instanceof ApiClientError) {
    // Slot sinh từ lịch lặp hàng tuần phải gửi `expectedTemplateVersion`, mà DTO
    // slot không cho biết slot nào sinh từ lịch lặp hay phiên bản của nó — nên
    // trên app thao tác này luôn hỏng với các slot đó.
    if (MA_SLOT_TU_LICH_LAP.has(loi.code)) {
      return 'Khung này được tạo từ lịch lặp hàng tuần. Hãy chỉnh lịch lặp trên web SkillSwap.';
    }
    if (loi.message === 'AVAILABILITY_SLOT_VERSION_CONFLICT') {
      return 'Khung giờ vừa thay đổi. Kéo xuống để tải lại rồi thử lại.';
    }
  }
  return toUserMessage(loi).title;
}

/**
 * Tắt dịch vụ còn yêu cầu đặt lịch đang chờ: `retireFutureOffers()` ném
 * RESOURCE_CONFLICT với message `SERVICE_HAS_PENDING_BOOKINGS` trừ khi request
 * gửi `rejectPendingBookings: true`.
 */
export function laLoiDichVuConYeuCauCho(loi: unknown): boolean {
  return loi instanceof ApiClientError && loi.status === 409 && loi.message === 'SERVICE_HAS_PENDING_BOOKINGS';
}
