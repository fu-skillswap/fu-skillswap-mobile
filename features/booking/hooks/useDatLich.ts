/**
 * @file useDatLich.ts
 * @description Hook cho luồng đặt lịch của mentee: lịch rảnh → khung giờ chính
 * xác → báo giá → tạo yêu cầu đặt lịch. Theo `docs/frontend-guide/booking_1T1.md`
 * §3 và `mentor-discovery.md` §5.2 của backend.
 *
 * Ba luật của backend mà hook này giữ hộ màn hình:
 *
 * 1. `startAt` gửi lên phải là NGUYÊN `candidate.startAt` (Instant UTC) — không
 *    dựng lại từ giờ hiển thị. Màn hình chỉ chuyền nguyên chuỗi đó đi.
 * 2. Báo giá KHÔNG giữ chỗ và có thể đổi; nó là truy vấn đọc (`useQuery`), tải lại
 *    mỗi khi mở màn xác nhận (`staleTime: 0`).
 * 3. `POST /api/bookings` bắt buộc `Idempotency-Key`; cùng payload thì dùng lại
 *    key (bấm lại sau lỗi mạng không tạo hai booking), đổi payload thì key mới
 *    (dùng lại key với payload khác bị backend trả 409).
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createIdempotencyStore } from '@/core/api/idempotency';
import { bookingRepo } from '@/features/booking/bookingRepo';
import { bookingKeys } from '@/features/booking/queryKeys';
import type {
  BookingQuoteRequest,
  CreateBookingRequest,
  MentorAvailabilitySlotResponse,
} from '@/features/booking/types';

/** Lịch rảnh của mentor trong một khoảng ngày (`"2026-10-05"` … `"2026-10-11"`) */
export function useAvailabilitySlots(mentorUserId: string, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: bookingKeys.slots(mentorUserId, fromDate, toDate),
    queryFn: () => bookingRepo.getAvailabilitySlots(mentorUserId, fromDate, toDate),
    // Route có thể render một nhịp trước khi có tham số.
    enabled: mentorUserId.length > 0,
    // Lịch rảnh đổi khi người khác đặt; đừng giữ lâu.
    staleTime: 30_000,
  });
}

/**
 * Khung giờ chính xác của MỘT dịch vụ trong NHIỀU slot của cùng một ngày.
 *
 * Một ngày có thể có vài slot (sáng, tối); mỗi slot là một request riêng. Trả về
 * mảng theo đúng thứ tự `slots` để màn hình ghép lại.
 */
export function useSlotCandidates(
  mentorUserId: string,
  slots: readonly MentorAvailabilitySlotResponse[],
  serviceId: string,
) {
  return useQueries({
    queries: slots.map((slot) => ({
      queryKey: bookingKeys.candidates(mentorUserId, slot.slotId, serviceId),
      queryFn: () => bookingRepo.getSlotCandidates(mentorUserId, slot.slotId, serviceId),
      enabled: mentorUserId.length > 0 && serviceId.length > 0,
      staleTime: 15_000,
    })),
  });
}

/** Báo giá cho đúng một khung giờ. `input` là `null` khi chưa đủ tham số. */
export function useBookingQuote(input: BookingQuoteRequest | null) {
  return useQuery({
    queryKey: bookingKeys.quote(input?.slotId ?? '', input?.serviceId ?? '', input?.startAt ?? ''),
    queryFn: () => {
      // `enabled` đã chặn nhánh này; kiểm lại để TypeScript thu hẹp kiểu mà không cần `!`.
      if (!input) {
        throw new Error('Thiếu thông tin khung giờ để báo giá');
      }
      return bookingRepo.quoteBooking(input);
    },
    enabled: input !== null,
    // Báo giá là ước tính tại thời điểm gọi — luôn lấy mới khi mở màn.
    staleTime: 0,
    // 404/409 nghĩa là khung giờ vừa mất; thử lại không cứu được, màn hình phải
    // mời người dùng chọn giờ khác.
    retry: false,
  });
}

/** Gửi yêu cầu đặt lịch */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  // Kho key sống qua các lần render — lý do ở `useCancelBooking`.
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: CreateBookingRequest) =>
      bookingRepo.createBooking(input, khoKhoa.keyFor('tao-booking', input)),
    onSuccess: () => {
      khoKhoa.release('tao-booking');
      void queryClient.invalidateQueries({ queryKey: bookingKeys.listsAll() });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.countsAll() });
      // Khung giờ vừa đặt giờ đã có người chờ; lịch rảnh phải tải lại.
      void queryClient.invalidateQueries({ queryKey: [...bookingKeys.all, 'slots'] });
      void queryClient.invalidateQueries({ queryKey: [...bookingKeys.all, 'candidates'] });
    },
  });
}
