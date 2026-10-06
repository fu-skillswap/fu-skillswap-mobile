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
  /**
   * Id danh mục / thẻ của bài gốc. Mobile không có ô sửa hai thứ này, nhưng
   * PHẢI gửi lại: `MentorBlogService.apply()` coi thiếu là "xoá hết".
   */
  danhMuc: string[];
  the: string[];
}

export function banNhapRong(): BanNhapBaiViet {
  return { tieuDe: '', moTa: '', noiDung: '', phamVi: 'PUBLIC', dichVu: [], danhMuc: [], the: [] };
}

export function banNhapTuBai(b: MentorBlogPostDetailResponse): BanNhapBaiViet {
  return {
    tieuDe: b.title,
    moTa: b.excerpt ?? '',
    noiDung: b.contentMarkdown ?? '',
    phamVi: b.visibility,
    dichVu: b.entitledServiceIds ?? [],
    danhMuc: (b.categories ?? []).map((c) => c.id),
    the: (b.tags ?? []).map((t) => t.id),
  };
}

/**
 * Lý do bài này KHÔNG được sửa trên mobile, hoặc `null` nếu sửa được.
 *
 * - Chỉ bản nháp: bài đã đăng/lưu trữ không có lối sửa trên danh sách, nhưng
 *   vẫn tới được bằng deep link `/mentor-posts/<id>`, và "Lưu bản nháp" trên
 *   bài đã đăng sẽ sửa thẳng bài đang hiển thị công khai.
 * - Bài có ảnh bìa/ảnh OG: `PUT` ghi đè ảnh theo `coverAssetId`/`ogAssetId`,
 *   mà `MentorBlogPostDetailResponse` chỉ trả URL chứ không trả id tài sản —
 *   lưu từ mobile sẽ xoá mất ảnh mà không ai biết.
 */
export function lyDoKhongSuaDuoc(b: MentorBlogPostDetailResponse): string | null {
  if (b.status !== 'DRAFT') {
    return b.status === 'PUBLISHED'
      ? 'Bài này đã đăng. Ứng dụng chỉ sửa được bản nháp — hãy chỉnh sửa bài đã đăng trên bản web.'
      : 'Bài này đã được lưu trữ nên không chỉnh sửa được.';
  }
  if (b.coverImageUrl || b.ogImageUrl) {
    return 'Bản nháp này có ảnh bìa. Ứng dụng chưa giữ được ảnh khi lưu, nên hãy chỉnh sửa bài trên bản web để không mất ảnh.';
  }
  return null;
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
    categoryIds: b.danhMuc,
    tagIds: b.the,
    // Đổi khỏi "Mentee đã đặt dịch vụ" thì không gửi dịch vụ đã chọn trước đó.
    entitledServiceIds: b.phamVi === 'BOOKED_MEMBERS' ? b.dichVu : [],
  };
}
