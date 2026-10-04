/**
 * @file handlers.ts
 * @description Handler MSW cho hồ sơ sinh viên, dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test — lý do tách hai thứ ghi đầy đủ ở
 * `core/auth/mocks/handlers.ts`.
 *
 * Fixture cố ý chọn giá trị **hợp lệ theo ràng buộc thật của backend**, không
 * phải giá trị nhìn cho đẹp:
 *
 * - `studentCode` khớp regex `^[HSDQC][ESA](0[1-9]|1[0-9]|2[0-2])\d{4}$`
 *   (`identity.md` §5.2). Một mã bịa kiểu "SINH-VIEN-01" sẽ bị chính form
 *   onboarding của giai đoạn sau từ chối — tức là dữ liệu mock không dùng được
 *   cho đúng việc nó sinh ra.
 * - `campus.code` là một giá trị của `CampusCode.java`
 *   (`HCM | HA_NOI | DA_NANG | CAN_THO | QUY_NHON | ONLINE`).
 * - Ngành và chuyên ngành dùng `nameVi`/`nameEn`; hai DTO đó **không có** field
 *   `name` — khác với cơ sở.
 * - Boolean nguyên thuỷ `isX` của Lombok lên dây là `x` (`alumni`, `expected`,
 *   `other`) — xem JSDoc của `features/profile/types.ts`.
 *
 * Có cả `PUT` và ba danh mục (`/api/campuses`, `/api/academic-programs`,
 * `/api/academic-programs/{id}/specializations`) cho màn Hoàn thiện hồ sơ.
 * `PUT` ghi thật vào kho và kiểm lại đúng các luật của backend, để thử được cả
 * nhánh lỗi 400 trên máy.
 */

import { http } from 'msw';

import { jsonMock } from '@/core/dev/jsonMock';

import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { getEnv } from '@/core/config/env';
import { MSSV_HOP_LE } from '@/features/profile/hoSoHocThuat';
import type {
  AcademicProgramResponse,
  CampusResponse,
  SpecializationResponse,
  StudentProfileRequest,
  StudentProfileResponse,
} from '@/features/profile/types';

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
  };
}

/** Hồ sơ sinh viên giả, gắn với đúng người dùng mock của `core/auth/mocks` */
export const MOCK_STUDENT_PROFILE: StudentProfileResponse = {
  userId: MOCK_USER.publicId,
  email: MOCK_USER.email,
  studentCode: 'HE180001',
  displayName: MOCK_USER.fullName,
  avatarUrl: null,
  campus: { id: 'c1', code: 'HA_NOI', name: 'FPT University Hà Nội', city: 'Hà Nội' },
  program: {
    id: 'p1',
    code: 'CNTT',
    nameVi: 'Công nghệ thông tin',
    nameEn: 'Information Technology',
  },
  specialization: {
    id: 's1',
    programId: 'p1',
    code: 'KTPM',
    nameVi: 'Kỹ thuật phần mềm',
    nameEn: 'Software Engineering',
    expected: false,
    other: false,
  },
  semester: 5,
  intakeYear: 2022,
  alumni: false,
  graduationYear: null,
  bio: 'Đang tìm mentor để ôn phỏng vấn thực tập backend.',
  // `LocalDateTime` — không offset
  createdAt: '2026-01-15T10:00:00',
  updatedAt: '2026-09-20T14:45:00',
};

const base = getEnv().apiUrl;

export const MOCK_CAMPUSES: CampusResponse[] = [
  { id: 'c0', code: 'HCM', name: 'FPT University Hồ Chí Minh', city: 'Hồ Chí Minh' },
  { id: 'c1', code: 'HA_NOI', name: 'FPT University Hà Nội', city: 'Hà Nội' },
  { id: 'c2', code: 'DA_NANG', name: 'FPT University Đà Nẵng', city: 'Đà Nẵng' },
  { id: 'c3', code: 'CAN_THO', name: 'FPT University Cần Thơ', city: 'Cần Thơ' },
  { id: 'c4', code: 'QUY_NHON', name: 'FPT University Quy Nhơn', city: 'Quy Nhơn' },
];

export const MOCK_PROGRAMS: AcademicProgramResponse[] = [
  { id: 'p1', code: 'CNTT', nameVi: 'Công nghệ thông tin', nameEn: 'Information Technology' },
  { id: 'p2', code: 'QTKD', nameVi: 'Quản trị kinh doanh', nameEn: 'Business Administration' },
];

function chuyenNganh(id: string, programId: string, code: string, nameVi: string, nameEn: string): SpecializationResponse {
  return { id, programId, code, nameVi, nameEn, expected: false, other: false };
}

export const MOCK_SPECIALIZATIONS: SpecializationResponse[] = [
  chuyenNganh('s1', 'p1', 'KTPM', 'Kỹ thuật phần mềm', 'Software Engineering'),
  chuyenNganh('s2', 'p1', 'AI', 'Trí tuệ nhân tạo', 'Artificial Intelligence'),
  chuyenNganh('s3', 'p1', 'TKMTS', 'Thiết kế mỹ thuật số', 'Digital Art & Design'),
  chuyenNganh('s4', 'p2', 'MKT', 'Digital Marketing', 'Digital Marketing'),
  chuyenNganh('s5', 'p2', 'KDQT', 'Kinh doanh quốc tế', 'International Business'),
];

let hoSoHienTai: StudentProfileResponse | null = MOCK_STUDENT_PROFILE;

/** Đưa kho về ban đầu — chỉ dùng trong test */
export function __resetProfileMockForTests(hoSo: StudentProfileResponse | null = MOCK_STUDENT_PROFILE): void {
  hoSoHienTai = hoSo;
}

function loi400(message: string) {
  return jsonMock(
    { timestamp: new Date().toISOString(), status: 400, code: 'BAD_REQUEST', message, data: null },
    { status: 400 },
  );
}

export const profileMockHandlers = [
  http.get(`${base}/api/me/student-profile`, () =>
    hoSoHienTai
      ? jsonMock(envelope(hoSoHienTai))
      : jsonMock(
          { timestamp: new Date().toISOString(), status: 404, code: 'NOT_FOUND', message: 'Hồ sơ học thuật chưa được tạo', data: null },
          { status: 404 },
        ),
  ),

  http.put(`${base}/api/me/student-profile`, async ({ request }) => {
    const yc = (await request.json()) as StudentProfileRequest;
    if (!MSSV_HOP_LE.test(yc.studentCode ?? '')) {
      return loi400('Mã số sinh viên không đúng định dạng (Ví dụ: SE192621)');
    }
    const campus = MOCK_CAMPUSES.find((c) => c.id === yc.campusId);
    const program = MOCK_PROGRAMS.find((p) => p.id === yc.programId);
    const specialization = MOCK_SPECIALIZATIONS.find((s) => s.id === yc.specializationId);
    if (!campus || !program || !specialization) {
      return loi400('Cơ sở, ngành học hoặc chuyên ngành không tồn tại');
    }
    if (specialization.programId !== program.id) {
      return loi400('Chuyên ngành không thuộc ngành học đã chọn');
    }
    if (yc.isAlumni && yc.graduationYear == null) {
      return loi400('Cựu sinh viên bắt buộc phải có năm tốt nghiệp');
    }
    const luc = new Date().toISOString().slice(0, 19);
    hoSoHienTai = {
      userId: MOCK_USER.publicId,
      email: MOCK_USER.email,
      studentCode: yc.studentCode.trim().toUpperCase(),
      displayName: yc.displayName?.trim() || MOCK_USER.fullName,
      avatarUrl: null,
      campus,
      program,
      specialization,
      semester: yc.isAlumni ? 9 : yc.semester,
      intakeYear: yc.intakeYear,
      alumni: yc.isAlumni,
      graduationYear: yc.graduationYear,
      bio: yc.bio,
      createdAt: hoSoHienTai?.createdAt ?? luc,
      updatedAt: luc,
    };
    return jsonMock(envelope(hoSoHienTai));
  }),

  http.get(`${base}/api/campuses`, () => jsonMock(envelope(MOCK_CAMPUSES))),
  http.get(`${base}/api/academic-programs`, () => jsonMock(envelope(MOCK_PROGRAMS))),
  http.get(`${base}/api/academic-programs/:programId/specializations`, ({ params }) =>
    jsonMock(envelope(MOCK_SPECIALIZATIONS.filter((s) => s.programId === params.programId))),
  ),
];
