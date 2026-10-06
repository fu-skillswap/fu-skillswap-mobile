/**
 * @file types.ts
 * @description Kiểu dữ liệu nhánh booking, khai theo ĐÚNG source Java của backend
 * (`modules/booking/`), không theo thiết kế và không theo trí nhớ.
 *
 * Nguồn: `dto/response/BookingResponse.java`, `dto/response/SessionAttendanceResponse.java`,
 * `dto/response/BookingCancellationRefundPolicyResponse.java`, các enum trong
 * `domain/`, và `dto/request/BookingListRequest.java` / `CancelBookingRequest.java`.
 *
 * ## Bốn điều phải biết trước khi sửa file này
 *
 * 1. **Mốc thời gian ở đây là `OffsetDateTime`, KHÔNG phải `LocalDateTime`.**
 *    Mọi trường thời gian của `BookingResponse.java` khai `java.time.OffsetDateTime`
 *    và được dựng bằng `BookingTime.toOffsetDateTime()` =
 *    `value.atZone(Asia/Ho_Chi_Minh).toOffsetDateTime()`. Lên dây chúng CÓ offset:
 *    `"2026-10-04T20:30:00+07:00"`. Dùng `core/time/offsetDateTime.ts`, KHÔNG dùng
 *    `core/time/localDateTime.ts` — hàm của file kia cố ý trả `null` cho chuỗi có
 *    offset, nên đọc trượt sẽ ra một màn hình không in được ngày nào.
 *
 * 2. **Nguyên thuỷ vs đóng hộp, và một chỗ `@Schema` nói sai.** Mọi cờ `can*` của
 *    `BookingResponse` là `boolean` nguyên thuỷ nên không-null. Trong
 *    `SessionAttendanceResponse`, `currentUserCheckedIn` và `canCheckIn` cũng là
 *    `boolean` NGUYÊN THUỶ dù annotation ghi `nullable = true` — annotation sai,
 *    kiểu Java mới là sự thật, nên hai trường đó khai không-null ở đây.
 *    Ngược lại `maintainPostSessionChatSnapshot` khai `Boolean` (đóng hộp) mà
 *    KHÔNG có `nullable = true`; mapper luôn gán từ `booking.isMaintain...()`
 *    nguyên thuỷ nên thực tế không bao giờ null.
 *
 * 3. **Vài trường `@Schema` không ghi `nullable` nhưng mapper vẫn gán `null`.**
 *    `mentorDisplayName`/`menteeDisplayName` (`user == null ? null : fullName()`),
 *    `availabilitySlotId` (`slot == null ? null : slot.getId()`),
 *    `selectedStartTime`/`selectedEndTime` (`toOffsetDateTime(startUtc)` với
 *    `startUtc` có thể null khi slot gốc đã bị xoá). Khai nullable theo MAPPER,
 *    không theo annotation — annotation là tài liệu, mapper là code chạy.
 *
 * 4. **`BookingResponse` KHÔNG có `@JsonIgnore` nào** (đã kiểm từng trường), nên
 *    khác `MentorDiscoveryCardResponse`: ở đây mọi trường đều phẳng và đều có
 *    trong JSON, kể cả trường `null` — backend không bật
 *    `default-property-inclusion: non_null`.
 */

/**
 * Trạng thái booking LEGACY (`domain/BookingStatus.java`).
 *
 * Vẫn phải khai vì nó là giá trị DUY NHẤT mà `GET /api/me/bookings?status=` nhận
 * (xem `BookingListRequest.status`) — bộ lọc server-side đi theo enum legacy này,
 * không đi theo `BookingLifecycleStatus`.
 */
export type BookingStatus =
  | 'PENDING'
  | 'ACCEPTED_AWAITING_PAYMENT'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED_BY_MENTEE'
  | 'CANCELLED_BY_MENTOR'
  | 'AWAITING_MENTOR_COMPLETION'
  | 'AWAITING_MENTEE_CONFIRMATION'
  | 'COMPLETED'
  | 'UNDER_REVIEW';

/**
 * Trạng thái vòng đời CHUẨN (`domain/BookingLifecycleStatus.java`) — thứ màn hình
 * phải đọc để chọn nhãn. `BookingStateMapper.toLifecycleStatus()` gộp
 * `PAID`/`AWAITING_MENTOR_COMPLETION`/`AWAITING_MENTEE_CONFIRMATION` thành
 * `CONFIRMED`, và tách `EXPIRED` thành `REQUEST_EXPIRED`/`PAYMENT_EXPIRED`.
 */
export type BookingLifecycleStatus =
  | 'REQUESTED'
  | 'WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'REJECTED_BY_MENTOR'
  | 'CANCELED_BY_MENTEE'
  | 'CANCELED_BY_MENTOR'
  | 'REQUEST_EXPIRED'
  | 'PAYMENT_EXPIRED'
  | 'UNDER_REVIEW'
  | 'COMPLETED';

/** `domain/BookingPaymentStatus.java` */
export type BookingPaymentStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

/** `domain/BookingSettlementStatus.java` */
export type BookingSettlementStatus = 'HELD' | 'RELEASED' | 'PARTIALLY_SETTLED' | 'REFUNDED';

/**
 * Nhóm hiển thị do backend tự suy ra (`domain/BookingDisplayState.java`).
 *
 * Đây là NGUỒN DUY NHẤT cho "Đang diễn ra": `IN_SESSION` không phải một
 * `BookingStatus` nào cả, nó do `BookingResponseMapper.deriveDisplayGuidance()`
 * tính từ `selectedStartTime`/`selectedEndTime` so với giờ server.
 */
export type BookingDisplayState =
  | 'PENDING_MENTOR_RESPONSE'
  | 'PAYMENT_REQUIRED'
  | 'MENTOR_ACTION_REQUIRED'
  | 'UPCOMING'
  | 'IN_SESSION'
  | 'WAITING_CONFIRMATION'
  | 'UNDER_REVIEW'
  | 'FEEDBACK_REQUIRED'
  | 'COMPLETED'
  | 'CANCELED_OR_EXPIRED';

/** `domain/BookingNextAction.java` */
export type BookingNextAction =
  | 'NONE'
  | 'PAY_NOW'
  | 'ACCEPT_OR_REJECT'
  | 'JOIN_SESSION'
  | 'COMPLETE_SESSION'
  | 'CONFIRM_SESSION'
  | 'LEAVE_FEEDBACK'
  | 'VIEW_ISSUE';

/**
 * Kết quả đóng booking (`domain/BookingCompletionOutcome.java`).
 *
 * `NO_SHOW_MENTEE`/`NO_SHOW_MENTOR` là NGUỒN DUY NHẤT cho nhãn "Vắng mặt" —
 * không có `BookingStatus` nào mang nghĩa đó.
 */
export type BookingCompletionOutcome =
  | 'USER_CONFIRMED'
  | 'AUTO_CLOSED'
  | 'UNDER_REVIEW'
  | 'NO_SHOW_MENTEE'
  | 'NO_SHOW_MENTOR'
  | 'PARTIALLY_SETTLED'
  | 'ADMIN_SLA_AUTO_RELEASED';

/** `domain/BookingDisputeSlaStatus.java` */
export type BookingDisputeSlaStatus =
  | 'WAITING_COUNTERPARTY'
  | 'WAITING_ADMIN'
  | 'ADMIN_SLA_OVERDUE'
  | 'RESOLVED';

/** `domain/BookingIssueType.java`; `NO_SHOW_OR_QUALITY_OR_OTHER` là giá trị legacy */
export type BookingIssueType =
  | 'MENTOR_NO_SHOW'
  | 'MENTEE_NO_SHOW'
  | 'QUALITY_ISSUE'
  | 'TECHNICAL_PROBLEM'
  | 'OTHER'
  | 'NO_SHOW_OR_QUALITY_OR_OTHER';

/** `domain/MeetingPlatform.java` */
export type MeetingPlatform =
  | 'GOOGLE_MEET'
  | 'ZOOM'
  | 'MICROSOFT_TEAMS'
  | 'DISCORD'
  | 'OFFLINE'
  | 'OTHER';

/** `domain/SessionStatus.java` */
export type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** `domain/SessionAttendanceSummary.java` */
export type SessionAttendanceSummary = 'NONE' | 'MENTOR_ONLY' | 'MENTEE_ONLY' | 'BOTH';

/** `domain/AdminBookingIssueResolutionAction.java` */
export type AdminBookingIssueResolutionAction =
  | 'CONFIRM_SESSION'
  | 'RELEASE_AS_IS'
  | 'PARTIAL_SETTLEMENT'
  | 'CONFIRM_MENTOR_NO_SHOW_REFUND'
  | 'CONFIRM_MENTEE_NO_SHOW_RELEASE';

/** `domain/AdminBookingIssueResolutionReasonCode.java` */
export type AdminBookingIssueResolutionReasonCode =
  | 'SESSION_CONFIRMED'
  | 'NO_SHOW_CONFIRMED'
  | 'EVIDENCE_INSUFFICIENT'
  | 'QUALITY_PARTIAL_COMPENSATION'
  | 'TECHNICAL_PARTIAL_COMPENSATION'
  | 'OTHER';

/**
 * `dto/response/SessionAttendanceResponse.java` — bằng chứng check-in của hai bên.
 *
 * `currentUserCheckedIn` và `canCheckIn` là `boolean` NGUYÊN THUỶ trong Java nên
 * không-null, dù `@Schema` của chúng ghi `nullable = true`. Annotation đó sai.
 */
export interface SessionAttendanceResponse {
  mentorCheckedInAt: string | null;
  menteeCheckedInAt: string | null;
  summary: SessionAttendanceSummary;
  currentUserCheckedIn: boolean;
  canCheckIn: boolean;
  checkInOpensAt: string | null;
  checkInClosesAt: string | null;
}

/**
 * `dto/response/BookingCancellationRefundPolicyResponse.java` — toàn bộ là `int`
 * nguyên thuỷ nên không trường nào null.
 */
export interface BookingCancellationRefundPolicyResponse {
  earlyMenteeCancellationDeadlineMinutes: number;
  earlyMenteeRefundPercent: number;
  lateMenteeRefundPercent: number;
  lateMentorSharePercent: number;
  latePlatformSharePercent: number;
  mentorCancellationRefundPercent: number;
  mentorNoShowRefundPercent: number;
}

/**
 * `dto/response/BookingResponse.java`, giữ nguyên thứ tự trường của record Java
 * để đối chiếu được từng dòng.
 */
export interface BookingResponse {
  bookingId: string;
  /** @deprecated Alias legacy, mapper gán bằng `bookingId` */
  sessionId: string | null;
  /** @deprecated Alias legacy của `BookingStatus` */
  sessionStatus: BookingStatus | null;
  actualSessionId: string | null;
  actualSessionStatus: SessionStatus | null;
  mentorUserId: string;
  /** `null` khi mapper không tra được user của mentor */
  mentorDisplayName: string | null;
  mentorAvatarUrl: string | null;
  menteeUserId: string;
  /** `null` khi mapper không tra được user của mentee */
  menteeDisplayName: string | null;
  menteeAvatarUrl: string | null;
  /** `null` khi slot gốc đã bị xoá */
  availabilitySlotId: string | null;
  serviceId: string | null;
  serviceTitle: string | null;
  serviceDescriptionSnapshot: string | null;
  serviceExpectedOutcomeSnapshot: string | null;
  serviceDurationSnapshot: number | null;
  serviceIsFreeSnapshot: boolean | null;
  servicePriceScoinSnapshot: number | null;
  /** `Boolean` đóng hộp nhưng mapper luôn gán từ một `boolean` nguyên thuỷ */
  maintainPostSessionChatSnapshot: boolean;
  servicePriceWithSurchargeScoin: number | null;
  /** @deprecated FE phải dùng `bookingStatus` */
  status: BookingStatus;
  bookingStatus: BookingLifecycleStatus;
  paymentStatus: BookingPaymentStatus;
  settlementStatus: BookingSettlementStatus | null;
  releasedAt: string | null;
  refundedAt: string | null;
  refundedScoin: number | null;
  refundReason: string | null;
  learningGoalTitle: string;
  learningGoalDescription: string | null;
  mentorResponseNote: string | null;
  rejectReason: string | null;
  cancelReason: string | null;
  meetingPlatform: MeetingPlatform | null;
  meetingLink: string | null;
  calendarSyncStatus: string | null;
  calendarSyncErrorCode: string | null;
  calendarSyncErrorMessage: string | null;
  googleMeetAutoGenerated: boolean | null;
  googleCalendarManaged: boolean | null;
  location: string | null;
  /** `null` khi backend không giải được slot của booking — giao diện phải chịu được */
  selectedStartTime: string | null;
  selectedEndTime: string | null;
  reviewDeadlineAt: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  attendance: SessionAttendanceResponse;
  acceptedAt: string | null;
  pendingExpireAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  finalizedAt: string | null;
  autoClosedAt: string | null;
  completionOutcome: BookingCompletionOutcome | null;
  issueSubmittedAt: string | null;
  issueResponseDeadlineAt: string | null;
  issueType: BookingIssueType | null;
  issueDescription: string | null;
  issueRespondedAt: string | null;
  issueRespondedByUserId: string | null;
  issueResponseNote: string | null;
  issueResolvedAt: string | null;
  issueAdminEscalatedAt: string | null;
  issueAdminResolutionDeadlineAt: string | null;
  issueAdminSlaOverdueAt: string | null;
  issueAdminSlaReminderCount: number | null;
  issueAutoReleaseAt: string | null;
  disputeSlaStatus: BookingDisputeSlaStatus | null;
  issueResolvedByUserId: string | null;
  issueResolutionNote: string | null;
  issueResolutionAction: AdminBookingIssueResolutionAction | null;
  issueResolutionReasonCode: AdminBookingIssueResolutionReasonCode | null;
  issueResolutionMenteeRefundScoin: number | null;
  issueResolutionMentorSettlementScoin: number | null;
  issueResolutionPlatformSettlementScoin: number | null;
  mentorNote: string | null;
  menteeNote: string | null;
  createdAt: string;
  updatedAt: string;
  conversationId: string | null;
  canCancel: boolean;
  /** @deprecated Dùng `canCompleteByMentor` hoặc `canConfirmByMentee` */
  canComplete: boolean;
  canPay: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCompleteByMentor: boolean;
  canConfirmByMentee: boolean;
  canJoin: boolean;
  canReportIssue: boolean;
  canRespondIssue: boolean;
  joinAvailableAt: string | null;
  joinClosesAt: string | null;
  canSubmitFeedback: boolean;
  cancellationRefundPolicy: BookingCancellationRefundPolicyResponse;
  displayState: BookingDisplayState;
  nextAction: BookingNextAction | null;
  actionDeadlineAt: string | null;
}

/** `dto/BookingViewRole.java` */
export type BookingViewRole = 'MENTEE' | 'MENTOR';

/** `dto/request/CancelBookingRequest.java`; `cancelReason` là `@NotBlank` tối đa 1000 ký tự */
export interface CancelBookingRequest {
  cancelReason: string;
}

/** Giới hạn `@Size(max = 1000)` của `CancelBookingRequest.cancelReason` */
export const LY_DO_HUY_TOI_DA = 1000;

/**
 * Payload `POST /api/me/bookings/{id}/confirm` (`ConfirmBookingRequest.java`).
 * Backend nhận thân rỗng (`@RequestBody(required = false)`); ghi chú tối đa 2000
 * ký tự và được lưu thành `menteeNote`.
 */
export interface ConfirmBookingRequest {
  confirmationNote?: string | null;
}

// ---------------------------------------------------------------------------
// Luồng đặt lịch: lịch rảnh → candidate → báo giá → tạo booking
// ---------------------------------------------------------------------------

/** `mentor/dto/response/SlotMutationCapabilityResponse.java` — chỉ dùng phía mentor */
export interface SlotMutationCapabilityResponse {
  mode: 'ALLOWED' | 'REQUIRES_PENDING_REJECTION' | 'BLOCKED_BY_LOCKING_BOOKING';
  restrictionCode: string | null;
  affectedPendingBookingCount: number;
}

/** `mentor/dto/response/AvailabilitySlotServiceBasicResponse.java` */
export interface AvailabilitySlotServiceBasicResponse {
  serviceId: string;
  title: string;
  durationMinutes: number;
  isFree: boolean;
  /** `Integer` đóng hộp phía Java — dịch vụ miễn phí có thể mang `null` */
  priceScoin: number | null;
  bindingRemoval: SlotMutationCapabilityResponse | null;
}

/**
 * `mentor/dto/response/MentorAvailabilitySlotResponse.java` — parent slot.
 *
 * `startTime`/`endTime` là `LocalDateTime` (KHÔNG offset), giờ Việt Nam. Đọc bằng
 * `core/time/localDateTime.ts`. Các field legacy (`durationMinutes`,
 * `teachingMode`, `maxPendingRequests`, `remainingRequestSlots`) cố ý không khai:
 * backend đánh `deprecated`, màn hình mới không được dựa vào chúng.
 */
export interface MentorAvailabilitySlotResponse {
  slotId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  pendingRequestCount: number;
  acceptedSlotCount: number;
  services: AvailabilitySlotServiceBasicResponse[];
}

/**
 * `mentor/dto/response/ServiceSlotCandidateItemResponse.java` — một khung giờ
 * chính xác của một dịch vụ.
 *
 * Hai cặp giờ song song: `startTime`/`endTime` là `LocalDateTime` để HIỂN THỊ,
 * `startAt`/`endAt` là `Instant` UTC để GỬI LÊN (`POST /api/bookings/quote` và
 * `POST /api/bookings`). Đừng tự dựng `startAt` từ giờ hiển thị.
 */
export interface ServiceSlotCandidateItemResponse {
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  pendingCount: number;
  remainingPendingQuota: number;
  /** Chỉ cho chọn khi `true` */
  isSelectable: boolean;
  reasonIfBlocked: string | null;
  blockedByAcceptedBooking: boolean;
  blockingBookingId: string | null;
  blockingServiceId: string | null;
  blockingServiceTitle: string | null;
  blockedBySameService: boolean;
  blockedByDifferentService: boolean;
  bookingConflictNote: string | null;
}

/** `mentor/dto/response/ServiceSlotCandidatesResponse.java` */
export interface ServiceSlotCandidatesResponse {
  slotId: string;
  serviceId: string;
  serviceDurationMinutes: number;
  candidateServiceSlots: ServiceSlotCandidateItemResponse[];
}

/** `booking/dto/request/BookingQuoteRequest.java` */
export interface BookingQuoteRequest {
  slotId: string;
  serviceId: string;
  /** Lấy NGUYÊN `candidate.startAt` */
  startAt: string;
}

/** `booking/port/BookingPricingEstimate.java` */
export interface BookingPricingEstimate {
  pricingVersion: string;
  calculatedAt: string;
  serviceId: string;
  priceScoin: number | null;
  priceBeforeCampaignScoin: number | null;
  campaignDiscountScoin: number | null;
  estimatedPayableScoin: number | null;
  campaignName: string | null;
  isEstimate: boolean;
  disclaimer: string | null;
}

/**
 * `booking/dto/response/BookingQuoteResponse.java` — báo giá, CHƯA giữ chỗ.
 *
 * `scheduledStartAt`/`scheduledEndAt`/`pendingExpireAt` là `OffsetDateTime`, lên
 * dây CÓ offset. Đọc bằng `core/time/offsetDateTime.ts`.
 */
export interface BookingQuoteResponse {
  slotId: string;
  serviceId: string;
  serviceTitle: string;
  durationMinutes: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  pendingExpireAt: string | null;
  paymentWindowMinutes: number;
  paymentPreparationBufferMinutes: number;
  pricing: BookingPricingEstimate;
  cancellationRefundPolicy: BookingCancellationRefundPolicyResponse;
  isEstimate: boolean;
  disclaimer: string | null;
}

/** `booking/dto/request/CreateBookingRequest.java` */
export interface CreateBookingRequest {
  slotId: string;
  serviceId: string;
  startAt: string;
  /** `@NotBlank`, tối đa 200 ký tự */
  learningGoalTitle: string;
  /** Tối đa 2000 ký tự, có thể bỏ */
  learningGoalDescription?: string;
}

/** Giới hạn `@Size(max = 200)` của `CreateBookingRequest.learningGoalTitle` */
export const MUC_TIEU_TIEU_DE_TOI_DA = 200;

/** Giới hạn `@Size(max = 2000)` của `CreateBookingRequest.learningGoalDescription` */
export const MUC_TIEU_MO_TA_TOI_DA = 2000;

// ---------------------------------------------------------------------------
// Mentor xử lý yêu cầu đặt lịch
// ---------------------------------------------------------------------------

/**
 * `dto/request/AcceptBookingRequest.java`.
 *
 * Khi mentor CHƯA kết nối Google Calendar thì `meetingPlatform` là bắt buộc, và
 * kèm `meetingLink` (hoặc `location` khi `OFFLINE`) —
 * `BookingDecisionService.acceptBooking()`. Đã kết nối thì để trống được, Google
 * Meet tự tạo.
 */
export interface AcceptBookingRequest {
  mentorResponseNote?: string | null;
  meetingPlatform?: MeetingPlatform | null;
  meetingLink?: string | null;
  location?: string | null;
}

/** `dto/request/RejectBookingRequest.java`; `rejectReason` là `@NotBlank` ≤ 2000 */
export interface RejectBookingRequest {
  rejectReason: string;
  mentorResponseNote?: string | null;
}

/** `@Size(max = 1000)` của `meetingLink`, `@Size(max = 500)` của `location` */
export const LINK_PHONG_HOC_TOI_DA = 1000;
export const DIA_DIEM_TOI_DA = 500;
export const LY_DO_TU_CHOI_TOI_DA = 2000;

/**
 * `dto/request/CompleteBookingRequest.java` — mentor xác nhận hoàn tất. Thân
 * request tuỳ chọn; `completionNote` ≤ 2000 ký tự, chỉ dùng cho lịch sử nội bộ.
 */
export interface CompleteBookingRequest {
  completionNote?: string | null;
}
