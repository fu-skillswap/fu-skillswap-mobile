/**
 * @file types.ts
 * @description DTO blog của mentor, port từ source Java (`modules/blog/dto/...`,
 * `domain/BlogVisibility.java`, `domain/BlogPostStatus.java`).
 *
 * Bản web (`views/mentor/posts`) dùng BLOG cho "Bài viết của tôi" chứ không dùng
 * diễn đàn, nên app làm theo. Đây là các `record` Java: khoá JSON đúng tên thành
 * phần, kể cả `boolean slugLocked`/`featured` (record không có tiền tố `is`).
 * Mốc thời gian là `LocalDateTime` — không offset.
 */

/** `BlogVisibility.java` */
export type BlogVisibility = 'PUBLIC' | 'AUTHENTICATED' | 'BOOKED_MEMBERS';

/** `BlogPostStatus.java` */
export type BlogPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** `BlogCategoryResponse.java` / `BlogTagResponse.java` — app chỉ đọc tên */
export interface BlogLabelResponse {
  id: string;
  name?: string;
}

/** `MentorBlogPostDetailResponse.java` */
export interface MentorBlogPostDetailResponse {
  id: string;
  title: string;
  slug: string | null;
  slugLocked: boolean;
  excerpt: string | null;
  contentMarkdown: string | null;
  coverImageUrl: string | null;
  ogImageUrl: string | null;
  visibility: BlogVisibility;
  status: BlogPostStatus;
  categories: BlogLabelResponse[];
  tags: BlogLabelResponse[];
  entitledServiceIds: string[];
  featured: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** `Integer` — gửi lại làm `expectedVersion` khi sửa/đăng/lưu trữ */
  version: number;
}

/**
 * `MentorBlogPostCreateRequest.java`. App không gửi ảnh bìa, danh mục hay thẻ —
 * bản web cũng không; backend nhận `null` cho các trường đó.
 */
export interface MentorBlogPostCreateRequest {
  title: string;
  excerpt: string | null;
  contentMarkdown: string | null;
  visibility: BlogVisibility;
  /** BẮT BUỘC có ít nhất một khi `visibility = BOOKED_MEMBERS` (luật lúc đăng) */
  entitledServiceIds: string[];
}

/** `MentorBlogPostUpdateRequest.java` */
export interface MentorBlogPostUpdateRequest extends MentorBlogPostCreateRequest {
  expectedVersion: number;
}

/** `BlogExpectedVersionRequest.java` */
export interface BlogExpectedVersionRequest {
  expectedVersion: number;
}
