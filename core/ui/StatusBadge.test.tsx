import { render, screen } from '@testing-library/react-native';

import { StatusBadge } from '@/core/ui/StatusBadge';

describe('StatusBadge', () => {
  it('hiện đúng nhãn trạng thái được truyền vào', async () => {
    await render(<StatusBadge label="Đang diễn ra" tone="accent" />);

    expect(screen.getByText('Đang diễn ra')).toBeTruthy();
  });

  it('mỗi tone cho một bộ màu khác nhau, không rơi hết về một màu', async () => {
    const lop: string[] = [];
    for (const tone of ['accent', 'warning', 'success', 'neutral'] as const) {
      const { unmount } = await render(
        <StatusBadge label="Trạng thái" tone={tone} testID="nhan" />,
      );
      lop.push(String(screen.getByTestId('nhan').props.className));
      await unmount();
    }

    expect(new Set(lop).size).toBe(4);
  });

  it('không có tone thì về neutral, không vỡ', async () => {
    await render(<StatusBadge label="Quá hạn" testID="nhan" />);

    expect(String(screen.getByTestId('nhan').props.className)).toContain('bg-neutral-soft');
  });

  it('là nhãn chữ, không mang vai trò nút', async () => {
    await render(<StatusBadge label="Đang chờ" tone="warning" testID="nhan" />);

    expect(screen.getByTestId('nhan').props.accessibilityRole).toBeUndefined();
  });
});
