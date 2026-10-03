import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { EmptyState } from '@/core/ui/EmptyState';

describe('EmptyState', () => {
  it('hiện tiêu đề, mô tả có thì hiện', async () => {
    await render(
      <EmptyState
        title="Chưa có lịch nào ở đây"
        description="Tìm một mentor phù hợp và đặt buổi đầu tiên nhé."
      />,
    );

    expect(screen.getByText('Chưa có lịch nào ở đây')).toBeTruthy();
    expect(
      screen.getByText('Tìm một mentor phù hợp và đặt buổi đầu tiên nhé.'),
    ).toBeTruthy();
  });

  it('không có mô tả thì chỉ còn tiêu đề', async () => {
    await render(<EmptyState title="Chưa có bài viết nào" />);

    expect(screen.getByText('Chưa có bài viết nào')).toBeTruthy();
  });

  it('nút phụ chỉ hiện khi có cả nhãn và onAction', async () => {
    const { unmount } = await render(
      <EmptyState title="Chưa có lịch nào ở đây" actionLabel="Tìm Mentor" />,
    );
    expect(screen.queryByText('Tìm Mentor')).toBeNull();
    await unmount();

    const onAction = jest.fn();
    await render(
      <EmptyState
        title="Chưa có lịch nào ở đây"
        actionLabel="Tìm Mentor"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByText('Tìm Mentor'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('dựng hình minh hoạ do màn hình truyền vào', async () => {
    await render(
      <EmptyState title="Chưa có lịch nào ở đây" illustration={<Text>Koko</Text>} />,
    );

    expect(screen.getByText('Koko')).toBeTruthy();
  });
});
