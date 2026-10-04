/**
 * @file handlers.ts
 * @description Handler MSW cho blog của mentor (`/api/me/blog/posts`), đúng hình
 * dạng `MentorBlogPostDetailResponse` và đúng các luật của `MentorBlogService`:
 * sửa/đăng/lưu trữ đòi `expectedVersion` khớp (sai → 409), đăng đòi có nội dung
 * và bài "Mentee đã đặt dịch vụ" phải gắn ít nhất một dịch vụ (→ 400).
 */

import { http } from 'msw';

import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import type {
  BlogExpectedVersionRequest,
  MentorBlogPostCreateRequest,
  MentorBlogPostDetailResponse,
  MentorBlogPostUpdateRequest,
} from '@/features/mentorBlog/types';

const base = getEnv().apiUrl;

function envelope(data: unknown) {
  return { timestamp: new Date().toISOString(), status: 200, code: 'SUCCESS', message: 'OK', data };
}

function loi(status: number, code: string, message: string) {
  return jsonMock({ timestamp: new Date().toISOString(), status, code, message, data: null }, { status });
}

/** `LocalDateTime` không offset, cách "bây giờ" `phutTruoc` phút */
function ldt(phutTruoc: number): string {
  return new Date(Date.now() + 7 * 3_600_000 - phutTruoc * 60_000).toISOString().slice(0, 19);
}

function bai(ghiDe: Partial<MentorBlogPostDetailResponse> & Pick<MentorBlogPostDetailResponse, 'id' | 'title'>): MentorBlogPostDetailResponse {
  return {
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
    createdAt: ldt(60 * 24 * 7),
    updatedAt: ldt(60 * 24 * 7),
    version: 0,
    ...ghiDe,
  };
}

function taoKho(): MentorBlogPostDetailResponse[] {
  return [
    bai({
      id: 'bp1',
      title: '3 lỗi sai phổ biến nhất trên CV vị trí Product Manager',
      excerpt: 'Liệt kê trách nhiệm thay vì kết quả, thiếu con số chứng minh tác động, và dùng quá nhiều thuật ngữ.',
      contentMarkdown: '## 1. Liệt kê trách nhiệm\n\nHãy viết kết quả đạt được.',
      status: 'PUBLISHED',
      slug: '3-loi-sai-cv-pm',
      slugLocked: true,
      publishedAt: ldt(60 * 6),
      updatedAt: ldt(60 * 6),
      version: 2,
    }),
    bai({
      id: 'bp2',
      title: 'Template PRD mình dùng khi làm ở Google',
      excerpt: 'Dành riêng cho các bạn đã học cùng mình.',
      contentMarkdown: 'Nội dung đang viết dở…',
      visibility: 'BOOKED_MEMBERS',
      entitledServiceIds: ['msv1'],
      updatedAt: ldt(60 * 24 * 3),
      version: 1,
    }),
    bai({ id: 'bp3', title: 'Bài cũ đã lưu trữ', status: 'ARCHIVED', version: 3 }),
  ];
}

let MOCK_BAI = taoKho();
let dem = 0;

/** Đưa kho về ban đầu — chỉ dùng trong test */
export function __resetMentorBlogMockForTests(): void {
  MOCK_BAI = taoKho();
  dem = 0;
}

function timBai(id: unknown): MentorBlogPostDetailResponse | undefined {
  return MOCK_BAI.find((b) => b.id === id);
}

function ghi(moi: MentorBlogPostDetailResponse): MentorBlogPostDetailResponse {
  MOCK_BAI = MOCK_BAI.some((b) => b.id === moi.id) ? MOCK_BAI.map((b) => (b.id === moi.id ? moi : b)) : [moi, ...MOCK_BAI];
  return moi;
}

function apDung(b: MentorBlogPostDetailResponse, yc: MentorBlogPostCreateRequest): MentorBlogPostDetailResponse {
  return {
    ...b,
    title: yc.title.trim(),
    excerpt: yc.excerpt,
    contentMarkdown: yc.contentMarkdown,
    visibility: yc.visibility ?? 'PUBLIC',
    entitledServiceIds: yc.entitledServiceIds ?? [],
    updatedAt: ldt(0),
  };
}

export const mentorBlogMockHandlers = [
  http.get(`${base}/api/me/blog/posts`, () => jsonMock(envelope(MOCK_BAI))),

  http.post(`${base}/api/me/blog/posts`, async ({ request }) => {
    const yc = (await request.json()) as MentorBlogPostCreateRequest;
    if (!yc.title?.trim()) {
      return loi(400, 'BAD_REQUEST', 'Tiêu đề bài blog không được để trống');
    }
    dem += 1;
    return jsonMock(envelope(ghi(apDung(bai({ id: `bp-moi-${dem}`, title: yc.title, createdAt: ldt(0) }), yc))), { status: 201 });
  }),

  http.post(`${base}/api/me/blog/posts/:postId/publish`, async ({ params, request }) => {
    const b = timBai(params.postId);
    const yc = (await request.json()) as BlogExpectedVersionRequest;
    if (!b) return loi(404, 'NOT_FOUND', 'Không tìm thấy bài blog');
    if (b.version !== yc.expectedVersion) return loi(409, 'BLOG_POST_VERSION_CONFLICT', 'Bài viết vừa được sửa ở nơi khác');
    if (!b.contentMarkdown?.trim()) return loi(400, 'BAD_REQUEST', 'Không thể publish bài chưa có nội dung');
    if (b.visibility === 'BOOKED_MEMBERS' && b.entitledServiceIds.length === 0) {
      return loi(400, 'BAD_REQUEST', 'Bài premium phải gắn ít nhất một dịch vụ');
    }
    return jsonMock(
      envelope(ghi({ ...b, status: 'PUBLISHED', slugLocked: true, publishedAt: b.publishedAt ?? ldt(0), version: b.version + 1 })),
    );
  }),

  http.post(`${base}/api/me/blog/posts/:postId/archive`, async ({ params, request }) => {
    const b = timBai(params.postId);
    const yc = (await request.json()) as BlogExpectedVersionRequest;
    if (!b) return loi(404, 'NOT_FOUND', 'Không tìm thấy bài blog');
    if (b.version !== yc.expectedVersion) return loi(409, 'BLOG_POST_VERSION_CONFLICT', 'Bài viết vừa được sửa ở nơi khác');
    return jsonMock(envelope(ghi({ ...b, status: 'ARCHIVED', featured: false, version: b.version + 1 })));
  }),

  http.get(`${base}/api/me/blog/posts/:postId`, ({ params }) => {
    const b = timBai(params.postId);
    return b ? jsonMock(envelope(b)) : loi(404, 'NOT_FOUND', 'Không tìm thấy bài blog');
  }),

  http.put(`${base}/api/me/blog/posts/:postId`, async ({ params, request }) => {
    const b = timBai(params.postId);
    const yc = (await request.json()) as MentorBlogPostUpdateRequest;
    if (!b) return loi(404, 'NOT_FOUND', 'Không tìm thấy bài blog');
    if (b.version !== yc.expectedVersion) return loi(409, 'BLOG_POST_VERSION_CONFLICT', 'Bài viết vừa được sửa ở nơi khác');
    return jsonMock(envelope(ghi({ ...apDung(b, yc), version: b.version + 1 })));
  }),
];
