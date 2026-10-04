/**
 * @file hoSoHocThuat.ts
 * @description Luật thuần (không React) của form Hoàn thiện hồ sơ: bản nháp,
 * kiểm hợp lệ, và dựng body `PUT /api/me/student-profile`.
 *
 * Mọi luật ở đây CHÉP từ backend (`StudentProfileRequest.java` +
 * `AcademicService.validateAcademicTimeline`), để người dùng biết lỗi ngay khi
 * gõ thay vì sau một vòng gọi mạng. Backend vẫn là chốt cuối: lỗi nó trả về được
 * hiện nguyên văn.
 */

import type { StudentProfileRequest, StudentProfileResponse } from '@/features/profile/types';

/** `@Pattern` của `studentCode` — `(?i)` phía Java tương đương cờ `i` */
export const MSSV_HOP_LE = /^[HSDQC][ESA](0[1-9]|1[0-9]|2[0-2])\d{4}$/i;

/** `@Size(max = 150)` của `displayName` */
export const TEN_TOI_DA = 150;

/** Năm sớm nhất backend nhận cho cả nhập học lẫn tốt nghiệp */
export const NAM_SOM_NHAT = 2000;

/** Học kỳ 0 là kỳ dự bị tiếng Anh — HỢP LỆ, không phải "chưa chọn" */
export const HOC_KY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface BanNhapHoSo {
  ten: string;
  mssv: string;
  campusId: string | null;
  programId: string | null;
  specializationId: string | null;
  hocKy: number | null;
  namNhapHoc: string;
  daTotNghiep: boolean;
  namTotNghiep: string;
  gioiThieu: string;
}

/** Bản nháp rỗng cho người chưa có hồ sơ; tên lấy sẵn từ tài khoản Google */
export function banNhapMoi(tenTaiKhoan: string | null | undefined): BanNhapHoSo {
  return {
    ten: tenTaiKhoan ?? '',
    mssv: '',
    campusId: null,
    programId: null,
    specializationId: null,
    hocKy: null,
    namNhapHoc: '',
    daTotNghiep: false,
    namTotNghiep: '',
    gioiThieu: '',
  };
}

/** Nạp hồ sơ đã có vào form để sửa */
export function banNhapTuHoSo(hoSo: StudentProfileResponse): BanNhapHoSo {
  return {
    ten: hoSo.displayName ?? '',
    mssv: hoSo.studentCode ?? '',
    campusId: hoSo.campus?.id ?? null,
    programId: hoSo.program?.id ?? null,
    specializationId: hoSo.specialization?.id ?? null,
    hocKy: hoSo.semester,
    namNhapHoc: hoSo.intakeYear != null ? String(hoSo.intakeYear) : '',
    daTotNghiep: hoSo.alumni,
    namTotNghiep: hoSo.graduationYear != null ? String(hoSo.graduationYear) : '',
    gioiThieu: hoSo.bio ?? '',
  };
}

/** Đọc một năm 4 chữ số; chuỗi khác thì `null` */
function docNam(chuoi: string): number | null {
  const s = chuoi.trim();
  return /^\d{4}$/.test(s) ? Number(s) : null;
}

export type TruongHoSo = 'ten' | 'mssv' | 'namNhapHoc' | 'namTotNghiep';

export interface KetQuaKiem {
  /** Lỗi gắn với một ô nhập — chỉ có khi người dùng ĐÃ gõ gì đó sai */
  loiTruong: Partial<Record<TruongHoSo, string>>;
  /** Câu nói còn thiếu gì; `null` khi gửi được */
  conThieu: string | null;
}

/**
 * Kiểm bản nháp. Ô để trống KHÔNG báo đỏ (người dùng chưa gõ thì chưa sai) —
 * nó chỉ làm `conThieu` khác `null` để khoá nút gửi và nói rõ còn thiếu gì.
 */
export function kiemHoSo(b: BanNhapHoSo, namHienTai: number): KetQuaKiem {
  const loiTruong: Partial<Record<TruongHoSo, string>> = {};

  if (b.ten.trim().length > TEN_TOI_DA) {
    loiTruong.ten = `Tên hiển thị tối đa ${TEN_TOI_DA} ký tự.`;
  }

  const mssv = b.mssv.trim();
  if (mssv !== '' && !MSSV_HOP_LE.test(mssv)) {
    loiTruong.mssv = 'Mã số sinh viên chưa đúng định dạng (ví dụ: SE192621).';
  }

  const namVao = docNam(b.namNhapHoc);
  if (b.namNhapHoc.trim() !== '' && (namVao === null || namVao < NAM_SOM_NHAT || namVao > namHienTai)) {
    loiTruong.namNhapHoc = `Năm nhập học từ ${NAM_SOM_NHAT} đến ${namHienTai}.`;
  }

  const namRa = docNam(b.namTotNghiep);
  if (b.daTotNghiep && b.namTotNghiep.trim() !== '') {
    if (namRa === null || namRa < NAM_SOM_NHAT || namRa > namHienTai) {
      loiTruong.namTotNghiep = `Năm tốt nghiệp từ ${NAM_SOM_NHAT} đến ${namHienTai}.`;
    } else if (namVao !== null && namRa < namVao + 2) {
      loiTruong.namTotNghiep = 'Năm tốt nghiệp phải sau năm nhập học ít nhất 2 năm.';
    }
  }

  const thieu = [
    [mssv === '', 'mã số sinh viên'],
    [!b.campusId, 'cơ sở'],
    [!b.programId, 'ngành học'],
    [!b.specializationId, 'chuyên ngành'],
    [!b.daTotNghiep && b.hocKy === null, 'học kỳ'],
    [b.namNhapHoc.trim() === '', 'năm nhập học'],
    [b.daTotNghiep && b.namTotNghiep.trim() === '', 'năm tốt nghiệp'],
  ]
    .filter(([thieuMuc]) => thieuMuc)
    .map(([, ten]) => ten);

  const conThieu =
    thieu.length > 0
      ? `Còn thiếu ${thieu.join(', ')}.`
      : Object.keys(loiTruong).length > 0
        ? 'Sửa các ô báo đỏ để tiếp tục.'
        : null;

  return { loiTruong, conThieu };
}

/**
 * Dựng body gửi lên. Chỉ gọi khi `kiemHoSo(...).conThieu === null`.
 *
 * Cựu sinh viên: backend tự ghi học kỳ 9 bất kể gửi gì (`resolveSemester`), nên
 * gửi 9 cho khớp. Còn học: bỏ năm tốt nghiệp — gửi kèm một năm cũ còn sót trong
 * ô sẽ bị backend kiểm và có thể từ chối oan.
 */
export function taoYeuCauHoSo(b: BanNhapHoSo): StudentProfileRequest {
  const ten = b.ten.trim();
  const gioiThieu = b.gioiThieu.trim();
  return {
    studentCode: b.mssv.trim().toUpperCase(),
    displayName: ten === '' ? null : ten,
    campusId: b.campusId ?? '',
    programId: b.programId ?? '',
    specializationId: b.specializationId ?? '',
    semester: b.daTotNghiep ? 9 : (b.hocKy ?? 0),
    intakeYear: Number(b.namNhapHoc.trim()),
    isAlumni: b.daTotNghiep,
    graduationYear: b.daTotNghiep ? Number(b.namTotNghiep.trim()) : null,
    bio: gioiThieu === '' ? null : gioiThieu,
  };
}
