import type { BanNhapHoSo } from '@/features/profile/hoSoHocThuat';
import { banNhapMoi, banNhapTuHoSo, kiemHoSo, taoYeuCauHoSo } from '@/features/profile/hoSoHocThuat';
import { MOCK_STUDENT_PROFILE } from '@/features/profile/mocks/handlers';

const NAM = 2026;

function du(ghiDe: Partial<BanNhapHoSo> = {}): BanNhapHoSo {
  return {
    ...banNhapMoi('Nguyễn Thu Hà'),
    mssv: 'SE192621',
    campusId: 'c1',
    programId: 'p1',
    specializationId: 's1',
    hocKy: 5,
    namNhapHoc: '2024',
    ...ghiDe,
  };
}

describe('kiemHoSo', () => {
  it('bản nháp đủ và đúng thì gửi được', () => {
    expect(kiemHoSo(du(), NAM)).toEqual({ loiTruong: {}, conThieu: null });
  });

  it('ô trống KHÔNG báo đỏ, chỉ liệt kê còn thiếu gì', () => {
    const kq = kiemHoSo(banNhapMoi(null), NAM);

    expect(kq.loiTruong).toEqual({});
    expect(kq.conThieu).toBe(
      'Còn thiếu mã số sinh viên, cơ sở, ngành học, chuyên ngành, học kỳ, năm nhập học.',
    );
  });

  it('MSSV theo đúng regex backend, không phân biệt hoa thường', () => {
    expect(kiemHoSo(du({ mssv: 'se192621' }), NAM).loiTruong.mssv).toBeUndefined();
    // Khoá 23 trở lên không hợp lệ theo regex hiện tại của backend.
    expect(kiemHoSo(du({ mssv: 'SE232621' }), NAM).loiTruong.mssv).toBeDefined();
    expect(kiemHoSo(du({ mssv: 'XE192621' }), NAM).loiTruong.mssv).toBeDefined();
    expect(kiemHoSo(du({ mssv: 'SE19262' }), NAM).conThieu).toBe('Sửa các ô báo đỏ để tiếp tục.');
  });

  it('học kỳ 0 (dự bị) là HỢP LỆ, không bị coi là chưa chọn', () => {
    expect(kiemHoSo(du({ hocKy: 0 }), NAM).conThieu).toBeNull();
  });

  it('năm nhập học trong khoảng 2000 – năm hiện tại', () => {
    expect(kiemHoSo(du({ namNhapHoc: '1999' }), NAM).loiTruong.namNhapHoc).toBeDefined();
    expect(kiemHoSo(du({ namNhapHoc: '2027' }), NAM).loiTruong.namNhapHoc).toBeDefined();
    expect(kiemHoSo(du({ namNhapHoc: '20a4' }), NAM).loiTruong.namNhapHoc).toBeDefined();
    expect(kiemHoSo(du({ namNhapHoc: '2026' }), NAM).loiTruong.namNhapHoc).toBeUndefined();
  });

  it('cựu sinh viên: bắt buộc năm tốt nghiệp, ≥ nhập học + 2, không cần học kỳ', () => {
    const cuu = du({ daTotNghiep: true, hocKy: null, namNhapHoc: '2019' });

    expect(kiemHoSo(cuu, NAM).conThieu).toBe('Còn thiếu năm tốt nghiệp.');
    expect(kiemHoSo({ ...cuu, namTotNghiep: '2020' }, NAM).loiTruong.namTotNghiep).toMatch(/ít nhất 2 năm/);
    expect(kiemHoSo({ ...cuu, namTotNghiep: '2023' }, NAM).conThieu).toBeNull();
  });

  it('tên quá 150 ký tự bị chặn', () => {
    expect(kiemHoSo(du({ ten: 'a'.repeat(151) }), NAM).loiTruong.ten).toBeDefined();
  });
});

describe('taoYeuCauHoSo', () => {
  it('chuẩn hoá MSSV, bỏ chuỗi rỗng thành null', () => {
    const yc = taoYeuCauHoSo(du({ mssv: ' se192621 ', ten: '  ', gioiThieu: '' }));

    expect(yc).toMatchObject({ studentCode: 'SE192621', displayName: null, bio: null, intakeYear: 2024 });
  });

  it('còn học thì KHÔNG gửi năm tốt nghiệp sót lại trong ô', () => {
    // Người dùng bật "đã tốt nghiệp", gõ năm, rồi tắt: năm đó không được đi kèm,
    // backend vẫn kiểm nó và có thể từ chối oan.
    const yc = taoYeuCauHoSo(du({ daTotNghiep: false, namTotNghiep: '2020' }));

    expect(yc.graduationYear).toBeNull();
    expect(yc.isAlumni).toBe(false);
  });

  it('cựu sinh viên gửi học kỳ 9 — đúng giá trị backend sẽ ghi', () => {
    const yc = taoYeuCauHoSo(du({ daTotNghiep: true, hocKy: null, namNhapHoc: '2019', namTotNghiep: '2023' }));

    expect(yc).toMatchObject({ isAlumni: true, semester: 9, graduationYear: 2023 });
  });
});

describe('banNhapTuHoSo', () => {
  it('nạp hồ sơ đã có, giữ học kỳ 0 và đọc `alumni`', () => {
    const b = banNhapTuHoSo({ ...MOCK_STUDENT_PROFILE, semester: 0, alumni: true, graduationYear: 2024 });

    expect(b).toMatchObject({
      mssv: 'HE180001',
      campusId: 'c1',
      programId: 'p1',
      specializationId: 's1',
      hocKy: 0,
      daTotNghiep: true,
      namTotNghiep: '2024',
    });
  });
});
