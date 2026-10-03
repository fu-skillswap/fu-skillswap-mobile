import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Switch } from '@/core/ui/Switch';

/** Bọc có state thật để kiểm công tắc BẬT/TẮT được, không chỉ gọi callback */
function ViDu({ banDau = false }: { banDau?: boolean }) {
  const [bat, setBat] = useState(banDau);

  return (
    <Switch
      value={bat}
      onValueChange={setBat}
      accessibilityLabel="Duy trì chat sau buổi học"
      testID="cong-tac"
    />
  );
}

describe('Switch', () => {
  it('bấm thì bật, bấm nữa thì tắt', async () => {
    await render(<ViDu />);
    const congTac = screen.getByTestId('cong-tac');

    expect(congTac.props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(congTac);
    expect(screen.getByTestId('cong-tac').props.accessibilityState).toMatchObject({
      checked: true,
    });

    await fireEvent.press(screen.getByTestId('cong-tac'));
    expect(screen.getByTestId('cong-tac').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('mang vai trò switch và nhãn truy cập bắt buộc', async () => {
    await render(<ViDu banDau />);

    const congTac = screen.getByTestId('cong-tac');
    expect(congTac.props.accessibilityRole).toBe('switch');
    expect(congTac.props.accessibilityLabel).toBe('Duy trì chat sau buổi học');
  });

  it('bị vô hiệu hoá thì không đổi giá trị', async () => {
    const onValueChange = jest.fn();
    await render(
      <Switch
        value={false}
        onValueChange={onValueChange}
        accessibilityLabel="Hiện dịch vụ"
        disabled
        testID="cong-tac"
      />,
    );

    await fireEvent.press(screen.getByTestId('cong-tac'));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('giữ đúng kích thước 52×30 của thiết kế', async () => {
    await render(<ViDu />);

    expect(screen.getByTestId('cong-tac').props.style).toMatchObject({
      width: 52,
      height: 30,
    });
  });
});
