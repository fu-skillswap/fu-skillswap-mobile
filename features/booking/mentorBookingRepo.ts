/**
 * @file mentorBookingRepo.ts
 * @description Lời gọi `/api/mentor/bookings/*` mà màn chi tiết phía mentor cần
 * NGOÀI chấp nhận/từ chối (hai lời gọi đó đã ở `bookingRepo.ts`): mentor xác
 * nhận hoàn tất buổi học và mentor huỷ buổi đã xác nhận.
 *
 * Tách file riêng để phía mentor và phía mentee sửa `bookingRepo.ts` song song
 * mà không giẫm lên nhau.
 *
 * Nguồn: `modules/booking/controller/MentorBookingController.java`. Cả hai
 * endpoint mang `@Idempotent` — thiếu `Idempotency-Key` là 400
 * `IDEMPOTENCY_KEY_REQUIRED`; key do chỗ gọi giữ (xem `useBookingMutations.ts`).
 */

import { apiClient } from '@/core/api/client';
import { idempotencyHeaders } from '@/core/api/idempotency';
import type {
  BookingResponse,
  CancelBookingRequest,
  CompleteBookingRequest,
} from '@/features/booking/types';

export const mentorBookingRepo = {
  /**
   * Mentor xác nhận buổi học đã diễn ra (`POST /{id}/complete`).
   *
   * Thân `CompleteBookingRequest` là tuỳ chọn (`@RequestBody(required = false)`).
   * Backend chỉ nhận khi booking ở `AWAITING_MENTOR_COMPLETION`, sau giờ kết thúc
   * và trước hạn 24 giờ — đúng điều kiện của cờ `canCompleteByMentor`. Gửi lại
   * sau khi đã hoàn tất thì backend trả booking nguyên trạng.
   */
  completeBooking(bookingId: string, input: CompleteBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/mentor/bookings/${bookingId}/complete`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },

  /**
   * Mentor huỷ một buổi đã xác nhận (`POST /{id}/cancel`).
   *
   * `cancelReason` bắt buộc (≤ 1000 ký tự). Backend giới hạn 3 lần huỷ / giờ và
   * tự áp phạt nếu huỷ sát giờ — màn hình phải nói trước điều đó.
   */
  cancelBooking(bookingId: string, input: CancelBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/mentor/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },
};
