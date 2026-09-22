import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/core/ui/Button';

describe('Button', () => {
  it('hiện nhãn và gọi onPress khi bấm', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} />);

    fireEvent.press(screen.getByText('Đăng bài'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('đang bận thì hiện spinner, ẩn nhãn và không gọi onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} busy testID="nut" />);

    expect(screen.queryByText('Đăng bài')).toBeNull();
    fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('bị vô hiệu hoá thì không gọi onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Đăng bài" onPress={onPress} disabled testID="nut" />);

    fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
