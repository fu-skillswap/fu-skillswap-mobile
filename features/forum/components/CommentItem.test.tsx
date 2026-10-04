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

  it('KHÔNG có onToggleLike thì ô lượt thích không được giả làm nút', async () => {
    // Cùng lý do đã khoá cho PostCard: `Pressable` với `disabled` vẫn giữ
    // accessibilityRole="button", nên trình đọc màn hình đọc ra "nút Thích bình
    // luận" rồi bấm vào chẳng có gì xảy ra. Trước đây chỉ có comment nói về
    // điều này chứ không có test — hoàn nguyên về `Pressable disabled` vẫn xanh.
    await render(<CommentItem comment={comment()} />);

    expect(screen.queryByLabelText('Thích bình luận')).toBeNull();
    expect(screen.queryByLabelText('Bỏ thích bình luận')).toBeNull();
  });

  it('có onToggleLike thì ô lượt thích là nút thật, nhãn phân biệt với bài viết', async () => {
    const onToggleLike = jest.fn();
    await render(<CommentItem comment={comment({ commentId: 'c9' })} onToggleLike={onToggleLike} />);

    // Nhãn phải là "Thích bình luận" chứ không phải "Thích": màn hình chi tiết
    // có cả nút thích của BÀI VIẾT, trùng nhãn thì truy vấn nhập nhằng và trình
    // đọc màn hình cũng đọc ra hai thứ giống hệt nhau.
    await fireEvent.press(screen.getByLabelText('Thích bình luận'));

    expect(onToggleLike).toHaveBeenCalledWith(expect.objectContaining({ commentId: 'c9' }));
  });

  it('mỗi bình luận có testID riêng, không trùng nhau', async () => {
    // FlatList render nhiều bình luận cùng lúc; testID dùng chung sẽ làm
    // `getByTestId` ném "found multiple elements" ngay khi Task 9 viết test cho
    // nút thích — và lỗi đó hiện ra ở task khác chứ không phải ở đây.
    await render(
      <>
        <CommentItem comment={comment({ commentId: 'c1' })} />
        <CommentItem comment={comment({ commentId: 'c2' })} />
      </>,
    );

    expect(screen.getByTestId('so-thich-binh-luan-c1')).toBeTruthy();
    expect(screen.getByTestId('so-thich-binh-luan-c2')).toBeTruthy();
  });

  it('reply thụt lề vào, bình luận gốc thì không', async () => {
    // Tên test cũ của màn hình chi tiết nói "reply thụt vào" nhưng không
    // assertion nào chạm tới thụt lề: xoá `pl-12` đi mà toàn bộ suite vẫn xanh.
    // Render cả hai biến thể trong CÙNG một cây thay vì render rồi `unmount()`:
    // `unmount` của RNTL 14 cũng là hàm async, gọi mà không await thì act scope
    // của nó rò ra và sinh "overlapping act() calls".
    await render(
      <>
        <CommentItem comment={comment({ commentId: 'c1' })} testID="goc" />
        <CommentItem comment={comment({ commentId: 'c2' })} isReply testID="reply" />
      </>,
    );

    expect(String(screen.getByTestId('goc').props.className)).not.toContain('pl-12');
    expect(String(screen.getByTestId('reply').props.className)).toContain('pl-12');
  });

  it('bình luận của bot có nền khác bình luận của người thật', async () => {
    // JSDoc của component hứa "nền nhạt" cho bot. Chỉ badge "AI" được kiểm, nên
    // lời hứa về nền là một câu mô tả hành vi không ai bảo vệ.
    //
    // Nền nằm trên BONG BÓNG (`-bong`), không phải khung ngoài: theo
    // `PostDetail.dc.html`, khung ngoài trong suốt trên nền `surface-page` của
    // màn hình và chỉ bong bóng mới có nền + viền.
    //
    // Và phải khẳng định theo kiểu LOẠI TRỪ: nền bot là `bg-surface-tint`, một
    // chuỗi CHỨA `bg-surface`. Chỉ viết `toContain('bg-surface')` cho cả hai thì
    // gán cùng một nền cho bot lẫn người thật vẫn xanh.
    await render(
      <>
        <CommentItem comment={comment({ commentId: 'c1' })} testID="nguoi" />
        <CommentItem
          comment={comment({ commentId: 'c2', authorUserId: 'bot-user-id' })}
          testID="bot"
        />
      </>,
    );

    const nenNguoi = String(screen.getByTestId('nguoi-bong').props.className);
    const nenBot = String(screen.getByTestId('bot-bong').props.className);

    expect(nenNguoi).toContain('bg-surface');
    expect(nenNguoi).not.toContain('bg-surface-tint');
    expect(nenBot).toContain('bg-surface-tint');
  });
});
