import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { profileMockHandlers } from '@/features/profile/mocks/handlers';
import { profileRepo } from '@/features/profile/profileRepo';

/**
 * Cho REPO THẬT đọc fixture, không assert vào fixture.
 *
 * Một fixture bịa sai hình dạng vẫn khớp mọi assertion viết tay so nó với chính
 * nó. Chỉ khi `profileRepo.getStudentProfile()` — đúng hàm màn hình gọi — đọc
 * được nó thì mới biết hình dạng đúng.
 */
const server = setupServer(...profileMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('handler mock của hồ sơ', () => {
  it('repo thật đọc được fixture, và hồ sơ gắn đúng người dùng mock', async () => {
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo).not.toBeNull();
    // Hồ sơ phải thuộc CHÍNH người dùng mà `/api/auth/me` trả về; lệch id thì
    // màn hình Hồ sơ hiện tên một người và mã sinh viên của người khác.
    expect(hoSo?.userId).toBe(MOCK_USER.publicId);
    expect(hoSo?.email).toBe(MOCK_USER.email);
  });

  it('mã sinh viên hợp lệ theo regex thật của backend', async () => {
    // `identity.md` §5.2: ^[HSDQC][ESA](0[1-9]|1[0-9]|2[0-2])\d{4}$
    // Mã bịa kiểu "SINH-VIEN-01" sẽ bị form onboarding của giai đoạn sau từ chối,
    // tức là dữ liệu mock không dùng được cho đúng việc nó sinh ra.
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.studentCode).toMatch(/^[HSDQC][ESA](0[1-9]|1[0-9]|2[0-2])\d{4}$/);
  });

  it('cơ sở dùng `name`, còn ngành và chuyên ngành dùng `nameVi`', async () => {
    // Đây là chỗ dễ sai nhất giữa ba DTO danh mục: chỉ `CampusResponse` có field
    // `name`; `AcademicProgramResponse` và `SpecializationResponse` thì không.
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.campus?.name.length).toBeGreaterThan(0);
    expect(hoSo?.program?.nameVi.length).toBeGreaterThan(0);
    expect(hoSo?.specialization?.nameVi.length).toBeGreaterThan(0);
  });

  it('mã cơ sở là một trong năm giá trị backend phát ra', async () => {
    // `'HN'` không tồn tại trong union thật — một fixture dùng nó vẫn chạy được
    // nhưng mô tả một cơ sở không có thật.
    const hoSo = await profileRepo.getStudentProfile();

    expect(['HCM', 'HL', 'DN', 'CT', 'QNH']).toContain(hoSo?.campus?.code);
  });

  it('chuyên ngành trỏ về đúng ngành cha', async () => {
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.specialization?.programId).toBe(hoSo?.program?.id);
  });
});
