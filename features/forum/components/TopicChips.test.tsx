import { fireEvent, render, screen } from '@testing-library/react-native';

import { TopicChips } from '@/features/forum/components/TopicChips';
import type { ForumTopicResponse } from '@/features/forum/types';

const TOPICS: ForumTopicResponse[] = [
  { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp kiến thức', nameEn: 'Q&A', displayOrder: 1 },
  { id: 't2', code: 'SHARING', nameVi: 'Chia sẻ', nameEn: 'Sharing', displayOrder: 2 },
];

describe('TopicChips', () => {
  it('hiện chip "Tất cả" cùng mọi chủ đề', async () => {
    await render(<TopicChips topics={TOPICS} selectedTopicId={null} onSelect={jest.fn()} />);

    expect(screen.getByText('Tất cả')).toBeTruthy();
    expect(screen.getByText('Hỏi đáp kiến thức')).toBeTruthy();
  });

  it('bấm một chủ đề thì báo id của chủ đề đó', async () => {
    const onSelect = jest.fn();
    await render(<TopicChips topics={TOPICS} selectedTopicId={null} onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Chia sẻ'));

    expect(onSelect).toHaveBeenCalledWith('t2');
  });

  it('bấm "Tất cả" thì báo null để bỏ lọc', async () => {
    const onSelect = jest.fn();
    await render(<TopicChips topics={TOPICS} selectedTopicId="t2" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Tất cả'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
