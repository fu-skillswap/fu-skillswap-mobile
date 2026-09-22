import { fireEvent, render, screen } from '@testing-library/react-native';

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
  it('hiện tiêu đề, tác giả, chủ đề và số liệu tương tác', async () => {
    await render(<PostCard post={post()} onPress={jest.fn()} />);

    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    expect(screen.getByText('Nguyen Van A')).toBeTruthy();
    expect(screen.getByText('Hỏi đáp')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('bấm vào thẻ thì báo postId', async () => {
    const onPress = jest.fn();
    await render(<PostCard post={post()} onPress={onPress} />);

    fireEvent.press(screen.getByText('Học Spring Boot từ đâu?'));

    expect(onPress).toHaveBeenCalledWith('p1');
  });
});
