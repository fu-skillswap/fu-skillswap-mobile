/**
 * @file types.ts
 * @description DTO của luồng đăng ký mentor, port từ source Java
 * (`modules/mentor/dto/...`, `domain/VerificationStatus.java`,
 * `domain/VerificationDocumentType.java`). Hồ sơ mentor (`MentorProfileResponse`)
 * dùng lại kiểu của `features/mentorMode`.
 *
 * ## Ba chỗ bản web lệch backend — app theo BACKEND
 *
 * - **Mức hỗ trợ là 1–4** (`@Max(4)` của `MentorProfileUpsertRequest`). Form web
 *   cho chọn tới "Mức 5" — chọn mức đó thì backend trả 400.
 * - **Phải có ít nhất một môn** (`@NotEmpty subjectResults`), mã môn không trùng,
 *   tên môn bắt buộc (`MentorProfileService`). Web cho gửi danh sách rỗng.
 * - **Mô tả chuyên môn tối đa 1000 ký tự** (web để 1500) và số điện thoại theo
 *   `^0(3|5|7|8|9)\d{8}$`.
 *
 * Mọi `record` Java: khoá JSON đúng tên thành phần, kể cả `boolean isActive` của
 * tài liệu (record không bỏ tiền tố `is` như Lombok `@Data`).
 */

/** `VerificationStatus.java` */
export type VerificationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

/** `VerificationDocumentType.java` — FPTU tối đa 1 file, chuyên môn tối đa 3 */
export type VerificationDocumentType = 'FPTU_AFFILIATION_PROOF' | 'EXPERTISE_PROOF';

/** `MentorVerificationDocumentResponse.java` */
export interface MentorVerificationDocumentResponse {
  id: string;
  documentType: VerificationDocumentType;
  status: string | null;
  storageKind: string | null;
  originalFilename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  fileUrl: string | null;
  isActive: boolean;
  version: number | null;
  reviewNote: string | null;
  rejectedReason: string | null;
  /** `LocalDateTime` — không offset */
  uploadedAt: string | null;
}

/** `MentorVerificationAllowedActionsResponse.java` */
export interface MentorVerificationAllowedActions {
  canUploadDocuments: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canUnsubmit: boolean;
}

/** `MentorVerificationRequestResponse.java` (bỏ `timeline`, `checklist` — app không đọc) */
export interface MentorVerificationRequestResponse {
  requestId: string;
  mentorUserId: string;
  status: VerificationStatus;
  submitNote: string | null;
  reviewNote: string | null;
  rejectionReason: string | null;
  revisionCount: number | null;
  submittedAt: string | null;
  estimatedReviewBy: string | null;
  reviewTargetHours: number | null;
  reviewOverdue: boolean;
  documents: MentorVerificationDocumentResponse[];
  allowedActions: MentorVerificationAllowedActions | null;
}

/** `MentorSubjectResultRequest.java` — `scoreValue` là `BigDecimal` */
export interface MentorSubjectResultRequest {
  subjectCode: string;
  subjectName: string;
  scoreValue: number;
}

/** `MentorProfileUpsertRequest.java` */
export interface MentorProfileUpsertRequest {
  headline: string;
  expertiseDescription: string;
  isAvailable: boolean;
  subjectResults: MentorSubjectResultRequest[];
  foundationSupportLevel: number;
  outputReviewSupportLevel: number;
  directionSupportLevel: number;
  githubUrl: string | null;
  portfolioUrl: string | null;
  phoneNumber: string;
  minimumBookingLeadTimeMinutes: number;
  maximumBookingHorizonDays: number;
  bookingTimezone: string;
}

/** `MentorFeaturedProjectRequest.java` (không gửi ảnh) */
export interface MentorFeaturedProjectRequest {
  title: string;
  content: string | null;
  projectDescription: string | null;
  liveDemoUrl: string | null;
}

/** `MentorAchievementRequest.java` — `achievedAt` là `LocalDate` (`"2025-06-01"`) */
export interface MentorAchievementRequest {
  title: string;
  awardDescription: string | null;
  achievedAt: string | null;
  productHeader: string | null;
  productDescription: string | null;
  demoUrl: string | null;
}

/** `MentorVerificationDocumentUploadIntentRequest.java` — ≤ 15 MB, JPG/PNG/PDF */
export interface UploadIntentRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

/** `MentorVerificationDocumentUploadIntentResponse.java` — `expiresAt` là `Instant` */
export interface UploadIntentResponse {
  uploadIntentId: string;
  uploadUrl: string;
  expiresAt: string | null;
  requiredHeaders: Record<string, string> | null;
  status: string | null;
}

/** `MentorVerificationDocumentUploadRequest.java` */
export interface ConfirmDocumentRequest {
  documentType: VerificationDocumentType;
  uploadIntentId: string;
}

/** `MentorVerificationSubmitRequest.java` */
export interface SubmitVerificationRequest {
  submitNote: string | null;
  termsAccepted: boolean;
}
