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

/**
 * Một bình luận; cấu trúc thảo luận chỉ có 1 cấp.
 *
 * `GET /api/forum/posts/{id}/comments` chỉ trả bình luận GỐC (lọc
 * `replyToCommentId is null` ở `ForumCommentRepositoryImpl`); reply phải lấy
 * riêng qua `GET /api/forum/comments/{commentId}/replies`.
 */
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
  /**
   * Số reply đang hiển thị của bình luận GỐC; reply luôn là 0.
   *
   * Java là `Integer` nhưng constructor của record tự đổi `null` thành 0, nên
   * trên dây luôn có số. Cẩn thận: phản hồi của API thích/bỏ thích bình luận
   * (`ForumReactionService.toCommentResponse`) KHÔNG tính trường này và luôn trả
   * 0 — đắp thẳng nó vào cache là xoá mất nút "Xem N phản hồi".
   */
  replyCount: number;
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

/**
 * Payload tạo bình luận (`POST /api/forum/posts/{postId}/comments`).
 *
 * Giới hạn độ dài là của backend (forum.md §4.3) và giao diện phải chặn TRƯỚC
 * khi gửi: một lần gửi hỏng vẫn tiêu một lượt trong hạn mức 20 bình luận/10 phút.
 */
export interface ForumCommentUpsertRequest {
  /** Bắt buộc, tối đa 2000 ký tự */
  content: string;
  /**
   * Tối đa 1 URL. Giai đoạn này KHÔNG gửi: `forum.md` không mô tả endpoint
   * upload ảnh cho diễn đàn nên không có cách lấy URL hợp lệ mà không bịa.
   */
  imageUrls?: string[];
  /**
   * ID bình luận GỐC nếu đây là reply, `null` nếu là bình luận mới.
   *
   * Luôn lấy qua `resolveReplyTarget`: backend chỉ hỗ trợ 1 cấp và trả `400`
   * "Chỉ hỗ trợ trả lời bình luận 1 cấp" nếu nhận ID của một reply.
   */
  replyToCommentId?: string | null;
}

/** Lý do báo cáo vi phạm (forum.md §6.1) */
export type ForumReportReason = 'SPAM' | 'OFF_TOPIC' | 'HARASSMENT' | 'MISLEADING' | 'OTHER';

/** Payload báo cáo vi phạm (`POST /api/forum/reports`) */
export interface ForumReportCreateRequest {
  targetType: 'POST' | 'COMMENT';
  /** UUID của bài viết hoặc bình luận bị báo cáo */
  targetId: string;
  reasonType: ForumReportReason;
  /** Tối đa 1000 ký tự */
  description?: string;
}
