import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/core/ui/Button';

describe('Button', () => {
  it('hiện nhãn và gọi onPress khi bấm', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} />);

    await fireEvent.press(screen.getByText('Đăng bài'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('đang bận thì hiện spinner, ẩn nhãn và không gọi onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} busy testID="nut" />);

    expect(screen.queryByText('Đăng bài')).toBeNull();
    await fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('bị vô hiệu hoá thì không gọi onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} disabled testID="nut" />);

    await fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('khai báo đang bận cho trình đọc màn hình, không chỉ đổi hình', async () => {
    await render(<Button label="Đăng bài" onPress={jest.fn()} busy testID="nut" />);

    expect(screen.getByTestId('nut').props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });

  it('mọi variant đều bấm được và giữ nguyên nhãn', async () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      const onPress = jest.fn();
      const { unmount } = await render(
        <Button label="Lưu" onPress={onPress} variant={variant} testID="nut" />,
      );

      await fireEvent.press(screen.getByText('Lưu'));

      expect(onPress).toHaveBeenCalledTimes(1);
      await unmount();
    }
  });

  it('đổi size thì đổi chiều cao theo thang 44/52/56 của thiết kế', async () => {
    const chieuCao: number[] = [];
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = await render(
        <Button label="Lưu" onPress={jest.fn()} size={size} testID="nut" />,
      );

      const style = screen.getByTestId('nut').props.style as { height?: number }[] | undefined;
      chieuCao.push(
        (Array.isArray(style) ? style : [style]).reduce<number>(
          (cao, lop) => lop?.height ?? cao,
          0,
        ),
      );
      await unmount();
    }

    expect(chieuCao).toEqual([44, 52, 56]);
  });
});
