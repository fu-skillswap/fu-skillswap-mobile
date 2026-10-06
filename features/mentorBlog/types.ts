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
 * `MentorBlogPostCreateRequest.java`.
 *
 * `MentorBlogService.apply()` ghi đè MỌI trường không điều kiện: thiếu
 * `categoryIds`/`tagIds` là XOÁ hết danh mục/thẻ, thiếu `coverAssetId`/`ogAssetId`
 * là xoá ảnh bìa/ảnh OG. Vì vậy danh mục và thẻ là trường BẮT BUỘC ở đây (gửi lại
 * đúng id đang có), còn hai id ảnh app không có cách nào biết — response không
 * trả chúng — nên bài có ảnh không được sửa trên mobile (xem `lyDoKhongSuaDuoc`).
 */
export interface MentorBlogPostCreateRequest {
  title: string;
  excerpt: string | null;
  contentMarkdown: string | null;
  visibility: BlogVisibility;
  /** Gửi lại id danh mục đang có; mảng rỗng = bài không có danh mục */
  categoryIds: string[];
  /** Gửi lại id thẻ đang có; mảng rỗng = bài không có thẻ */
  tagIds: string[];
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
