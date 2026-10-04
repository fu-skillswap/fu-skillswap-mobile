import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { ApiClientError } from '@/core/api/errors';
import { banNhapMoi, kiemHoSo, taoYeuCauHoSo } from '@/features/profile/hoSoHocThuat';
import { __resetProfileMockForTests, profileMockHandlers } from '@/features/profile/mocks/handlers';
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
afterEach(() => {
  __resetApiClientForTests();
  __resetProfileMockForTests();
});
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

  it('mã cơ sở là một giá trị của `CampusCode.java`', async () => {
    // `identity.md` ghi bộ mã viết tắt (HL/DN/CT/QNH) — source Java thì không.
    const hoSo = await profileRepo.getStudentProfile();
    const danhMuc = await profileRepo.getCampuses();

    const hopLe = ['HCM', 'HA_NOI', 'DA_NANG', 'CAN_THO', 'QUY_NHON', 'ONLINE'];
    expect(hopLe).toContain(hoSo?.campus?.code);
    for (const c of danhMuc) {
      expect(hopLe).toContain(c.code);
    }
  });

  it('boolean `isX` của Lombok lên dây là `x`: `alumni`, `expected`, `other`', async () => {
    const hoSo = await profileRepo.getStudentProfile();

    expect(typeof hoSo?.alumni).toBe('boolean');
    expect(typeof hoSo?.specialization?.expected).toBe('boolean');
    expect(hoSo).not.toHaveProperty('isAlumni');
    expect(hoSo?.specialization).not.toHaveProperty('isExpected');
  });

  it('luồng onboarding: chưa có hồ sơ → danh mục → lưu → đọc lại được', async () => {
    __resetProfileMockForTests(null);
    expect(await profileRepo.getStudentProfile()).toBeNull();

    const [campus] = await profileRepo.getCampuses();
    const [program] = await profileRepo.getAcademicPrograms();
    const [spec] = await profileRepo.getSpecializations(program.id);
    const banNhap = {
      ...banNhapMoi('Nguyễn Thu Hà'),
      mssv: 'se192621',
      campusId: campus.id,
      programId: program.id,
      specializationId: spec.id,
      hocKy: 0,
      namNhapHoc: '2024',
    };
    expect(kiemHoSo(banNhap, 2026).conThieu).toBeNull();

    await profileRepo.saveStudentProfile(taoYeuCauHoSo(banNhap));
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.studentCode).toBe('SE192621');
    expect(hoSo?.semester).toBe(0);
    expect(hoSo?.specialization?.programId).toBe(program.id);
  });

  it('chuyên ngành lệch ngành bị từ chối 400 như backend', async () => {
    const programs = await profileRepo.getAcademicPrograms();
    const specKhac = (await profileRepo.getSpecializations(programs[1].id))[0];

    await expect(
      profileRepo.saveStudentProfile({
        studentCode: 'SE192621',
        displayName: null,
        campusId: 'c1',
        programId: programs[0].id,
        specializationId: specKhac.id,
        semester: 5,
        intakeYear: 2022,
        isAlumni: false,
        graduationYear: null,
        bio: null,
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('chuyên ngành trỏ về đúng ngành cha', async () => {
    const hoSo = await profileRepo.getStudentProfile();

    expect(hoSo?.specialization?.programId).toBe(hoSo?.program?.id);
  });
});
