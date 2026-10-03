import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ScreenHeader } from '@/core/ui/ScreenHeader';

describe('ScreenHeader', () => {
  it('nút back có nhãn tiếng Việt và gọi onBack khi bấm', async () => {
    const onBack = jest.fn();
    await render(<ScreenHeader title="Chọn thời gian" onBack={onBack} />);

    const nut = screen.getByLabelText('Quay lại');
    await fireEvent.press(nut);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('nút back đủ vùng chạm 44×44', async () => {
    await render(<ScreenHeader title="Chọn thời gian" onBack={jest.fn()} />);

    expect(screen.getByTestId('nut-quay-lai').props.style).toMatchObject({
      width: 44,
      height: 44,
    });
  });

  it('không truyền onBack thì không dựng nút back', async () => {
    await render(<ScreenHeader title="Hồ sơ" size="lg" />);

    expect(screen.queryByLabelText('Quay lại')).toBeNull();
    expect(screen.getByText('Hồ sơ')).toBeTruthy();
  });

  it('hiện eyebrow và dòng phụ khi được truyền', async () => {
    await render(
      <ScreenHeader
        title="Chỉnh sửa dịch vụ"
        eyebrow="DỊCH VỤ TƯ VẤN 1:1"
        subtitle="Bước 2/3 · với Sarah Chen"
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText('DỊCH VỤ TƯ VẤN 1:1')).toBeTruthy();
    expect(screen.getByText('Bước 2/3 · với Sarah Chen')).toBeTruthy();
  });

  it('dựng phần trailing do màn hình truyền vào', async () => {
    await render(
      <ScreenHeader title="Tìm Mentor" size="lg" trailing={<Text>Bộ lọc</Text>} />,
    );

    expect(screen.getByText('Bộ lọc')).toBeTruthy();
  });
});
