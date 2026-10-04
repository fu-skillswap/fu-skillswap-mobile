/**
 * @file baiViet.ts
 * @description Luật thuần của màn bài viết: lọc/sắp danh sách, đếm, kiểm form và
 * dựng body. Chép từ bản web (`useMentorPosts`, `mentorPostSchema`) và từ luật
 * của backend (`MentorBlogService`, `BlogContentPolicy`).
 */

import { docLocalDateTime } from '@/core/time/localDateTime';
import type {
  BlogVisibility,
  MentorBlogPostCreateRequest,
  MentorBlogPostDetailResponse,
} from '@/features/mentorBlog/types';

/** `@Size(max = 220)` của `title` */
export const TIEU_DE_TOI_DA = 220;
/** Giới hạn của form web (`mentorPostSchema`) */
export const MO_TA_TOI_DA = 500;

/** Đúng ba lựa chọn và nhãn của bản web */
export const PHAM_VI: { value: BlogVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Công khai' },
  { value: 'AUTHENTICATED', label: 'Người dùng đã đăng nhập' },
  { value: 'BOOKED_MEMBERS', label: 'Mentee đã đặt dịch vụ' },
];

export function nhanPhamVi(v: BlogVisibility): string {
  return PHAM_VI.find((p) => p.value === v)?.label ?? 'Công khai';
}

/** Khoá so sánh được của một `LocalDateTime`; không đọc được thì xếp cuối */
function khoaThoiGian(wire: string | null): number {
  const m = docLocalDateTime(wire);
  return m ? Date.UTC(m.nam, m.thang - 1, m.ngay, m.gio, m.phut, m.giay) : 0;
}

/**
 * Bài đang hoạt động, mới sửa nhất trước — như web: bài ĐÃ LƯU TRỮ không hiện
 * (lưu trữ chính là "xoá khỏi danh sách" của web).
 */
export function baiDangHoatDong(ds: readonly MentorBlogPostDetailResponse[]): MentorBlogPostDetailResponse[] {
  return ds.filter((b) => b.status !== 'ARCHIVED').sort((a, b) => khoaThoiGian(b.updatedAt) - khoaThoiGian(a.updatedAt));
}

export function demBaiViet(ds: readonly MentorBlogPostDetailResponse[]): { daDang: number; banNhap: number } {
  return {
    daDang: ds.filter((b) => b.status === 'PUBLISHED').length,
    banNhap: ds.filter((b) => b.status === 'DRAFT').length,
  };
}

export interface BanNhapBaiViet {
  tieuDe: string;
  moTa: string;
  noiDung: string;
  phamVi: BlogVisibility;
  dichVu: string[];
}

export function banNhapRong(): BanNhapBaiViet {
  return { tieuDe: '', moTa: '', noiDung: '', phamVi: 'PUBLIC', dichVu: [] };
}

export function banNhapTuBai(b: MentorBlogPostDetailResponse): BanNhapBaiViet {
  return {
    tieuDe: b.title,
    moTa: b.excerpt ?? '',
    noiDung: b.contentMarkdown ?? '',
    phamVi: b.visibility,
    dichVu: b.entitledServiceIds ?? [],
  };
}

/** Bỏ khối code ``` rồi tìm `<`/`>` — đúng cách `BlogContentPolicy` làm */
function coHtml(markdown: string): boolean {
  return /[<>]/.test(markdown.replace(/```[\s\S]*?```/g, ''));
}

export interface KiemBaiViet {
  /** Lỗi chặn cả "Lưu bản nháp" lẫn "Đăng bài" */
  loiLuu: string | null;
  /** Lỗi chỉ chặn "Đăng bài" — bản nháp vẫn lưu được */
  loiDang: string | null;
}

export function kiemBaiViet(b: BanNhapBaiViet): KiemBaiViet {
  let loiLuu: string | null = null;
  if (b.tieuDe.trim() === '') {
    loiLuu = 'Vui lòng nhập tiêu đề bài viết.';
  } else if (b.tieuDe.trim().length > TIEU_DE_TOI_DA) {
    loiLuu = `Tiêu đề tối đa ${TIEU_DE_TOI_DA} ký tự.`;
  } else if (b.moTa.trim().length > MO_TA_TOI_DA) {
    loiLuu = `Mô tả ngắn tối đa ${MO_TA_TOI_DA} ký tự.`;
  } else if (coHtml(b.noiDung)) {
    loiLuu = 'Nội dung không được chứa ký tự < hoặc > (ngoài khối code).';
  }

  let loiDang: string | null = loiLuu;
  if (!loiDang && b.noiDung.trim() === '') {
    loiDang = 'Cần có nội dung trước khi đăng.';
  } else if (!loiDang && b.phamVi === 'BOOKED_MEMBERS' && b.dichVu.length === 0) {
    loiDang = 'Chọn ít nhất một dịch vụ để mentee đã đặt được xem bài.';
  }
  return { loiLuu, loiDang };
}

export function taoYeuCauBaiViet(b: BanNhapBaiViet): MentorBlogPostCreateRequest {
  const moTa = b.moTa.trim();
  const noiDung = b.noiDung.trim();
  return {
    title: b.tieuDe.trim(),
    excerpt: moTa === '' ? null : moTa,
    contentMarkdown: noiDung === '' ? null : noiDung,
    visibility: b.phamVi,
    // Đổi khỏi "Mentee đã đặt dịch vụ" thì không gửi dịch vụ đã chọn trước đó.
    entitledServiceIds: b.phamVi === 'BOOKED_MEMBERS' ? b.dichVu : [],
  };
}
