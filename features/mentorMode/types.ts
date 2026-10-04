/**
 * @file types.ts
 * @description Kiểu dữ liệu của CHẾ ĐỘ MENTOR (hồ sơ mentor của chính mình + ví
 * settlement), khai theo ĐÚNG source Java, không theo thiết kế và không theo trí
 * nhớ.
 *
 * Nguồn: `modules/mentor/dto/response/MentorProfileResponse.java` cùng ba DTO
 * lồng của nó, `modules/mentor/service/MentorProfileService.java` (mapper),
 * `modules/mentor/domain/MentorStatus.java`,
 * `modules/payment/dto/response/MentorWalletResponse.java`,
 * `modules/payment/dto/response/WalletTransactionResponse.java`,
 * `modules/payment/service/WalletQueryService.java` và
 * `modules/payment/service/SettlementService.java`.
 *
 * ## Bốn điều phải biết trước khi sửa file này
 *
 * 1. **HAI khuôn mốc thời gian nằm cạnh nhau trong cùng một feature.**
 *    `MentorProfileResponse` dùng `java.time.LocalDateTime` → lên dây KHÔNG có
 *    offset (`"2026-06-27T10:00:00"`), đọc bằng `core/time/localDateTime.ts`.
 *    `WalletTransactionResponse.createdAt` dùng `java.time.OffsetDateTime` dựng
 *    bởi `BusinessTime.toOffsetDateTime()` → lên dây CÓ offset
 *    (`"2026-08-24T19:00:00+07:00"`), đọc bằng `core/time/offsetDateTime.ts`.
 *    Đưa chuỗi của bên này vào helper của bên kia trả `null` và màn hình không
 *    in được mốc nào. Đừng gộp hai helper.
 *    `MentorAchievementResponse.achievedAt` lại là `java.time.LocalDate` — chỉ
 *    có ngày, KHÔNG có giờ (`"2025-06-01"`), nên `docLocalDateTime()` cũng từ
 *    chối nó.
 *
 * 2. **Nguyên thuỷ vs đóng hộp — và hai chỗ annotation nói ngược mapper.**
 *    `MentorWalletResponse.availableScoin` khai `Integer` (đóng hộp, trông như
 *    nullable) nhưng `WalletQueryService` gán từ
 *    `SettlementService.getMentorAvailableSettlement()` trả `int` NGUYÊN THUỶ,
 *    nên nó không bao giờ null. `MentorProfileResponse.isAvailable` cũng khai
 *    `Boolean` mà mapper gán từ `profile.isAvailable()` nguyên thuỷ (và
 *    `empty()` gán `true`), nên cũng không null. Hai trường này khai không-null
 *    ở đây — cùng lý do như `maintainPostSessionChatSnapshot` của nhánh booking.
 *
 * 3. **`exists: false` làm GẦN NHƯ MỌI trường thành `null`.**
 *    `MentorProfileResponse.empty(userId)` chỉ điền `exists`,
 *    `requiredFieldsCompleted`, `userId`, `isAvailable`, ba trường policy và ba
 *    danh sách rỗng. Tất cả còn lại — kể cả `mentorStatus`, `displayName`,
 *    `createdAt`, `updatedAt` — là `null`. Vì vậy `mentorStatus` KHÔNG được khai
 *    không-null dù enum trông như bắt buộc: đọc trượt sẽ cho `undefined` mà
 *    không có lỗi kiểu nào chặn.
 *
 * 4. **Ba trường policy thì LUÔN có giá trị** dù khai `Integer`/`String`:
 *    `MentorBookingPolicySnapshot.from()` thay mọi `null` bằng mặc định
 *    (`DEFAULT_LEAD_TIME_MINUTES`, `DEFAULT_HORIZON_DAYS`, `ZONE_HCM`), và
 *    `empty()` cũng điền sẵn. Khai không-null.
 *
 * Không trường nào trong hai DTO này mang `@JsonIgnore` (đã kiểm từng trường),
 * nên khác `MentorDiscoveryCardResponse`: ở đây mọi thứ đều phẳng và đều có
 * trong JSON, kể cả trường `null`.
 */

/**
 * `modules/mentor/domain/MentorStatus.java`.
 *
 * Chỉ `ACTIVE` mới hiện được trên discovery: `MentorDiscoveryService.isDiscoverableMentor()`
 * đòi `status == ACTIVE`, nên `GET /api/mentors/{userId}` trả **404** cho mọi
 * trạng thái khác. Đó là lý do màn `MentorMore` chỉ dựng lối "Xem hồ sơ công
 * khai" khi trạng thái là `ACTIVE`.
 */
export type MentorStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'SUSPENDED';

/** `dto/response/MentorSubjectResultResponse.java`; `scoreValue` là `BigDecimal` */
export interface MentorSubjectResultResponse {
  id: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  scoreValue: number | null;
  displayOrder: number | null;
}

/** `dto/response/MentorFeaturedProjectResponse.java`; mốc thời gian là `LocalDateTime` */
export interface MentorFeaturedProjectResponse {
  id: string | null;
  title: string | null;
  pictureUrl: string | null;
  content: string | null;
  projectDescription: string | null;
  liveDemoUrl: string | null;
  displayOrder: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * `dto/response/MentorAchievementResponse.java`.
 *
 * `achievedAt` là `java.time.LocalDate` — chỉ `"2025-06-01"`, không có phần giờ,
 * nên nó KHÔNG đọc được bằng `docLocalDateTime()` (khuôn của hàm đó đòi `T` và
 * giờ phút).
 */
export interface MentorAchievementResponse {
  id: string | null;
  title: string | null;
  pictureUrl: string | null;
  awardDescription: string | null;
  achievedAt: string | null;
  productHeader: string | null;
  productDescription: string | null;
  demoUrl: string | null;
  displayOrder: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * `dto/response/MentorProfileResponse.java` — hồ sơ mentor của CHÍNH MÌNH, giữ
 * nguyên thứ tự trường của record Java để đối chiếu được từng dòng.
 *
 * Khác hẳn `MentorDiscoveryDetailResponse` của `features/mentor`: đó là hồ sơ
 * CÔNG KHAI nhìn từ phía mentee (có section lồng, có `@JsonIgnore`), còn đây là
 * hồ sơ phẳng nhìn từ phía chủ sở hữu, qua một endpoint khác
 * (`GET /api/me/mentor-profile`).
 */
export interface MentorProfileResponse {
  /** `false` khi user chưa tạo hồ sơ mentor nào — KHÔNG phải một lỗi */
  exists: boolean;
  requiredFieldsCompleted: boolean;
  userId: string;
  /** `null` khi mapper không tra được user, và khi `exists === false` */
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** `null` khi `exists === false` — xem điểm 3 ở đầu file */
  mentorStatus: MentorStatus | null;
  headline: string | null;
  expertiseDescription: string | null;
  /** `Boolean` đóng hộp nhưng mapper luôn gán từ `boolean` nguyên thuỷ */
  isAvailable: boolean;
  /** `LocalDateTime`, không offset. Có giá trị khi mentor đang bị treo quyền nhận booking */
  bookingSuspendedUntil: string | null;
  /** `LocalDateTime`, không offset */
  verifiedAt: string | null;
  minimumBookingLeadTimeMinutes: number;
  maximumBookingHorizonDays: number;
  bookingTimezone: string;
  subjectResults: MentorSubjectResultResponse[];
  foundationSupportLevel: number | null;
  outputReviewSupportLevel: number | null;
  directionSupportLevel: number | null;
  featuredProjects: MentorFeaturedProjectResponse[];
  achievements: MentorAchievementResponse[];
  githubUrl: string | null;
  portfolioUrl: string | null;
  phoneNumber: string | null;
  /** `BigDecimal` → số trong JSON; `null` khi mentor chưa có đánh giá nào */
  ratingAverage: number | null;
  reviewCount: number | null;
  completedSessions: number | null;
  /** `LocalDateTime`, không offset; `null` khi `exists === false` */
  createdAt: string | null;
  updatedAt: string | null;
}

/** `modules/payment/domain/LedgerEntryType.java` */
export type LedgerEntryType =
  | 'ISSUE'
  | 'RESERVE'
  | 'CONSUME'
  | 'RELEASE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'HOLD'
  | 'PAID_OUT'
  | 'COMMISSION'
  | 'VOID';

/** `modules/payment/domain/LedgerSourceType.java` */
export type LedgerSourceType =
  | 'PAYMENT_ORDER'
  | 'BOOKING'
  | 'CAMPAIGN'
  | 'COUPON'
  | 'MANUAL'
  | 'PAYOUT_REQUEST'
  | 'REFUND'
  | 'PAYMENT_ATTEMPT'
  | 'COURSE_ENROLLMENT'
  | 'BOOKING_ISSUE_RESOLUTION';

/** `modules/payment/domain/CreditOriginType.java` */
export type CreditOriginType =
  | 'CAMPAIGN_BONUS'
  | 'COUPON_BONUS'
  | 'REFUND'
  | 'MANUAL'
  | 'PAYMENT_RESERVATION'
  | 'PAYMENT_SURPLUS';

/**
 * `dto/response/WalletTransactionResponse.java` — một dòng trong lịch sử ví.
 *
 * DTO dùng chung cho ví của mentee (`/credit-wallet`) và ví settlement của
 * mentor (`/mentor-wallet`), nhưng hai mapper điền KHÁC nhau:
 * `toSettlementTransactionResponse()` luôn gán `originType = null` (trường đó
 * chỉ có nghĩa với credit của mentee), và `entryType` của nó cũng nullable vì
 * mapper kiểm `entry.getEntryType() == null` trước khi `valueOf`.
 */
export interface WalletTransactionResponse {
  id: string | null;
  entryType: LedgerEntryType | null;
  /** LUÔN `null` ở ví settlement của mentor */
  originType: CreditOriginType | null;
  /** `@Schema` nói "FE không cần dùng"; giữ lại để hình dạng khớp JSON thật */
  sourceType: LedgerSourceType | null;
  sourceId: string | null;
  amountScoin: number | null;
  balanceEffectScoin: number | null;
  memo: string | null;
  /** `OffsetDateTime` — CÓ offset `+07:00`, xem điểm 1 ở đầu file */
  createdAt: string | null;
}

/**
 * `dto/response/MentorWalletResponse.java` — ví settlement của mentor.
 *
 * `recentTransactions` là **15 giao dịch gần nhất** và chỉ thế
 * (`findTop15ByAccountIdOrderByCreatedAtDesc`): nó KHÔNG phân trang và KHÔNG
 * phải nguồn để tính tổng thu nhập theo khoảng thời gian — xem JSDoc của
 * `MentorDashboardScreen` về biểu đồ 7 ngày bị bỏ.
 */
export interface MentorWalletResponse {
  /** `Integer` đóng hộp nhưng mapper gán từ `int` nguyên thuỷ — xem điểm 2 */
  availableScoin: number;
  recentTransactions: WalletTransactionResponse[];
}

// ---------------------------------------------------------------------------
// Lịch dạy, dịch vụ và Google Calendar của mentor
// ---------------------------------------------------------------------------

/** `booking/dto/response/SlotMutationCapabilityResponse.java` */
export interface SlotMutationCapabilityResponse {
  mode: 'ALLOWED' | 'REQUIRES_PENDING_REJECTION' | 'BLOCKED_BY_LOCKING_BOOKING';
  restrictionCode: string | null;
  affectedPendingBookingCount: number;
}

/** Dịch vụ gắn vào một slot (`AvailabilitySlotServiceBasicResponse.java`) */
export interface SlotServiceBasic {
  serviceId: string;
  title: string;
  durationMinutes: number;
  isFree: boolean;
  priceScoin: number | null;
  bindingRemoval: SlotMutationCapabilityResponse | null;
}

/**
 * `booking/dto/response/MentorManagedAvailabilitySlotResponse.java` — một slot
 * nhìn từ phía chủ của nó.
 *
 * `startAt`/`endAt` là `Instant` (UTC, hậu tố `Z`) — KHÁC với slot phía mentee
 * (`MentorAvailabilitySlotResponse` dùng `LocalDateTime`). Đổi sang giờ Việt Nam
 * trước khi in, xem `features/mentorMode/lichDay.ts`.
 */
export interface MentorManagedSlotResponse {
  slotId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  isActive: boolean;
  note: string | null;
  services: SlotServiceBasic[];
  version: number | null;
  pendingBookingCount: number;
  lockingBookingCount: number;
  hasLockingBooking: boolean;
  timeMutation: SlotMutationCapabilityResponse | null;
  deactivation: SlotMutationCapabilityResponse | null;
  canEditNote: boolean;
}

/** `booking/dto/request/CreateAvailabilitySlotRequest.java` (các trường FE dùng) */
export interface CreateSlotRequest {
  /** `Instant` UTC */
  startAt: string;
  endAt: string;
  /** ≤ 200 ký tự */
  note?: string | null;
  /** `@NotEmpty` */
  serviceIds: string[];
}

/** `booking/dto/request/DeactivateAvailabilitySlotRequest.java` */
export interface DeactivateSlotRequest {
  expectedVersion: number;
}

/** `mentor/domain/MentorServiceDeliveryMode.java` */
export type ServiceDeliveryMode = 'ONE_TO_ONE' | 'GROUP';

/**
 * `mentor/dto/response/MentorServiceManagementResponse.java` — dịch vụ nhìn từ
 * phía mentor, có đủ ba con số giá: giá mentor đặt (`basePriceScoin`), giá
 * mentee thấy (`publicPriceScoin`, đã gồm phụ phí) và thu nhập ước tính
 * (`estimatedMentorPayoutScoin`). Không tự tính — backend là nguồn.
 */
export interface MentorServiceManagementResponse {
  serviceId: string;
  mentorUserId: string;
  title: string;
  description: string;
  expectedOutcome: string;
  durationMinutes: number;
  isFree: boolean;
  basePriceScoin: number | null;
  publicPriceScoin: number | null;
  estimatedMentorPayoutScoin: number | null;
  isActive: boolean;
  maintainPostSessionChat: boolean;
  deliveryMode: ServiceDeliveryMode;
  coverAssetId: string | null;
  coverImageUrl: string | null;
  version: number;
  /** `LocalDateTime` — không offset */
  createdAt: string | null;
  updatedAt: string | null;
}

/** `mentor/dto/response/MentorServiceConstraintsResponse.java` — FE không được ghi cứng */
export interface MentorServiceConstraintsResponse {
  allowedDurationMinutes: number[];
  minimumPriceScoinPerMinute: number;
  maximumPriceScoinPerMinute: number;
}

/** `mentor/dto/request/CreateMentorServiceRequest.java` */
export interface CreateMentorServiceRequest {
  title: string;
  description: string;
  expectedOutcome: string;
  durationMinutes: number;
  isFree: boolean;
  priceScoin: number;
  maintainPostSessionChat: boolean;
  deliveryMode: ServiceDeliveryMode;
}

/** `mentor/dto/request/UpdateMentorServiceRequest.java` — thời lượng KHÔNG sửa được */
export interface UpdateMentorServiceRequest {
  title: string;
  description: string;
  expectedOutcome: string;
  isFree: boolean;
  priceScoin: number;
  maintainPostSessionChat: boolean;
  expectedVersion: number;
}

/** `mentor/dto/request/MentorServiceActiveRequest.java` */
export interface MentorServiceActiveRequest {
  isActive: boolean;
  expectedVersion: number;
}

/** Giới hạn `@Size` của ba trường chữ của dịch vụ */
export const TIEU_DE_DICH_VU_TOI_DA = 200;
export const MO_TA_DICH_VU_TOI_DA = 1000;

/** `identity/dto/response/GoogleCalendarStatusResponse.java` */
export interface GoogleCalendarStatusResponse {
  connected: boolean;
  syncEnabled: boolean;
  email: string | null;
  grantedScopes: string[] | null;
  needsReconnect: boolean;
  lastSyncStatus: string | null;
  /** `OffsetDateTime` — có offset */
  lastSyncAt: string | null;
  lastSyncErrorCode: string | null;
  lastSyncErrorMessage: string | null;
}
