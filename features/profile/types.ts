/**
 * @file types.ts
 * @description Kiểu dữ liệu hồ sơ sinh viên, port từ
 * `fu-skillswap-be/docs/frontend-guide/identity.md` §4.1–4.3 và §5.1.
 */

/** Cơ sở FPT (§4.1) */
export interface CampusResponse {
  id: string;
  /** Mã cơ sở — backend chỉ phát ra đúng năm giá trị này; KHÔNG có 'HN' */
  code: 'HCM' | 'HL' | 'DN' | 'CT' | 'QNH';
  /** Ví dụ: "FPT University Hồ Chí Minh" */
  name: string;
  /** Ví dụ: "Hồ Chí Minh" */
  city: string;
}

/** Ngành học (§4.2) — LƯU Ý: `nameVi`/`nameEn`, KHÔNG có field `name` */
export interface AcademicProgramResponse {
  id: string;
  /** Mã ngành, ví dụ: "CNTT" */
  code: string;
  nameVi: string;
  nameEn: string;
}

/** Chuyên ngành (§4.3) — cũng là `nameVi`/`nameEn`, không có `name` */
export interface SpecializationResponse {
  id: string;
  /** UUID ngành học cha */
  programId: string;
  /** Mã chuyên ngành, ví dụ: "KTPM", "IA" */
  code: string;
  nameVi: string;
  nameEn: string;
  isExpected: boolean;
  isOther: boolean;
}

/**
 * Hồ sơ sinh viên của chính mình (§5.1).
 *
 * Mọi field tham chiếu (`campus`, `program`, `specialization`) đều nullable vì
 * backend cho phép hồ sơ tồn tại mà chưa gắn danh mục.
 */
export interface StudentProfileResponse {
  userId: string;
  email: string;
  studentCode: string;
  displayName: string;
  avatarUrl: string | null;
  campus: CampusResponse | null;
  program: AcademicProgramResponse | null;
  specialization: SpecializationResponse | null;
  /** Học kỳ 0–9 (§5.2) — `0` là giá trị HỢP LỆ, không phải "chưa có" */
  semester: number | null;
  intakeYear: number | null;
  isAlumni: boolean;
  graduationYear: number | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}
