/**
 * @file useBookingMutations.ts
 * @description Thao tác ghi của nhánh booking. Hiện chỉ có một: mentee hủy lịch.
 *
 * Bốn luật mà mọi sửa đổi sau này phải giữ:
 *
 * 1. **`Idempotency-Key` là BẮT BUỘC.** `POST /api/me/bookings/{id}/cancel` mang
 *    `@Idempotent`, và `IdempotencyAspect.normalizeKey()` ném
 *    `BAD_REQUEST / "IDEMPOTENCY_KEY_REQUIRED"` ngay khi header thiếu. Không có
 *    nó thì MỌI lần hủy nhận 400, và câu lỗi không hề nhắc tới idempotency nên
 *    rất dễ bị đọc thành "lý do hủy không hợp lệ".
 *
 * 2. **Key phải ỔN ĐỊNH cho cùng một ý định.** Dùng `createIdempotencyStore()`
 *    với `operationId = bookingId`: lần gửi lại sau khi mất mạng dùng ĐÚNG key
 *    cũ nên backend replay kết quả đã commit, thay vì thử hủy lần nữa và nhận
 *    409 "booking không ở trạng thái có thể hủy" — một câu lỗi khiến người dùng
 *    tin là họ hủy thất bại trong khi booking ĐÃ bị hủy. Key chỉ được quên
 *    (`release`) khi thao tác kết thúc hẳn.
 *
 * 3. **`networkMode: 'always'`** (mục 6 của quy ước). Mặc định `'online'` HOÃN
 *    request khi mất mạng: nút quay mãi, `onSettled` không chạy, và người dùng
 *    không có cách nào biết yêu cầu hủy của mình vẫn đang nằm chờ. Với
 *    `'always'`, cú bấm lúc mất mạng thất bại ngay và hiện lỗi thật.
 *
 * 4. **KHÔNG cập nhật lạc quan.** Backend quyết định rất nhiều thứ ở bước hủy
 *    (hủy một booking `PENDING` khác hẳn hủy một buổi đã xác nhận, và tỉ lệ hoàn
 *    tiền phụ thuộc `cancellationRefundPolicy` cùng việc còn sớm hay đã muộn).
 *    Vẽ trước một trạng thái "đã hủy" rồi hoàn tác là cách chắc chắn để hiện sai
 *    số tiền được hoàn. Ở đây chỉ `invalidate` và để backend nói lại.
 *
 * Backend còn chặn 3 lần hủy / 1 giờ (`RateLimitScope.SECURITY` trong
 * `MyBookingController.cancelBooking`), nên khối lỗi ở giao diện KHÔNG kèm nút
 * thử lại — bấm lại vẫn hỏng và vẫn tiêu một lượt. Cùng quyết định với
 * `ReportSheet` của diễn đàn.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createIdempotencyStore } from '@/core/api/idempotency';
import { bookingRepo } from '@/features/booking/bookingRepo';
import { mentorBookingRepo } from '@/features/booking/mentorBookingRepo';
import { bookingKeys } from '@/features/booking/queryKeys';
import type {
  AcceptBookingRequest,
  CancelBookingRequest,
  ConfirmBookingRequest,
  CompleteBookingRequest,
  RejectBookingRequest,
} from '@/features/booking/types';
// Import thẳng file khoá (không qua barrel `@/features/mentorMode`): barrel đó
// kéo màn Tổng quan, mà màn đó lại import barrel booking — thành vòng import.
import { mentorModeKeys } from '@/features/mentorMode/queryKeys';

/** Tham số của một lần hủy: booking nào, vì lý do gì */
export interface HuyLichInput extends CancelBookingRequest {
  bookingId: string;
}

/**
 * Mentee hủy một booking.
 *
 * Sau khi hủy, MỌI danh sách lịch hẹn đều không còn đúng: booking vừa hủy phải
 * rời tab trạng thái cũ và xuất hiện ở tab "Mentee hủy". Vì vậy invalidate theo
 * TIỀN TỐ `bookingKeys.listsAll()` chứ không theo khoá của tab đang mở — mỗi tab
 * là một entry cache riêng, và ở đây không biết trước những tab nào đang sống.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  // Kho key phải sống qua các lần render (một `useMemo` không có dependency),
  // nếu không thì mỗi lần render lại sinh một kho rỗng và luật 2 ở đầu file mất
  // tác dụng đúng lúc cần nhất: lần bấm lại sau một lỗi mạng.
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, cancelReason }: HuyLichInput) => {
      const payload: CancelBookingRequest = { cancelReason };
      // Payload vào `keyFor` để người dùng SỬA lý do rồi gửi lại thì được một
      // key mới: dùng lại key cũ với payload khác bị backend trả 409.
      return bookingRepo.cancelBooking(bookingId, payload, khoKhoa.keyFor(bookingId, payload));
    },
    onSuccess: (_data, { bookingId }) => {
      khoKhoa.release(bookingId);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.listsAll() });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
    },
  });
}

/**
 * Check-in một buổi mentoring (dùng ở phía mentor, màn `MentorBookings`).
 *
 * Bốn luật ở đầu file vẫn áp dụng; thêm ba điều riêng của thao tác này:
 *
 * 1. **Cờ `attendance.canCheckIn` của backend là NGUỒN SỰ THẬT để hiện nút**, chứ
 *    không phải `bookingStatus` hay giờ hiện tại của máy.
 *    `BookingResponseMapper` tính nó bằng `SessionAttendancePolicy.canCheckIn()`
 *    với giờ SERVER và trạng thái session, và nó còn thành `false` ngay sau khi
 *    người này đã check-in (`!currentUserCheckedIn`). Tự suy ra từ
 *    `selectedStartTime` so với `Date.now()` sẽ lệch với backend ở mọi máy lệch
 *    giờ, và sẽ hiện nút cho một buổi chưa có session (`checkIn()` trả 409
 *    "Booking chưa có session để check-in").
 *
 * 2. **Gửi lại là AN TOÀN, và backend tự chịu được.** `SessionAttendanceService.checkIn()`
 *    trả về booking nguyên trạng nếu đã có bản ghi điểm danh cho vai trò đó, kể
 *    cả khi session đã kết thúc. Cộng với `Idempotency-Key` ổn định theo
 *    `bookingId`, một lần bấm lại sau lỗi mạng không bao giờ tạo ra hai lần
 *    điểm danh.
 *
 * 3. **Invalidate CẢ `listsAll()` lẫn `countsAll()`.** Check-in đổi
 *    `attendance`, và `session.status` chuyển `SCHEDULED → IN_PROGRESS` — thứ
 *    làm `displayState` của backend thành `IN_SESSION`, tức là đổi cả NHÃN trên
 *    thẻ. Bỏ `countsAll()` thì dải nhắc việc ở màn Tổng quan sẽ đứng ở con số cũ.
 */
export function useCheckInBooking() {
  const queryClient = useQueryClient();
  // Kho key phải sống qua các lần render — xem lý do ở `useCancelBooking`.
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    // Không payload: `POST /api/me/bookings/{id}/check-in` không có thân request,
    // nên `keyFor` chỉ lấy `bookingId` — cùng một booking luôn cho cùng một key.
    mutationFn: ({ bookingId }: { bookingId: string }) =>
      bookingRepo.checkIn(bookingId, khoKhoa.keyFor(bookingId, null)),
    onSuccess: (_data, { bookingId }) => {
      khoKhoa.release(bookingId);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.listsAll() });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.countsAll() });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
      // Lịch dạy của mentor hiện trạng thái buổi trong từng slot.
      void queryClient.invalidateQueries({ queryKey: mentorModeKeys.slotsAll() });
    },
  });
}

/**
 * Làm mới sau khi MENTOR quyết định một booking (chấp nhận, từ chối, hoàn tất, huỷ).
 *
 * - Chi tiết: invalidate theo TIỀN TỐ `detail`, không chỉ booking vừa xử lý —
 *   chấp nhận một yêu cầu làm backend tự từ chối mọi yêu cầu PENDING khác của
 *   cùng slot (`MentorBookingController.acceptBooking`), nên chi tiết đã cache
 *   của chúng đang nói sai.
 * - Slot của mentor (`mentorModeKeys.slotsAll()`): slot được chốt/giải phóng.
 */
function lamMoiSauQuyetDinhMentor(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: bookingKeys.listsAll() });
  void queryClient.invalidateQueries({ queryKey: bookingKeys.countsAll() });
  void queryClient.invalidateQueries({ queryKey: [...bookingKeys.all, 'detail'] });
  void queryClient.invalidateQueries({ queryKey: mentorModeKeys.slotsAll() });
}

/** Mentor chấp nhận một yêu cầu đặt lịch */
export function useAcceptBooking() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, ...input }: AcceptBookingRequest & { bookingId: string }) =>
      bookingRepo.acceptBooking(bookingId, input, khoKhoa.keyFor(`accept-${bookingId}`, input)),
    onSuccess: (data, { bookingId }) => {
      khoKhoa.release(`accept-${bookingId}`);
      queryClient.setQueryData(bookingKeys.detail(bookingId), data);
      lamMoiSauQuyetDinhMentor(queryClient);
    },
  });
}

/** Mentor từ chối một yêu cầu đặt lịch */
export function useRejectBooking() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, ...input }: RejectBookingRequest & { bookingId: string }) =>
      bookingRepo.rejectBooking(bookingId, input, khoKhoa.keyFor(`reject-${bookingId}`, input)),
    onSuccess: (data, { bookingId }) => {
      khoKhoa.release(`reject-${bookingId}`);
      queryClient.setQueryData(bookingKeys.detail(bookingId), data);
      lamMoiSauQuyetDinhMentor(queryClient);
    },
  });
}

// ===========================================================================
// PHÍA MENTOR — hoàn tất và huỷ buổi đã xác nhận (`mentorBookingRepo.ts`).
// Giữ tách khỏi phần của mentee ở trên.
// ===========================================================================

/**
 * Mentor xác nhận buổi học đã diễn ra. Hiện nút theo cờ `canCompleteByMentor`
 * của backend, không tự suy từ giờ máy. Sau khi gửi, booking sang
 * `AWAITING_MENTEE_CONFIRMATION` — thẻ rời chip "Chờ bạn xác nhận".
 */
export function useCompleteBookingByMentor() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, ...input }: CompleteBookingRequest & { bookingId: string }) =>
      mentorBookingRepo.completeBooking(bookingId, input, khoKhoa.keyFor(`complete-${bookingId}`, input)),
    onSuccess: (data, { bookingId }) => {
      khoKhoa.release(`complete-${bookingId}`);
      queryClient.setQueryData(bookingKeys.detail(bookingId), data);
      lamMoiSauQuyetDinhMentor(queryClient);
    },
  });
}

/**
 * Mentor huỷ buổi đã xác nhận. Hiện nút theo cờ `canCancel` (backend tính theo
 * vai trò người xem). Không nút thử lại khi lỗi — backend chặn 3 lần huỷ/giờ.
 */
export function useCancelBookingByMentor() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, cancelReason }: CancelBookingRequest & { bookingId: string }) => {
      const payload: CancelBookingRequest = { cancelReason };
      return mentorBookingRepo.cancelBooking(bookingId, payload, khoKhoa.keyFor(`mentor-cancel-${bookingId}`, payload));
    },
    onSuccess: (data, { bookingId }) => {
      khoKhoa.release(`mentor-cancel-${bookingId}`);
      queryClient.setQueryData(bookingKeys.detail(bookingId), data);
      lamMoiSauQuyetDinhMentor(queryClient);
    },
  });
}

// ---------------------------------------------------------------------------
// Hành động của MENTEE sau buổi học (tách khối riêng để dễ gộp nhánh).
// Check-in của mentee dùng lại `useCheckInBooking` ở trên: cùng một endpoint
// phục vụ hai phía (`SessionAttendanceService` tự suy vai trò người gọi).
// ---------------------------------------------------------------------------

/**
 * Mentee xác nhận buổi học đã diễn ra ("Xác nhận đã học").
 *
 * Bốn luật ở đầu file vẫn áp dụng. Riêng thao tác này KHÔNG hoàn tác được —
 * booking thành `COMPLETED` và tiền được giải ngân cho mentor — nên màn hình
 * phải hỏi lại trước khi gọi. Key ổn định theo `bookingId` + ghi chú: bấm lại
 * sau lỗi mạng thì backend replay chứ không xác nhận hai lần.
 *
 * Invalidate cả `listsAll()` lẫn `countsAll()`: booking rời chip "Chờ bạn xác
 * nhận" sang "Đã hoàn thành".
 */
export function useConfirmBookingByMentee() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);

  return useMutation({
    networkMode: 'always',
    mutationFn: ({ bookingId, ...input }: ConfirmBookingRequest & { bookingId: string }) =>
      bookingRepo.confirmByMentee(bookingId, input, khoKhoa.keyFor(`confirm-${bookingId}`, input)),
    onSuccess: (data, { bookingId }) => {
      khoKhoa.release(`confirm-${bookingId}`);
      queryClient.setQueryData(bookingKeys.detail(bookingId), data);
      void queryClient.invalidateQueries({ queryKey: bookingKeys.listsAll() });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.countsAll() });
    },
  });
}
