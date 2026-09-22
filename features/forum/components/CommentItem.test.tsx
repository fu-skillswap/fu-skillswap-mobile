import { fireEvent, render, screen } from '@testing-library/react-native';

import { CommentItem } from '@/features/forum/components/CommentItem';
import type { ForumCommentResponse } from '@/features/forum/types';

function comment(overrides: Partial<ForumCommentResponse> = {}): ForumCommentResponse {
  return {
    commentId: 'c1',
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorRole: 'MENTEE',
    content: 'Nội dung bình luận',
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

describe('CommentItem', () => {
  it('bình luận của người thật không có badge AI', async () => {
    await render(<CommentItem comment={comment()} />);

    expect(screen.queryByText('AI')).toBeNull();
    expect(screen.getByText('Nội dung bình luận')).toBeTruthy();
  });

  it('bình luận của bot có badge AI', async () => {
    // jest.setup.ts đặt EXPO_PUBLIC_FORUM_BOT_USER_ID = 'bot-user-id'
    await render(<CommentItem comment={comment({ authorUserId: 'bot-user-id' })} />);

    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('reply hiện tên người được trả lời', async () => {
    await render(
      <CommentItem
        comment={comment({ replyToCommentId: 'c0', replyToUserName: 'Tran Thi B' })}
        isReply
      />,
    );

    expect(screen.getByText(/Tran Thi B/)).toBeTruthy();
  });

  it('bấm "Trả lời" báo đúng bình luận vừa bấm', async () => {
    const onReply = jest.fn();
    await render(<CommentItem comment={comment({ commentId: 'c9' })} onReply={onReply} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Trả lời' }));

    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ commentId: 'c9' }));
  });

  it('không truyền onReply thì không có nút "Trả lời"', async () => {
    // Task 11 mới có ô nhập; trước đó nút trả lời chết là cái bẫy trợ năng.
    await render(<CommentItem comment={comment()} />);

    expect(screen.queryByRole('button', { name: 'Trả lời' })).toBeNull();
  });
});
