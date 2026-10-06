/**
 * @file bookingRepo.ts
 * @description Toàn bộ lời gọi `/api/me/bookings/*`. Không React, không state.
 *
 * Nguồn: `modules/booking/controller/MyBookingController.java`. Mọi endpoint ở
 * nhóm này BẮT BUỘC đăng nhập (`ensureAuthenticated(principal)` ném
 * `UNAUTHENTICATED` khi thiếu principal) — tab Lịch hẹn nằm sau gate của
 * `(tabs)` nên luôn có token, nhưng đừng dựa vào điều đó ở tầng này.
 *
 * ## Hai đặc tính của `GET /api/me/bookings` dễ hiểu sai
 *
 * 1. **`status` nhận MỘT giá trị `BookingStatus` LEGACY**, không nhận
 *    `BookingLifecycleStatus` và không nhận danh sách. Vì vậy một tab giao diện
 *    muốn gộp hai trạng thái (ví dụ "Đã hủy" = mentee hủy + mentor hủy) KHÔNG
 *    làm được bằng một request — xem JSDoc của `MyBookingsScreen`.
 * 2. **Không truyền `status` là một endpoint KHÁC HẲN về ngữ nghĩa**:
 *    `BookingQueryService.getMyBookings()` trả "dashboard" từ 7 ngày trước đến 90
 *    ngày tới, xếp theo việc-cần-làm rồi tới lịch gần nhất, và **bỏ qua
 *    `sortBy`/`direction`** (`bookingPriorityPageable()` dựng `PageRequest.of(page,
 *    size)` không kèm `Sort`). Có `status` thì trả toàn bộ lịch sử của trạng thái
 *    đó, không giới hạn ngày, và lúc đó mới tôn trọng `sortBy`.
 *    Vì vậy repo này KHÔNG gửi `sortBy` — một tham số chỉ có tác dụng ở một nửa
 *    số tab là cái bẫy chờ người sau.
 *
 * ## `role=MENTOR` đi qua ĐÚNG endpoint này, không qua `/api/mentor/bookings`
 *
 * `MentorBookingController` (`/api/mentor/bookings`) **không có endpoint GET nào**
 * — chỉ `accept`, `reject`, `cancel`, `complete`, `meeting-link`. Danh sách
 * booking nhìn từ phía mentor là `GET /api/me/bookings?role=MENTOR`
 * (`BookingListRequest.role`, rồi `case MENTOR` trong
 * `BookingQueryService.getMyBookings`). Hai góc nhìn chạy cùng một hàm, cùng cách
 * phân trang, cùng ngữ nghĩa "không có status = dashboard" — chỉ khác bộ trạng
 * thái ưu tiên (`MENTOR_PRIMARY_ACTION_STATUSES` thay cho bản của mentee).
 */

import { apiClient } from '@/core/api/client';
import { idempotencyHeaders } from '@/core/api/idempotency';
import type { PageResponse } from '@/core/api/pagination';
import type {
  AcceptBookingRequest,
  BookingQuoteRequest,
  BookingQuoteResponse,
  BookingResponse,
  BookingStatus,
  BookingViewRole,
  CancelBookingRequest,
  ConfirmBookingRequest,
  CreateBookingRequest,
  MentorAvailabilitySlotResponse,
  RejectBookingRequest,
  ServiceSlotCandidatesResponse,
} from '@/features/booking/types';

/** Tham số của `GET /api/me/bookings` (`dto/request/BookingListRequest.java`) */
export interface BookingListParams {
  page?: number;
  size?: number;
  /** Mặc định của backend là `MENTEE`; repo vẫn gửi tường minh */
  role?: BookingViewRole;
  /** Bỏ trống = chế độ dashboard 7 ngày trước → 90 ngày tới */
  status?: BookingStatus;
}

/**
 * Bộ lọc mà MÀN HÌNH được phép truyền cho `useMyBookings`.
 *
 * `page` bị loại khỏi kiểu có chủ ý — cùng lý do đã ghi ở `BoLocTimMentor` của
 * `features/mentor/mentorRepo.ts`: số trang do `useInfiniteQuery` quản qua
 * `pageParam`, nên một `page` lọt vào bộ lọc vừa nhiễm vào khoá cache vừa có
 * nguy cơ ghi đè `pageParam` và làm MỌI trang xin đúng một số trang.
 */
export type BoLocLichHen = Omit<BookingListParams, 'page'>;

/**
 * Bỏ các tham số rỗng thay vì gửi chuỗi trống.
 *
 * Lọc theo `undefined` và chuỗi rỗng, KHÔNG theo tính truthy: `page: 0` là trang
 * đầu và phải được gửi đi. Bản riêng cho nhánh booking, giống `forumRepo` và
 * `mentorRepo` — ba nhánh có thể lệch nhau về sau.
 */
function cleanParams(params: Record<string, string | number | boolean | undefined>) {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export const bookingRepo = {
  /** Danh sách booking theo góc nhìn của user hiện tại */
  getMyBookings(params: BookingListParams) {
    return apiClient<PageResponse<BookingResponse>>('/api/me/bookings', {
      params: cleanParams({ role: 'MENTEE', ...params }),
    });
  },

  /**
   * Mentee hủy một booking của mình.
   *
   * `Idempotency-Key` là BẮT BUỘC, không phải tuỳ chọn: endpoint mang
   * `@Idempotent`, và `IdempotencyAspect.normalizeKey()` ném
   * `BaseException(BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED")` ngay khi header
   * thiếu hoặc không khớp `[A-Za-z0-9._~-]{1,100}`. Thiếu nó thì mọi lần hủy đều
   * nhận 400 — và 400 đó KHÔNG nói gì về lý do hủy, nên rất dễ bị đọc thành
   * "backend yêu cầu lý do khác".
   *
   * Key do CHỖ GỌI truyền vào (`useCancelBooking` giữ nó trong
   * `createIdempotencyStore`), chứ không sinh tại đây: retry sau lỗi mạng phải
   * dùng lại ĐÚNG key cũ để backend replay kết quả đã commit, mà repo này không
   * có chỗ nào để nhớ.
   */
  cancelBooking(bookingId: string, input: CancelBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/me/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },

  /**
   * Check-in một buổi mentoring. Dùng được cho CẢ mentor và mentee.
   *
   * `POST /api/me/bookings/{id}/check-in` — không ở nhánh `/api/mentor/` dù đây
   * là hành động mentor dùng nhiều nhất: `SessionAttendanceService.checkIn()`
   * tự suy vai trò người gọi bằng `resolveParticipantRole(booking, currentUserId)`,
   * nên cùng một endpoint phục vụ hai phía.
   *
   * **Không có thân request.** Đây là điểm khác biệt quan trọng so với
   * `accept`: `AcceptBookingRequest` đòi `meetingPlatform` (+ link hoặc địa
   * điểm) khi mentor chưa kết nối Google Calendar, còn check-in không đòi gì cả
   * — nên nó là hành động một-cú-bấm duy nhất của mentor mà giao diện dựng được
   * mà chắc chắn không 400.
   *
   * `Idempotency-Key` là BẮT BUỘC (endpoint mang `@Idempotent`;
   * `IdempotencyAspect.normalizeKey()` ném `BAD_REQUEST /
   * "IDEMPOTENCY_KEY_REQUIRED"` khi thiếu hoặc sai khuôn). Backend còn tự chịu
   * được việc gửi lại: `checkIn()` trả về booking nguyên trạng nếu đã có bản
   * ghi điểm danh cho vai trò đó, kể cả khi session đã kết thúc.
   *
   * Key do CHỖ GỌI truyền vào, không sinh tại đây — cùng lý do như
   * `cancelBooking`.
   */
  checkIn(bookingId: string, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/me/bookings/${bookingId}/check-in`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
    });
  },

  // -------------------------------------------------------------------------
  // Hành động của MENTEE sau buổi học (tách khối riêng để dễ gộp nhánh)
  // -------------------------------------------------------------------------

  /**
   * Mentee xác nhận buổi mentoring đã diễn ra
   * (`MyBookingController.confirmBooking`).
   *
   * KHÔNG hoàn tác được: `BookingCompletionService.confirmBookingByParticipant`
   * chuyển booking sang `COMPLETED` và gọi `requestBookingRelease` — giải ngân
   * cho mentor. Chỉ hợp lệ khi booking ở `AWAITING_MENTEE_CONFIRMATION` hoặc
   * `AWAITING_MENTOR_COMPLETION` và còn trong 24 giờ sau giờ kết thúc; giao diện
   * dựa vào cờ `canConfirmByMentee` của backend, không tự suy.
   *
   * `Idempotency-Key` BẮT BUỘC (`@Idempotent`). Đã xác nhận rồi thì backend trả
   * booking nguyên trạng, nên gửi lại sau lỗi mạng là an toàn.
   */
  confirmByMentee(bookingId: string, input: ConfirmBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/me/bookings/${bookingId}/confirm`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },

  /**
   * Parent slot đang mở của một mentor trong khoảng ngày (cần đăng nhập).
   * `fromDate`/`toDate` là `LocalDate` `"2026-10-05"`; bỏ trống thì backend tự lấy
   * thứ Hai tuần này tới Chủ nhật tuần sau.
   */
  getAvailabilitySlots(mentorUserId: string, fromDate: string, toDate: string) {
    return apiClient<MentorAvailabilitySlotResponse[]>(
      `/api/mentors/${mentorUserId}/availability-slots`,
      { params: cleanParams({ fromDate, toDate }) },
    );
  },

  /** Khung giờ chính xác của MỘT dịch vụ trong MỘT parent slot */
  getSlotCandidates(mentorUserId: string, slotId: string, serviceId: string) {
    return apiClient<ServiceSlotCandidatesResponse>(
      `/api/mentors/${mentorUserId}/availability-slots/${slotId}/candidates`,
      { params: { serviceId } },
    );
  },

  /** Báo giá tạm tính — POST nhưng chỉ đọc, KHÔNG giữ chỗ và không cần Idempotency-Key */
  quoteBooking(input: BookingQuoteRequest) {
    return apiClient<BookingQuoteResponse>('/api/bookings/quote', {
      method: 'POST',
      body: input,
    });
  },

  /** Tạo yêu cầu đặt lịch. Backend bắt buộc `Idempotency-Key`. */
  createBooking(input: CreateBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>('/api/bookings', {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },

  /** Chi tiết một booking — người gọi phải là mentee HOẶC mentor của nó */
  getBooking(bookingId: string) {
    return apiClient<BookingResponse>(`/api/me/bookings/${bookingId}`);
  },

  /** Mentor chấp nhận yêu cầu (`MentorBookingController`, có `@Idempotent`) */
  acceptBooking(bookingId: string, input: AcceptBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/mentor/bookings/${bookingId}/accept`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },

  /** Mentor từ chối yêu cầu kèm lý do */
  rejectBooking(bookingId: string, input: RejectBookingRequest, idempotencyKey: string) {
    return apiClient<BookingResponse>(`/api/mentor/bookings/${bookingId}/reject`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
      body: input,
    });
  },
};
