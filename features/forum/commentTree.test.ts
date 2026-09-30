import { resetEnvCache } from '@/core/config/env';
import { buildCommentTree, isBotComment, resolveReplyTarget } from '@/features/forum/commentTree';
import type { ForumCommentResponse } from '@/features/forum/types';

function comment(
  commentId: string,
  overrides: Partial<ForumCommentResponse> = {},
): ForumCommentResponse {
  return {
    commentId,
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorRole: 'MENTEE',
    content: 'nội dung',
    status: 'VISIBLE',
    reportCount: 0,
    reactionCount: 0,
    reactedByCurrentUser: false,
    replyToCommentId: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

describe('buildCommentTree', () => {
  it('gom reply vào đúng bình luận gốc, giữ thứ tự backend trả về', () => {
    const tree = buildCommentTree([
      comment('c1'),
      comment('r1', { replyToCommentId: 'c1' }),
      comment('c2'),
      comment('r2', { replyToCommentId: 'c1' }),
    ]);

    expect(tree.map((c) => c.commentId)).toEqual(['c1', 'c2']);
    expect(tree[0]?.replies.map((c) => c.commentId)).toEqual(['r1', 'r2']);
    expect(tree[1]?.replies).toEqual([]);
  });

  it('reply mồ côi (không thấy bình luận gốc trong trang này) không bị mất', () => {
    // Bình luận phân trang theo cursor: gốc có thể nằm ở trang trước. Vứt reply
    // đi thì người dùng thấy bình luận biến mất mà không hiểu vì sao.
    const tree = buildCommentTree([comment('r1', { replyToCommentId: 'khong-co' })]);

    expect(tree.map((c) => c.commentId)).toEqual(['r1']);
  });

  it('danh sách rỗng trả về mảng rỗng', () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});

describe('isBotComment', () => {
  it('nhận ra bình luận của bot theo authorUserId', () => {
    // jest.setup.ts đặt EXPO_PUBLIC_FORUM_BOT_USER_ID = 'bot-user-id'
    expect(isBotComment(comment('c1', { authorUserId: 'bot-user-id' }))).toBe(true);
  });

  it('bình luận của người thật không bị gắn badge', () => {
    expect(isBotComment(comment('c1', { authorUserId: 'u1' }))).toBe(false);
  });

  describe('khi chưa cấu hình EXPO_PUBLIC_FORUM_BOT_USER_ID', () => {
    const originalBotUserId = process.env.EXPO_PUBLIC_FORUM_BOT_USER_ID;

    beforeEach(() => {
      process.env.EXPO_PUBLIC_FORUM_BOT_USER_ID = '';
      resetEnvCache();
    });

    afterEach(() => {
      process.env.EXPO_PUBLIC_FORUM_BOT_USER_ID = originalBotUserId;
      resetEnvCache();
    });

    it('không gắn badge cho bình luận nào', () => {
      expect(isBotComment(comment('c1', { authorUserId: 'u1' }))).toBe(false);
    });

    it('bình luận có authorUserId rỗng cũng KHÔNG bị gắn badge', () => {
      // Đây là ca nguy hiểm nhất: nếu guard chỉ so `authorUserId === botUserId`
      // thì '' === '' cho true, và một payload dị dạng sẽ được gắn badge "AI"
      // của người khác. Thiếu badge chỉ xấu giao diện; gắn nhầm là quy sai tác
      // giả cho một sinh viên thật, và sẽ không ai báo lỗi cho mình biết.
      expect(isBotComment(comment('c1', { authorUserId: '' }))).toBe(false);
    });
  });
});

describe('resolveReplyTarget', () => {
  it('trả lời một bình luận gốc thì gửi chính id của nó', () => {
    expect(resolveReplyTarget(comment('c1'))).toBe('c1');
  });

  it('trả lời một reply thì vẫn gửi id của bình luận GỐC', () => {
    // Backend từ chối reply lồng trong reply với lỗi 400. Đây là chỗ duy nhất
    // biết cách quy về gốc, để màn hình không phải tự nhớ luật.
    expect(resolveReplyTarget(comment('r1', { replyToCommentId: 'c1' }))).toBe('c1');
  });
});
