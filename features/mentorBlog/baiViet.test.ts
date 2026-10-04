import { baiDangHoatDong, banNhapRong, demBaiViet, kiemBaiViet, taoYeuCauBaiViet } from '@/features/mentorBlog/baiViet';
import type { MentorBlogPostDetailResponse } from '@/features/mentorBlog/types';

function bai(id: string, ghiDe: Partial<MentorBlogPostDetailResponse> = {}): MentorBlogPostDetailResponse {
  return {
    id,
    title: id,
    slug: null,
    slugLocked: false,
    excerpt: null,
    contentMarkdown: null,
    coverImageUrl: null,
    ogImageUrl: null,
    visibility: 'PUBLIC',
    status: 'DRAFT',
    categories: [],
    tags: [],
    entitledServiceIds: [],
    featured: false,
    publishedAt: null,
    createdAt: null,
    updatedAt: '2026-10-01T10:00:00',
    version: 0,
    ...ghiDe,
  };
}

describe('danh sách', () => {
  it('bỏ bài đã lưu trữ, sắp mới sửa nhất trước, đếm đúng hai loại', () => {
    const ds = baiDangHoatDong([
      bai('cu', { updatedAt: '2026-09-01T08:00:00', status: 'PUBLISHED' }),
      bai('luu-tru', { status: 'ARCHIVED', updatedAt: '2026-10-04T08:00:00' }),
      bai('moi', { updatedAt: '2026-10-03T08:00' }),
    ]);

    expect(ds.map((b) => b.id)).toEqual(['moi', 'cu']);
    expect(demBaiViet(ds)).toEqual({ daDang: 1, banNhap: 1 });
  });
});

describe('kiemBaiViet', () => {
  const du = { ...banNhapRong(), tieuDe: 'Tiêu đề', noiDung: 'Nội dung' };

  it('đủ thì lưu và đăng đều được', () => {
    expect(kiemBaiViet(du)).toEqual({ loiLuu: null, loiDang: null });
  });

  it('thiếu tiêu đề thì chặn cả hai nút', () => {
    expect(kiemBaiViet({ ...du, tieuDe: '  ' }).loiLuu).toBe('Vui lòng nhập tiêu đề bài viết.');
    expect(kiemBaiViet({ ...du, tieuDe: '  ' }).loiDang).not.toBeNull();
  });

  it('chưa có nội dung vẫn lưu nháp được, nhưng chưa đăng được', () => {
    expect(kiemBaiViet({ ...du, noiDung: '' })).toEqual({ loiLuu: null, loiDang: 'Cần có nội dung trước khi đăng.' });
  });

  it('HTML bị chặn như backend, nhưng trong khối code thì được', () => {
    expect(kiemBaiViet({ ...du, noiDung: 'xin <b>chào</b>' }).loiLuu).toMatch(/< hoặc >/);
    expect(kiemBaiViet({ ...du, noiDung: '```\nif (a < b) {}\n```' }).loiLuu).toBeNull();
  });

  it('"Mentee đã đặt dịch vụ" phải chọn ít nhất một dịch vụ mới đăng được', () => {
    const b = { ...du, phamVi: 'BOOKED_MEMBERS' as const };
    expect(kiemBaiViet(b).loiDang).toMatch(/ít nhất một dịch vụ/);
    expect(kiemBaiViet({ ...b, dichVu: ['msv1'] }).loiDang).toBeNull();
  });

  it('tiêu đề quá 220 ký tự bị chặn', () => {
    expect(kiemBaiViet({ ...du, tieuDe: 'a'.repeat(221) }).loiLuu).toMatch(/220/);
  });
});

describe('taoYeuCauBaiViet', () => {
  it('chuỗi rỗng thành null, cắt khoảng trắng', () => {
    expect(taoYeuCauBaiViet({ ...banNhapRong(), tieuDe: ' A ', moTa: ' ', noiDung: '' })).toEqual({
      title: 'A',
      excerpt: null,
      contentMarkdown: null,
      visibility: 'PUBLIC',
      entitledServiceIds: [],
    });
  });

  it('đổi khỏi "Mentee đã đặt dịch vụ" thì không gửi dịch vụ đã chọn trước', () => {
    expect(taoYeuCauBaiViet({ ...banNhapRong(), tieuDe: 'A', phamVi: 'PUBLIC', dichVu: ['msv1'] }).entitledServiceIds).toEqual([]);
    expect(
      taoYeuCauBaiViet({ ...banNhapRong(), tieuDe: 'A', phamVi: 'BOOKED_MEMBERS', dichVu: ['msv1'] }).entitledServiceIds,
    ).toEqual(['msv1']);
  });
});
