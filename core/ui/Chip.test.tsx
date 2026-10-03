import { fireEvent, render, screen } from '@testing-library/react-native';

import { Chip } from '@/core/ui/Chip';

describe('Chip', () => {
  it('gọi onPress khi bấm', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Tech" onPress={onPress} />);

    await fireEvent.press(screen.getByText('Tech'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('đang chọn thì khai accessibilityState.selected', async () => {
    await render(<Chip label="Tech" selected onPress={jest.fn()} testID="chip" />);

    expect(screen.getByTestId('chip').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('không chọn thì accessibilityState.selected là false', async () => {
    await render(<Chip label="Tech" onPress={jest.fn()} testID="chip" />);

    expect(screen.getByTestId('chip').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('bị vô hiệu hoá thì không gọi onPress', async () => {
    const onPress = jest.fn();
    await render(<Chip label="09:30" variant="slot" disabled onPress={onPress} testID="chip" />);

    await fireEvent.press(screen.getByTestId('chip'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('khung giờ hết chỗ thì gạch ngang chữ', async () => {
    await render(<Chip label="09:30" variant="slot" disabled onPress={jest.fn()} />);

    expect(screen.getByText('09:30').props.style).toMatchObject({
      textDecorationLine: 'line-through',
    });
  });

  it('không có onPress thì là nhãn thuần, không mang vai trò nút', async () => {
    await render(<Chip label="Review CV" variant="tag" testID="chip" />);

    expect(screen.getByTestId('chip').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('Review CV')).toBeTruthy();
  });

  it('chip bấm được có hitSlop để bù chiều cao 40 dưới mức chạm 44', async () => {
    await render(<Chip label="Tech" onPress={jest.fn()} testID="chip" />);

    expect(screen.getByTestId('chip').props.hitSlop).toMatchObject({ top: 6, bottom: 6 });
  });
});
