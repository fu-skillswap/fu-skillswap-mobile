/**
 * @file types.ts
 * @description Kiểu dữ liệu hồ sơ sinh viên, đối chiếu với source Java
 * (`modules/identity/dto/...`, `domain/CampusCode.java`) — KHÔNG chỉ theo
 * `identity.md`, vì tài liệu đó lệch source ở ba chỗ (mục 5 của quy ước):
 *
 * - `CampusCode` là `HCM | HA_NOI | DA_NANG | CAN_THO | QUY_NHON | ONLINE`, không
 *   phải bộ mã viết tắt `HL/DN/CT/QNH` mà tài liệu ghi.
 * - Ba field `boolean` NGUYÊN THUỶ đặt tên `isX` trong lớp Lombok `@Data`
 *   (`isExpected`, `isOther`, `isAlumni`) có getter là `isX()`, nên Jackson
 *   phát chúng ra JSON với tên BỎ tiền tố: `expected`, `other`, `alumni`. Bản web
 *   (`models/auth.ts`) cũng đọc `expected`. Đọc `isAlumni` sẽ ra `undefined` mà
 *   không có lỗi kiểu nào chặn.
 * - `createdAt`/`updatedAt` là `LocalDateTime` — lên dây KHÔNG có offset.
 *
 * Request thì ngược lại: `StudentProfileRequest.isAlumni` là `Boolean` ĐÓNG HỘP,
 * getter `getIsAlumni()`, nên khoá JSON khi GỬI lên đúng là `isAlumni`.
 */

/** Cơ sở FPT (§4.1) */
export interface CampusResponse {
  id: string;
  /** `CampusCode.java` */
  code: 'HCM' | 'HA_NOI' | 'DA_NANG' | 'CAN_THO' | 'QUY_NHON' | 'ONLINE';
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
  /** Java `isExpected` — Jackson bỏ tiền tố `is` */
  expected: boolean;
  /** Java `isOther` — Jackson bỏ tiền tố `is` */
  other: boolean;
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
  /** Java `isAlumni` (boolean nguyên thuỷ) — lên dây là `alumni` */
  alumni: boolean;
  graduationYear: number | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `StudentProfileRequest.java` — body của `PUT /api/me/student-profile` (tạo mới
 * HOẶC cập nhật, cùng một endpoint).
 */
export interface StudentProfileRequest {
  /** `^[HSDQC][ESA](0[1-9]|1[0-9]|2[0-2])\d{4}$`, không phân biệt hoa thường */
  studentCode: string;
  /** Rỗng thì backend giữ tên từ Google */
  displayName: string | null;
  campusId: string;
  programId: string;
  /** BẮT BUỘC và phải thuộc `programId` */
  specializationId: string;
  /** 0–9; cựu sinh viên thì backend tự ghi 9 */
  semester: number;
  /** 2000 – năm hiện tại */
  intakeYear: number;
  isAlumni: boolean;
  /** Bắt buộc khi `isAlumni`; ≥ `intakeYear + 2` */
  graduationYear: number | null;
  bio: string | null;
}
