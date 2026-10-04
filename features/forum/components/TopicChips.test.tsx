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

    await fireEvent.press(screen.getByText('Chia sẻ'));

    expect(onSelect).toHaveBeenCalledWith('t2');
  });

  it('bấm "Tất cả" thì báo null để bỏ lọc', async () => {
    const onSelect = jest.fn();
    await render(<TopicChips topics={TOPICS} selectedTopicId="t2" onSelect={onSelect} />);

    await fireEvent.press(screen.getByText('Tất cả'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('chip đang chọn được đánh dấu selected, các chip khác thì không', async () => {
    // Nếu `active` bị nối cứng (hoặc `selectedTopicId` bị bỏ quên), người dùng
    // không còn biết mình đang lọc theo chủ đề nào — nhưng mọi test dựa trên
    // nhãn và onSelect vẫn xanh, vì phần hiển thị chưa ai khoá.
    await render(<TopicChips topics={TOPICS} selectedTopicId="t2" onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Chia sẻ', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tất cả', selected: false })).toBeTruthy();
  });

  it('không chọn chủ đề nào thì chip "Tất cả" là chip được đánh dấu', async () => {
    await render(<TopicChips topics={TOPICS} selectedTopicId={null} onSelect={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Tất cả', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chia sẻ', selected: false })).toBeTruthy();
  });
});
