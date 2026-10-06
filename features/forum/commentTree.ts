/**
 * @file commentTree.ts
 * @description Luật 1 cấp của bình luận và nhận diện bình luận của bot AI.
 *
 * Backend áp cấu trúc 1 cấp: bình luận gốc → các reply. Danh sách bình luận của
 * bài chỉ chứa GỐC; reply lấy riêng theo từng gốc (`useCommentReplies`). Reply
 * vào một reply bị từ chối `400`, nên khi người dùng bấm trả lời một reply, FE
 * vẫn phải gửi `replyToCommentId` là ID của bình luận GỐC.
 */

import { getEnv } from '@/core/config/env';
import type { ForumCommentResponse } from '@/features/forum/types';

/**
 * Bình luận này có phải do bot "SkillSwap AI" viết không.
 *
 * Backend không đánh dấu bot trong DTO — bot chỉ là một tài khoản thường, và
 * chính AI service cũng nhận ra bài của mình bằng cách so `authorUserId` với
 * cấu hình `FORUM_BOT_USER_ID`. Nếu biến môi trường để rỗng thì không bình
 * luận nào được gắn badge: thiếu badge còn hơn gắn nhầm "AI" lên bình luận
 * của người thật.
 */
export function isBotComment(comment: ForumCommentResponse): boolean {
  const botUserId = getEnv().forumBotUserId;
  return botUserId !== '' && comment.authorUserId === botUserId;
}

/**
 * Xác định `replyToCommentId` phải gửi lên khi trả lời một bình luận.
 *
 * Backend chỉ hỗ trợ 1 cấp: trả lời một reply vẫn phải trỏ về bình luận GỐC,
 * nếu không sẽ nhận `400` "Chỉ hỗ trợ trả lời bình luận 1 cấp" (forum.md §4.3).
 * Đây là nơi DUY NHẤT biết luật này — màn hình không được tự nhớ, vì chỗ người
 * dùng bấm "Trả lời" trên một reply nhìn giống hệt chỗ bấm trên bình luận gốc.
 */
export function resolveReplyTarget(comment: ForumCommentResponse): string {
  return comment.replyToCommentId ?? comment.commentId;
}
