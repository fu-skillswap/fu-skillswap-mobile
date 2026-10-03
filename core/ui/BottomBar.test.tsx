import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';

describe('BottomBar', () => {
  it('dựng nút chính và bấm được', async () => {
    const onPress = jest.fn();
    await render(<BottomBar primary={<Button label="Tiếp tục" onPress={onPress} />} />);

    await fireEvent.press(screen.getByText('Tiếp tục'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('dựng cả nút phụ khi được truyền', async () => {
    const deSau = jest.fn();
    await render(
      <BottomBar
        primary={<Button label="Hoàn tất" onPress={jest.fn()} />}
        secondary={<Button label="Để sau" onPress={deSau} variant="secondary" />}
      />,
    );

    await fireEvent.press(screen.getByText('Để sau'));

    expect(deSau).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Hoàn tất')).toBeTruthy();
  });

  it('không truyền nút phụ thì chỉ có nút chính', async () => {
    await render(<BottomBar primary={<Button label="Lưu thay đổi" onPress={jest.fn()} />} />);

    expect(screen.getByText('Lưu thay đổi')).toBeTruthy();
    expect(screen.queryByText('Để sau')).toBeNull();
  });

  it('dựng khối tóm tắt phía trên hàng nút', async () => {
    await render(
      <BottomBar
        variant="sheet"
        summary={<Text>T3, 06/10 · 19:00</Text>}
        primary={<Button label="Tiếp tục" onPress={jest.fn()} />}
      />,
    );

    expect(screen.getByText('T3, 06/10 · 19:00')).toBeTruthy();
  });

  it('dáng sheet đổ bóng HƯỚNG LÊN, không đổ xuống như card', async () => {
    await render(
      <BottomBar
        variant="sheet"
        primary={<Button label="Tiếp tục" onPress={jest.fn()} />}
        testID="thanh"
      />,
    );

    const style = screen.getByTestId('thanh').props.style as {
      shadowOffset?: { height: number };
    }[];
    const offset = (Array.isArray(style) ? style : [style]).reduce<number | undefined>(
      (h, lop) => lop?.shadowOffset?.height ?? h,
      undefined,
    );

    expect(offset).toBe(-8);
  });
});
