/**
 * @file types.ts
 * @description DTO diễn đàn, port từ `fu-skillswap-be/docs/frontend-guide/forum.md`.
 * Tên trường giữ nguyên như backend trả về, không đổi sang quy ước khác.
 */

/** Chủ đề thảo luận */
export interface ForumTopicResponse {
  /** UUID, dùng làm `forumTopicId` khi tạo bài hoặc lọc */
  id: string;
  code: 'QUESTION' | 'SHARING' | 'SEARCH' | 'REVIEW';
  nameVi: string;
  nameEn: string;
  displayOrder: number;
}

/** Ngành học của tác giả, backend có thể không trả */
export interface ForumAuthorProgram {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
}

export type ForumPostStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type ForumCommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';

/**
 * Bộ lọc của màn hình danh sách; rỗng nghĩa là xem newsfeed.
 *
 * Đặt ở `types.ts` chứ không ở hook: `queryKeys.ts` cần kiểu này để dựng khoá,
 * còn hook lại import `forumKeys` — để kiểu ở hook sẽ tạo vòng import giữa hai file.
 */
export interface ForumListFilters {
  keyword?: string;
  forumTopicId?: string;
  /** Chỉ lấy bài của chính mình; giai đoạn này repo hỗ trợ sẵn, chưa có màn hình bật nó */
  mine?: boolean;
}

/** Một bài viết trên diễn đàn */
export interface ForumPostResponse {
  postId: string;
  authorUserId: string;
  authorFullName: string;
  authorAvatarUrl: string;
  authorProgram?: ForumAuthorProgram | null;
  forumTopic: ForumTopicResponse;
  title: string;
  content: string;
  status: ForumPostStatus;
  /** Gồm cả bình luận gốc và reply */
  commentCount: number;
  reactionCount: number;
  /** Người dùng thường không cần quan tâm */
  reportCount: number;
  lastActivityAt: string;
  reactedByCurrentUser: boolean;
  myReactionType: 'LIKE' | null;
  createdAt: string;
  updatedAt: string;
  /** Tối đa 4 URL; dùng thẳng, không tự ghép prefix CDN */
  imageUrls: string[];
}

/** Một bình luận; cấu trúc thảo luận chỉ có 1 cấp */
export interface ForumCommentResponse {
  commentId: string;
  postId: string;
  authorUserId: string;
  authorFullName: string;
  authorAvatarUrl: string;
  authorRole: 'MENTEE' | 'MENTOR';
  content: string;
  status: ForumCommentStatus;
  reportCount: number;
  reactionCount: number;
  reactedByCurrentUser: boolean;
  /** UUID bình luận GỐC nếu đây là reply; null nếu là bình luận gốc */
  replyToCommentId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Tối đa 1 URL */
  imageUrls: string[];
}

/**
 * Payload tạo và sửa bài viết (`POST /api/forum/posts`, `PUT /api/forum/posts/{id}`).
 *
 * Giới hạn độ dài là của backend (forum.md §3.5) và giao diện phải chặn TRƯỚC
 * khi gửi: một lần gửi hỏng vẫn tiêu một lượt trong hạn mức 5 bài/10 phút.
 */
export interface ForumPostUpsertRequest {
  /** Bắt buộc, tối đa 200 ký tự */
  title: string;
  /** Bắt buộc, tối đa 5000 ký tự */
  content: string;
  /** UUID chủ đề lấy từ `GET /api/forum/topics` */
  forumTopicId: string;
  /**
   * Tối đa 4 URL. Giai đoạn này KHÔNG gửi: `forum.md` không mô tả endpoint
   * upload ảnh cho diễn đàn, nên không có cách nào lấy URL hợp lệ mà không bịa.
   */
  imageUrls?: string[];
}
