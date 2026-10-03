import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { SegmentedControl } from '@/core/ui/SegmentedControl';

const MUC = [
  { value: 'GIAO_DICH', label: 'Giao dịch' },
  { value: 'RUT_TIEN', label: 'Yêu cầu rút' },
] as const;

/** Bọc có state thật để kiểm "bấm thì ĐỔI mục", không chỉ "có gọi onChange" */
function ViDu() {
  const [muc, setMuc] = useState<'GIAO_DICH' | 'RUT_TIEN'>('GIAO_DICH');

  return (
    <SegmentedControl
      items={MUC}
      value={muc}
      onChange={setMuc}
      accessibilityLabel="Nội dung ví"
      testID="phan-doan"
    />
  );
}

describe('SegmentedControl', () => {
  it('bấm mục khác thì mục đó thành mục đang chọn', async () => {
    await render(<ViDu />);

    expect(screen.getByTestId('phan-doan-GIAO_DICH').props.accessibilityState).toMatchObject({
      selected: true,
    });

    await fireEvent.press(screen.getByText('Yêu cầu rút'));

    expect(screen.getByTestId('phan-doan-RUT_TIEN').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('phan-doan-GIAO_DICH').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('mỗi mục là một tab và cả khung có nhãn truy cập', async () => {
    await render(<ViDu />);

    expect(screen.getByLabelText('Nội dung ví')).toBeTruthy();
    expect(screen.getByTestId('phan-doan-RUT_TIEN').props.accessibilityRole).toBe('tab');
  });

  it('bấm lại mục đang chọn thì giữ nguyên, không bỏ chọn', async () => {
    await render(<ViDu />);

    await fireEvent.press(screen.getByText('Giao dịch'));

    expect(screen.getByTestId('phan-doan-GIAO_DICH').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
