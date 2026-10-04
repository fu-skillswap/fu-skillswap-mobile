/**
 * @file dangKyMentor.ts
 * @description Luật thuần (không React) của màn Đăng ký làm Mentor: bản nháp
 * form, nạp từ hồ sơ có sẵn, kiểm từng bước, dựng body, đọc trạng thái hồ sơ.
 *
 * Luật kiểm theo BACKEND (`MentorProfileUpsertRequest`, `MentorProfileService`,
 * `MentorFeaturedProjectRequest`, `MentorAchievementRequest`,
 * `MentorVerificationService`) — xem JSDoc đầu `types.ts` về ba chỗ bản web lệch.
 */

import type { MentorProfileResponse } from '@/features/mentorMode/types';
import type {
  MentorAchievementRequest,
  MentorFeaturedProjectRequest,
  MentorProfileUpsertRequest,
  MentorVerificationRequestResponse,
  VerificationDocumentType,
} from '@/features/mentorRegistration/types';

/** Sáu bước, đúng thứ tự và tên của thiết kế (`MentorRegistration.dc.html`) và của web */
export const BUOC = [
  'Thông tin cơ bản',
  'Môn học chuyên môn',
  'Thành tích',
  'Dự án tiêu biểu',
  'Mức độ hỗ trợ',
  'Thời gian nhận booking',
] as const;

/** `@Min(1) @Max(4)` của ba mức hỗ trợ */
export const MUC_HO_TRO = [1, 2, 3, 4] as const;

/** Tên ba mức hỗ trợ, như nhãn của web */
export const NHOM_HO_TRO = [
  { truong: 'mucNenTang', nhan: 'Kiến thức căn bản' },
  { truong: 'mucReview', nhan: 'Review đồ án / code' },
  { truong: 'mucDinhHuong', nhan: 'Định hướng phát triển' },
] as const;

export const SDT_HOP_LE = /^0(3|5|7|8|9)\d{8}$/;
export const MON_TOI_DA = 20;
export const CHUYEN_MON_TOI_DA = 3;
/** `@Max(15 * 1024 * 1024)` của `sizeBytes` */
export const TEP_TOI_DA = 15 * 1024 * 1024;
export const LOAI_TEP = ['image/jpeg', 'image/png', 'application/pdf'] as const;

export interface MonHoc {
  khoa: string;
  ma: string;
  ten: string;
  diem: string;
}

export interface DuAn {
  khoa: string;
  /** `null` = chưa có trên server */
  id: string | null;
  tieuDe: string;
  vaiTro: string;
  moTa: string;
  lienKet: string;
}

export interface ThanhTich {
  khoa: string;
  id: string | null;
  tieuDe: string;
  moTa: string;
  /** `dd/mm/yyyy` như người dùng gõ */
  ngay: string;
  tieuDeSanPham: string;
  moTaSanPham: string;
  lienKet: string;
}

/** Một tệp đã chọn trên máy, chưa tải lên */
export interface TepChon {
  khoa: string;
  ten: string;
  uri: string;
  contentType: string;
  kichThuoc: number;
}

export type MucHoTro = (typeof MUC_HO_TRO)[number];

export interface BanNhapMentor {
  tieuDe: string;
  moTaChuyenMon: string;
  sdt: string;
  github: string;
  portfolio: string;
  monHoc: MonHoc[];
  thanhTich: ThanhTich[];
  duAn: DuAn[];
  mucNenTang: number | null;
  mucReview: number | null;
  mucDinhHuong: number | null;
  nhanLich: boolean;
  baoTruocPhut: string;
  hanMoNgay: string;
  dongY: boolean;
  /** Id dự án / thành tích đã có trên server mà người dùng bấm xoá — xoá khi gửi */
  xoaDuAn: string[];
  xoaThanhTich: string[];
  tepFptu: TepChon | null;
  tepChuyenMon: TepChon[];
}

let demKhoa = 0;
/** Khoá cục bộ cho dòng mới trong danh sách (không gửi lên server) */
export function khoaMoi(): string {
  demKhoa += 1;
  return `k${demKhoa}`;
}

function hai(n: number): string {
  return String(n).padStart(2, '0');
}

/** `"2025-06-01"` → `"01/06/2025"`; chuỗi khác thì rỗng */
export function localDateThanhNgay(wire: string | null | undefined): string {
  const k = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wire ?? '');
  return k ? `${k[3]}/${k[2]}/${k[1]}` : '';
}

/** `"01/06/2025"` → `"2025-06-01"`; ngày không có thật thì `null` */
export function ngayThanhLocalDate(chuoi: string): string | null {
  const k = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(chuoi.trim());
  if (!k) {
    return null;
  }
  const [ngay, thang, nam] = [Number(k[1]), Number(k[2]), Number(k[3])];
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  if (d.getUTCFullYear() !== nam || d.getUTCMonth() !== thang - 1 || d.getUTCDate() !== ngay) {
    return null;
  }
  return `${nam}-${hai(thang)}-${hai(ngay)}`;
}

export function monHocRong(): MonHoc {
  return { khoa: khoaMoi(), ma: '', ten: '', diem: '' };
}
export function duAnRong(): DuAn {
  return { khoa: khoaMoi(), id: null, tieuDe: '', vaiTro: '', moTa: '', lienKet: '' };
}
export function thanhTichRong(): ThanhTich {
  return { khoa: khoaMoi(), id: null, tieuDe: '', moTa: '', ngay: '', tieuDeSanPham: '', moTaSanPham: '', lienKet: '' };
}

/** Nạp form từ hồ sơ mentor (đã có hoặc `exists: false`) */
export function banNhapTuHoSo(hoSo: MentorProfileResponse | null): BanNhapMentor {
  const co = hoSo?.exists ? hoSo : null;
  return {
    tieuDe: co?.headline ?? '',
    moTaChuyenMon: co?.expertiseDescription ?? '',
    sdt: co?.phoneNumber ?? '',
    github: co?.githubUrl ?? '',
    portfolio: co?.portfolioUrl ?? '',
    monHoc: (co?.subjectResults ?? []).map((m) => ({
      khoa: khoaMoi(),
      ma: m.subjectCode ?? '',
      ten: m.subjectName ?? '',
      diem: m.scoreValue != null ? String(m.scoreValue) : '',
    })),
    thanhTich: (co?.achievements ?? []).map((a) => ({
      khoa: khoaMoi(),
      id: a.id,
      tieuDe: a.title ?? '',
      moTa: a.awardDescription ?? '',
      ngay: localDateThanhNgay(a.achievedAt),
      tieuDeSanPham: a.productHeader ?? '',
      moTaSanPham: a.productDescription ?? '',
      lienKet: a.demoUrl ?? '',
    })),
    duAn: (co?.featuredProjects ?? []).map((p) => ({
      khoa: khoaMoi(),
      id: p.id,
      tieuDe: p.title ?? '',
      vaiTro: p.content ?? '',
      moTa: p.projectDescription ?? '',
      lienKet: p.liveDemoUrl ?? '',
    })),
    mucNenTang: co?.foundationSupportLevel ?? null,
    mucReview: co?.outputReviewSupportLevel ?? null,
    mucDinhHuong: co?.directionSupportLevel ?? null,
    // Hồ sơ mới: mặc định sẵn sàng nhận lịch như web. `exists: false` vẫn có
    // policy mặc định của backend (`MentorBookingPolicySnapshot`).
    nhanLich: co ? co.isAvailable : true,
    baoTruocPhut: hoSo ? String(hoSo.minimumBookingLeadTimeMinutes) : '',
    hanMoNgay: hoSo ? String(hoSo.maximumBookingHorizonDays) : '',
    dongY: false,
    xoaDuAn: [],
    xoaThanhTich: [],
    tepFptu: null,
    tepChuyenMon: [],
  };
}

function laLienKet(s: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(s.trim());
}

function soNguyen(s: string): number | null {
  return /^\d+$/.test(s.trim()) ? Number(s.trim()) : null;
}

function docDiem(s: string): number | null {
  const t = s.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/** Số minh chứng ĐANG HIỆU LỰC đã có trên server, theo loại */
export function demTaiLieu(
  hoSo: MentorVerificationRequestResponse | null,
): Record<VerificationDocumentType, number> {
  const ds = (hoSo?.documents ?? []).filter((d) => d.isActive);
  return {
    FPTU_AFFILIATION_PROOF: ds.filter((d) => d.documentType === 'FPTU_AFFILIATION_PROOF').length,
    EXPERTISE_PROOF: ds.filter((d) => d.documentType === 'EXPERTISE_PROOF').length,
  };
}

/** Lỗi theo khoá ô (`tieuDe`, `mon.k3.diem`, `duAn.k5.lienKet`…) */
export type LoiForm = Record<string, string>;

/**
 * Kiểm MỘT bước. Ô trống bắt buộc không báo đỏ ngay — nó vào `conThieu`; ô đã gõ
 * mà sai thì vào `loi`. Bước 2 cần biết minh chứng đã có trên server.
 */
export function kiemBuoc(
  b: BanNhapMentor,
  buoc: number,
  daCo: Record<VerificationDocumentType, number>,
): { loi: LoiForm; conThieu: string | null } {
  const loi: LoiForm = {};
  const thieu: string[] = [];

  if (buoc === 1) {
    const tieuDe = b.tieuDe.trim();
    if (tieuDe === '') thieu.push('tiêu đề chuyên môn');
    else if (tieuDe.length < 5 || tieuDe.length > 200) loi.tieuDe = 'Tiêu đề từ 5 đến 200 ký tự.';
    const moTa = b.moTaChuyenMon.trim();
    if (moTa === '') thieu.push('mô tả kinh nghiệm');
    else if (moTa.length < 10 || moTa.length > 1000) loi.moTaChuyenMon = 'Mô tả từ 10 đến 1000 ký tự.';
    if (b.sdt.trim() === '') thieu.push('số điện thoại');
    else if (!SDT_HOP_LE.test(b.sdt.trim())) loi.sdt = 'Số điện thoại Việt Nam 10 số, ví dụ 0912345678.';
    if (b.github.trim() !== '' && !laLienKet(b.github)) loi.github = 'Đường dẫn phải bắt đầu bằng https://';
    if (b.portfolio.trim() !== '' && !laLienKet(b.portfolio)) loi.portfolio = 'Đường dẫn phải bắt đầu bằng https://';
  }

  if (buoc === 2) {
    if (b.monHoc.length === 0) thieu.push('ít nhất một môn học');
    if (b.monHoc.length > MON_TOI_DA) loi.monHoc = `Tối đa ${MON_TOI_DA} môn.`;
    const daGap = new Set<string>();
    for (const m of b.monHoc) {
      const ma = m.ma.trim().toUpperCase();
      if (ma === '' || m.ten.trim() === '' || m.diem.trim() === '') {
        thieu.push(`mã, tên và điểm của mọi môn`);
      }
      if (ma.length > 80) loi[`mon.${m.khoa}.ma`] = 'Mã môn tối đa 80 ký tự.';
      if (ma !== '' && daGap.has(ma)) loi[`mon.${m.khoa}.ma`] = 'Mã môn bị trùng.';
      daGap.add(ma);
      if (m.ten.trim().length > 200) loi[`mon.${m.khoa}.ten`] = 'Tên môn tối đa 200 ký tự.';
      const diem = docDiem(m.diem);
      if (m.diem.trim() !== '' && (diem === null || diem > 10)) loi[`mon.${m.khoa}.diem`] = 'Điểm từ 0 đến 10.';
    }
    const fptu = daCo.FPTU_AFFILIATION_PROOF + (b.tepFptu ? 1 : 0);
    const chuyenMon = daCo.EXPERTISE_PROOF + b.tepChuyenMon.length;
    if (fptu === 0) thieu.push('minh chứng sinh viên FPTU');
    if (chuyenMon === 0) thieu.push('minh chứng chuyên môn');
    if (chuyenMon > CHUYEN_MON_TOI_DA) loi.tepChuyenMon = `Tối đa ${CHUYEN_MON_TOI_DA} minh chứng chuyên môn.`;
  }

  if (buoc === 3) {
    for (const t of b.thanhTich) {
      if (t.tieuDe.trim() === '') thieu.push('tên của mọi thành tích');
      if (t.tieuDe.trim().length > 200) loi[`thanhTich.${t.khoa}.tieuDe`] = 'Tên tối đa 200 ký tự.';
      if (t.ngay.trim() !== '' && !ngayThanhLocalDate(t.ngay)) loi[`thanhTich.${t.khoa}.ngay`] = 'Ngày theo dạng dd/mm/yyyy.';
      if (t.lienKet.trim() !== '' && !laLienKet(t.lienKet)) loi[`thanhTich.${t.khoa}.lienKet`] = 'Đường dẫn phải bắt đầu bằng https://';
    }
  }

  if (buoc === 4) {
    for (const d of b.duAn) {
      if (d.tieuDe.trim() === '') thieu.push('tên của mọi dự án');
      if (d.tieuDe.trim().length > 200) loi[`duAn.${d.khoa}.tieuDe`] = 'Tên tối đa 200 ký tự.';
      if (d.vaiTro.trim().length > 2000) loi[`duAn.${d.khoa}.vaiTro`] = 'Tối đa 2000 ký tự.';
      if (d.moTa.trim().length > 2000) loi[`duAn.${d.khoa}.moTa`] = 'Tối đa 2000 ký tự.';
      if (d.lienKet.trim() !== '' && !laLienKet(d.lienKet)) loi[`duAn.${d.khoa}.lienKet`] = 'Đường dẫn phải bắt đầu bằng https://';
    }
  }

  if (buoc === 5) {
    for (const n of NHOM_HO_TRO) {
      if (b[n.truong] === null) thieu.push(`mức ${n.nhan.toLowerCase()}`);
    }
  }

  if (buoc === 6) {
    const baoTruoc = soNguyen(b.baoTruocPhut);
    if (b.baoTruocPhut.trim() === '') thieu.push('thời gian báo trước');
    else if (baoTruoc === null) loi.baoTruocPhut = 'Nhập số phút, ví dụ 120.';
    const han = soNguyen(b.hanMoNgay);
    if (b.hanMoNgay.trim() === '') thieu.push('hạn mở lịch');
    else if (han === null || han < 1) loi.hanMoNgay = 'Nhập số ngày, ít nhất 1.';
    if (!b.dongY) thieu.push('đồng ý điều khoản');
  }

  const duyNhat = [...new Set(thieu)];
  return {
    loi,
    conThieu: duyNhat.length > 0 ? `Còn thiếu ${duyNhat.join(', ')}.` : Object.keys(loi).length > 0 ? 'Sửa các ô báo đỏ để tiếp tục.' : null,
  };
}

/** Bước đầu tiên chưa hợp lệ (1–6), hoặc `null` khi gửi được */
export function buocChuaXong(b: BanNhapMentor, daCo: Record<VerificationDocumentType, number>): number | null {
  for (let i = 1; i <= BUOC.length; i += 1) {
    if (kiemBuoc(b, i, daCo).conThieu !== null) {
      return i;
    }
  }
  return null;
}

function hoacNull(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

export function taoYeuCauHoSoMentor(b: BanNhapMentor): MentorProfileUpsertRequest {
  return {
    headline: b.tieuDe.trim(),
    expertiseDescription: b.moTaChuyenMon.trim(),
    isAvailable: b.nhanLich,
    subjectResults: b.monHoc.map((m) => ({
      subjectCode: m.ma.trim().toUpperCase(),
      subjectName: m.ten.trim(),
      scoreValue: docDiem(m.diem) ?? 0,
    })),
    foundationSupportLevel: b.mucNenTang ?? 1,
    outputReviewSupportLevel: b.mucReview ?? 1,
    directionSupportLevel: b.mucDinhHuong ?? 1,
    githubUrl: hoacNull(b.github),
    portfolioUrl: hoacNull(b.portfolio),
    phoneNumber: b.sdt.trim(),
    minimumBookingLeadTimeMinutes: soNguyen(b.baoTruocPhut) ?? 0,
    maximumBookingHorizonDays: soNguyen(b.hanMoNgay) ?? 1,
    bookingTimezone: 'Asia/Ho_Chi_Minh',
  };
}

export function taoYeuCauDuAn(d: DuAn): MentorFeaturedProjectRequest {
  return {
    title: d.tieuDe.trim(),
    content: hoacNull(d.vaiTro),
    projectDescription: hoacNull(d.moTa),
    liveDemoUrl: hoacNull(d.lienKet),
  };
}

export function taoYeuCauThanhTich(t: ThanhTich): MentorAchievementRequest {
  return {
    title: t.tieuDe.trim(),
    awardDescription: hoacNull(t.moTa),
    achievedAt: ngayThanhLocalDate(t.ngay),
    productHeader: hoacNull(t.tieuDeSanPham),
    productDescription: hoacNull(t.moTaSanPham),
    demoUrl: hoacNull(t.lienKet),
  };
}

/**
 * Trạng thái hồ sơ nhìn từ màn hình:
 * - `soan`: chưa nộp, đã rút, cần bổ sung hoặc bị từ chối → sửa và nộp được.
 * - `cho-duyet`: đang chờ admin → chỉ xem, có thể rút.
 * - `da-duyet`: đã là mentor.
 */
export type TinhTrangDangKy = 'soan' | 'cho-duyet' | 'da-duyet';

export function tinhTrangDangKy(
  hoSo: MentorVerificationRequestResponse | null,
  mentor: MentorProfileResponse | null,
): TinhTrangDangKy {
  if (hoSo?.status === 'APPROVED' || mentor?.mentorStatus === 'ACTIVE') {
    return 'da-duyet';
  }
  if (hoSo?.status === 'PENDING_REVIEW') {
    return 'cho-duyet';
  }
  return 'soan';
}
