/**
 * @file mentorModeFixture.ts
 * @description Xưởng dựng `MentorProfileResponse` và `MentorWalletResponse` ĐỦ
 * TRƯỜNG, dùng cho chế độ mock và cho test.
 *
 * Lý do gom về một xưởng giống `bookingFixture.ts`: backend KHÔNG bật
 * `default-property-inclusion: non_null` nên JSON thật trả về cả các khoá `null`,
 * và chép tay một object như vậy vào từng file test sẽ cho ra ba bản lệch nhau —
 * bản lệch chính là bản cho test xanh trên một hình dạng backend không bao giờ
 * trả. Giữ MỘT xưởng thì `tsc` bắt lỗi ở đúng một chỗ khi DTO đổi.
 *
 * Từng test vẫn tự quyết TÌNH HUỐNG của mình qua `ghiDe`; xưởng chỉ lo hình dạng.
 *
 * **Mốc thời gian trong hai DTO này theo HAI khuôn khác nhau** — xem điểm 1 ở
 * JSDoc của `features/mentorMode/types.ts`. Viết sai khuôn ở đây là dựng một
 * backend khác backend thật:
 * - `MentorProfileResponse`: `LocalDateTime`, KHÔNG offset (`"2026-06-20T14:30:00"`).
 * - `WalletTransactionResponse.createdAt`: `OffsetDateTime`, CÓ offset
 *   (`"2026-10-01T19:00:00+07:00"`).
 */

import type {
  MentorProfileResponse,
  MentorWalletResponse,
  WalletTransactionResponse,
} from '@/features/mentorMode/types';

const MENTOR_ID = 'mentor-0001';

/**
 * Một hồ sơ mentor "bình thường": đã xác minh, có đánh giá, không bị treo.
 *
 * `ghiDe` chồng lên để mô tả tình huống cần kiểm. Không có `Partial` nào bị ép
 * kiểu, nên một trường viết sai tên là lỗi biên dịch chứ không phải một
 * `undefined` âm thầm.
 */
export function taoHoSoMentor(ghiDe: Partial<MentorProfileResponse> = {}): MentorProfileResponse {
  return {
    exists: true,
    requiredFieldsCompleted: true,
    userId: MENTOR_ID,
    email: 'mentor@fpt.edu.vn',
    displayName: 'Trần Minh Quân',
    avatarUrl: null,
    mentorStatus: 'ACTIVE',
    headline: 'Backend Developer | Spring Boot Mentor',
    expertiseDescription: 'Xây dựng REST API với Spring Boot, PostgreSQL và triển khai Docker.',
    isAvailable: true,
    bookingSuspendedUntil: null,
    // `LocalDateTime` — KHÔNG offset.
    verifiedAt: '2026-06-20T14:30:00',
    minimumBookingLeadTimeMinutes: 120,
    maximumBookingHorizonDays: 30,
    bookingTimezone: 'Asia/Ho_Chi_Minh',
    subjectResults: [
      {
        id: 'sub-1',
        subjectCode: 'PRN212',
        subjectName: 'Basic Cross-Platform Application Programming',
        scoreValue: 9.2,
        displayOrder: 0,
      },
    ],
    foundationSupportLevel: 3,
    outputReviewSupportLevel: 3,
    directionSupportLevel: 2,
    featuredProjects: [],
    achievements: [],
    githubUrl: 'https://github.com/example',
    portfolioUrl: null,
    phoneNumber: '0912345678',
    ratingAverage: 4.8,
    reviewCount: 87,
    completedSessions: 124,
    createdAt: '2026-06-10T08:00:00',
    updatedAt: '2026-10-03T10:30:00',
    ...ghiDe,
  };
}

/**
 * Hồ sơ của một tài khoản vừa được cấp vai trò MENTOR nhưng CHƯA điền hồ sơ.
 *
 * Dựng theo đúng `MentorProfileResponse.empty(userId)` của backend: nó chỉ điền
 * `exists`, `requiredFieldsCompleted`, `userId`, `isAvailable`, ba trường policy
 * và ba danh sách rỗng — **mọi thứ còn lại là `null`**, kể cả `mentorStatus`,
 * `displayName`, `createdAt` và `updatedAt`. Đây là hình dạng dễ làm vỡ màn hình
 * nhất, nên nó có xưởng riêng để không ai phải nhớ danh sách trên.
 */
export function taoHoSoMentorRong(userId: string = MENTOR_ID): MentorProfileResponse {
  return {
    exists: false,
    requiredFieldsCompleted: false,
    userId,
    email: null,
    displayName: null,
    avatarUrl: null,
    mentorStatus: null,
    headline: null,
    expertiseDescription: null,
    isAvailable: true,
    bookingSuspendedUntil: null,
    verifiedAt: null,
    minimumBookingLeadTimeMinutes: 120,
    maximumBookingHorizonDays: 30,
    bookingTimezone: 'Asia/Ho_Chi_Minh',
    subjectResults: [],
    foundationSupportLevel: null,
    outputReviewSupportLevel: null,
    directionSupportLevel: null,
    featuredProjects: [],
    achievements: [],
    githubUrl: null,
    portfolioUrl: null,
    phoneNumber: null,
    ratingAverage: null,
    reviewCount: null,
    completedSessions: null,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Một giao dịch trong ví settlement của mentor.
 *
 * `originType` LUÔN `null` ở ví mentor: `WalletQueryService.toSettlementTransactionResponse()`
 * gán cứng `null` cho trường đó (nó chỉ có nghĩa với credit của mentee).
 */
export function taoGiaoDichVi(
  ghiDe: Partial<WalletTransactionResponse> = {},
): WalletTransactionResponse {
  return {
    id: 'tx-1',
    entryType: 'RELEASE',
    originType: null,
    sourceType: 'BOOKING',
    sourceId: 'b6',
    amountScoin: 90,
    balanceEffectScoin: 90,
    memo: 'Giải ngân buổi mentoring đã hoàn thành',
    // `OffsetDateTime` — CÓ offset.
    createdAt: '2026-10-01T19:00:00+07:00',
    ...ghiDe,
  };
}

/** Ví settlement của mentor; `availableScoin` không bao giờ null (xem types.ts) */
export function taoViMentor(ghiDe: Partial<MentorWalletResponse> = {}): MentorWalletResponse {
  return {
    availableScoin: 1215000,
    recentTransactions: [
      taoGiaoDichVi(),
      taoGiaoDichVi({
        id: 'tx-2',
        entryType: 'COMMISSION',
        sourceId: 'b6',
        amountScoin: 10,
        balanceEffectScoin: -10,
        memo: 'Phí nền tảng',
        createdAt: '2026-10-01T19:00:01+07:00',
      }),
      taoGiaoDichVi({
        id: 'tx-3',
        entryType: 'HOLD',
        sourceType: 'PAYOUT_REQUEST',
        sourceId: 'po-1',
        amountScoin: 200000,
        balanceEffectScoin: -200000,
        memo: 'Giữ tiền cho yêu cầu rút',
        createdAt: '2026-09-28T09:00:00+07:00',
      }),
    ],
    ...ghiDe,
  };
}
