/**
 * @file commentTree.ts
 * @description Dựng cây bình luận 1 cấp và nhận diện bình luận của bot AI.
 *
 * Backend trả mảng phẳng theo thứ tự từ cũ đến mới, và áp cấu trúc 1 cấp:
 * bình luận gốc → các reply. Reply vào một reply bị từ chối `400`, nên khi
 * người dùng bấm trả lời một reply, FE vẫn phải gửi `replyToCommentId` là ID
 * của bình luận GỐC.
 */

import { getEnv } from '@/core/config/env';
import type { ForumCommentResponse } from '@/features/forum/types';

/** Một bình luận gốc kèm các reply của nó */
export interface ThreadedComment extends ForumCommentResponse {
  replies: ForumCommentResponse[];
}

/**
 * Gom mảng phẳng thành danh sách bình luận gốc kèm reply.
 *
 * Reply mồ côi — có `replyToCommentId` nhưng không tìm thấy gốc trong danh sách
 * đang có — được nâng lên thành bình luận gốc thay vì bị bỏ đi: bình luận phân
 * trang theo cursor nên gốc của nó có thể nằm ở trang trước.
 *
 * Lưu ý về thứ tự: reply mồ côi được nâng lên luôn nằm SAU mọi bình luận gốc
 * thật, không giữ đúng vị trí thời gian của nó trong mảng backend trả về. Đây
 * là đánh đổi có chủ ý để chỉ duyệt một lượt; đừng giả định thứ tự gốc trả về
 * luôn là thứ tự createdAt.
 */
export function buildCommentTree(comments: ForumCommentResponse[]): ThreadedComment[] {
  const roots: ThreadedComment[] = [];
  const rootById = new Map<string, ThreadedComment>();
  const pendingReplies: ForumCommentResponse[] = [];

  for (const comment of comments) {
    if (comment.replyToCommentId) {
      pendingReplies.push(comment);
      continue;
    }
    const root: ThreadedComment = { ...comment, replies: [] };
    roots.push(root);
    rootById.set(root.commentId, root);
  }

  for (const reply of pendingReplies) {
    const root = reply.replyToCommentId ? rootById.get(reply.replyToCommentId) : undefined;
    if (root) {
      root.replies.push(reply);
    } else {
      roots.push({ ...reply, replies: [] });
    }
  }

  return roots;
}

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
