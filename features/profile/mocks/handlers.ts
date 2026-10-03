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
 * - `campus.code` là `'HL'`, một trong năm giá trị backend phát ra
 *   (`HCM | HL | DN | CT | QNH`). `'HN'` không tồn tại.
 * - Ngành và chuyên ngành dùng `nameVi`/`nameEn`; hai DTO đó **không có** field
 *   `name` — khác với cơ sở.
 *
 * Chỉ mock ĐỌC (`GET`). `PUT /api/me/student-profile` thuộc luồng onboarding,
 * chưa có màn hình nào gọi; mock nó bây giờ chỉ tạo code chết.
 */

import { http } from 'msw';

import { jsonMock } from '@/core/dev/jsonMock';

import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { getEnv } from '@/core/config/env';
import type { StudentProfileResponse } from '@/features/profile/types';

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
  campus: { id: 'c1', code: 'HL', name: 'FPT University Hà Nội', city: 'Hà Nội' },
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
    isExpected: false,
    isOther: false,
  },
  semester: 5,
  intakeYear: 2022,
  isAlumni: false,
  graduationYear: null,
  bio: 'Đang tìm mentor để ôn phỏng vấn thực tập backend.',
  createdAt: '2026-01-15T03:00:00Z',
  updatedAt: '2026-09-20T07:45:00Z',
};

const base = getEnv().apiUrl;

export const profileMockHandlers = [
  http.get(`${base}/api/me/student-profile`, () =>
    jsonMock(envelope(MOCK_STUDENT_PROFILE)),
  ),
];
