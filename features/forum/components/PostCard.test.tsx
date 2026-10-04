import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { PostCard } from '@/features/forum/components/PostCard';
import type { ForumPostResponse } from '@/features/forum/types';

function post(overrides: Partial<ForumPostResponse> = {}): ForumPostResponse {
  return {
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorProgram: null,
    forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
    title: 'Học Spring Boot từ đâu?',
    content: 'Nội dung bài viết',
    status: 'PUBLISHED',
    commentCount: 3,
    reactionCount: 5,
    reportCount: 0,
    lastActivityAt: '2026-09-22T00:00:00Z',
    reactedByCurrentUser: false,
    myReactionType: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

describe('PostCard', () => {
  it('hiện tiêu đề, tác giả và chủ đề', async () => {
    await render(<PostCard post={post()} onPress={jest.fn()} />);

    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    expect(screen.getByText('Nguyen Van A')).toBeTruthy();
    expect(screen.getByText('Hỏi đáp')).toBeTruthy();
  });

  it('gắn số lượt thích và số bình luận vào ĐÚNG ô của nó', async () => {
    // Chỉ `getByText('5')` rồi `getByText('3')` thì hoán vị hai con số vẫn xanh:
    // test không hề ràng buộc con số nào là like, con số nào là bình luận. Đây
    // là kiểu hiển thị sai mà không ai báo lỗi, vì cả hai số đều "có mặt".
    await render(<PostCard post={post()} onPress={jest.fn()} />);

    expect(within(screen.getByTestId('so-luot-thich')).getByText('5')).toBeTruthy();
    expect(within(screen.getByTestId('so-binh-luan')).getByText('3')).toBeTruthy();
  });

  it('có onToggleLike thì ô lượt thích là nút, bấm vào báo đúng bài', async () => {
    const onToggleLike = jest.fn();
    const onPress = jest.fn();
    await render(<PostCard post={post()} onPress={onPress} onToggleLike={onToggleLike} />);

    await fireEvent.press(screen.getByLabelText('Thích'));

    expect(onToggleLike).toHaveBeenCalledWith(expect.objectContaining({ postId: 'p1' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('đã thích rồi thì nhãn trợ năng đổi thành "Bỏ thích"', async () => {
    await render(
      <PostCard
        post={post({ reactedByCurrentUser: true })}
        onPress={jest.fn()}
        onToggleLike={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Bỏ thích')).toBeTruthy();
  });

  it('KHÔNG có onToggleLike thì ô lượt thích không được giả làm nút', async () => {
    // Một Pressable `disabled` vẫn giữ accessibilityRole="button": trình đọc màn
    // hình đọc "nút Thích", người dùng bấm, và cú chạm rơi xuống thẻ cha rồi mở
    // bài viết. Hứa một hành động rồi làm việc khác là lỗi trợ năng thật sự.
    await render(<PostCard post={post()} onPress={jest.fn()} />);

    expect(screen.queryByLabelText('Thích')).toBeNull();
    expect(screen.queryByLabelText('Bỏ thích')).toBeNull();
  });

  it('bấm vào thẻ thì báo postId', async () => {
    const onPress = jest.fn();
    await render(<PostCard post={post()} onPress={onPress} />);

    await fireEvent.press(screen.getByText('Học Spring Boot từ đâu?'));

    expect(onPress).toHaveBeenCalledWith('p1');
  });
});
