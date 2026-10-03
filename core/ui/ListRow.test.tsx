import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListRow } from '@/core/ui/ListRow';

describe('ListRow', () => {
  it('gọi onPress khi bấm và mang vai trò nút', async () => {
    const onPress = jest.fn();
    await render(<ListRow label="Thông báo" chevron onPress={onPress} testID="hang" />);

    expect(screen.getByTestId('hang').props.accessibilityRole).toBe('button');
    await fireEvent.press(screen.getByTestId('hang'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('không có onPress thì là hàng chỉ đọc, không mang vai trò nút', async () => {
    await render(<ListRow label="Ngôn ngữ" value="Tiếng Việt" testID="hang" />);

    expect(screen.getByTestId('hang').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
  });

  it('cao tối thiểu 56, vượt mức chạm 44', async () => {
    await render(<ListRow label="Thông báo" onPress={jest.fn()} testID="hang" />);

    const style = screen.getByTestId('hang').props.style as { minHeight?: number }[];
    const minHeight = (Array.isArray(style) ? style : [style]).reduce<number>(
      (cao, lop) => lop?.minHeight ?? cao,
      0,
    );

    expect(minHeight).toBeGreaterThanOrEqual(56);
  });

  it('hàng phá huỷ vẫn gọi onPress bình thường', async () => {
    const onPress = jest.fn();
    await render(<ListRow label="Đăng xuất" destructive onPress={onPress} testID="hang" />);

    await fireEvent.press(screen.getByTestId('hang'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('bật divider thì thêm viền trên, tắt thì không', async () => {
    const { unmount } = await render(<ListRow label="Hồ sơ học thuật" testID="hang" />);
    expect(String(screen.getByTestId('hang').props.className)).not.toContain('border-t');
    await unmount();

    await render(<ListRow label="Thông báo" divider testID="hang" />);
    expect(String(screen.getByTestId('hang').props.className)).toContain('border-t');
  });
});
