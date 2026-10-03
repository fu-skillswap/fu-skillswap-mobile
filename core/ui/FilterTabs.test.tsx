import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterTabs } from '@/core/ui/FilterTabs';

const MUC = [
  { value: 'ALL', label: 'Tất cả (5)' },
  { value: 'WAITING', label: 'Đang chờ (1)' },
  { value: 'COMPLETED', label: 'Đã hoàn thành (2)' },
] as const;

describe('FilterTabs', () => {
  it('dựng đủ mọi mục', async () => {
    await render(
      <FilterTabs
        items={MUC}
        value="ALL"
        onChange={jest.fn()}
        accessibilityLabel="Lọc lịch đặt"
      />,
    );

    expect(screen.getByText('Tất cả (5)')).toBeTruthy();
    expect(screen.getByText('Đang chờ (1)')).toBeTruthy();
    expect(screen.getByText('Đã hoàn thành (2)')).toBeTruthy();
  });

  it('bấm một mục thì gọi onChange với đúng value', async () => {
    const onChange = jest.fn();
    await render(
      <FilterTabs
        items={MUC}
        value="ALL"
        onChange={onChange}
        accessibilityLabel="Lọc lịch đặt"
      />,
    );

    await fireEvent.press(screen.getByText('Đang chờ (1)'));

    expect(onChange).toHaveBeenCalledWith('WAITING');
  });

  it('chỉ mục đang chọn mang accessibilityState.selected', async () => {
    await render(
      <FilterTabs
        items={MUC}
        value="WAITING"
        onChange={jest.fn()}
        accessibilityLabel="Lọc lịch đặt"
        testID="loc"
      />,
    );

    expect(screen.getByTestId('loc-WAITING').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('loc-ALL').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('cả hàng mang nhãn truy cập do màn hình truyền vào', async () => {
    await render(
      <FilterTabs
        items={MUC}
        value="ALL"
        onChange={jest.fn()}
        accessibilityLabel="Lọc lịch đặt"
      />,
    );

    expect(screen.getByLabelText('Lọc lịch đặt')).toBeTruthy();
  });
});
