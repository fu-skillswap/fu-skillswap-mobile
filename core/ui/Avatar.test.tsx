import { render, screen } from '@testing-library/react-native';

import { Avatar, chuCaiDau } from '@/core/ui/Avatar';

describe('chuCaiDau', () => {
  it('lấy chữ cái đầu của tên đầu và tên cuối', () => {
    expect(chuCaiDau('Sarah Chen')).toBe('SC');
    expect(chuCaiDau('Nguyễn Thu Hà')).toBe('NH');
  });

  it('giữ dấu tiếng Việt khi lên hoa', () => {
    expect(chuCaiDau('Đỗ Minh')).toBe('ĐM');
    expect(chuCaiDau('Ánh Nguyệt')).toBe('ÁN');
    expect(chuCaiDau('ưng Đức')).toBe('ƯĐ');
  });

  it('tên một chữ thì ra một chữ cái', () => {
    expect(chuCaiDau('Koko')).toBe('K');
  });

  it('bỏ khoảng trắng thừa thay vì đếm nó thành một chữ', () => {
    expect(chuCaiDau('  Minh   Đức  ')).toBe('MĐ');
  });

  it('tên trống ra dấu hỏi để avatar không rỗng ruột', () => {
    expect(chuCaiDau('')).toBe('?');
    expect(chuCaiDau('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('hiện chữ cái đầu nhưng đọc ra tên đầy đủ cho trình đọc màn hình', async () => {
    await render(<Avatar name="Nguyễn Thu Hà" testID="anh" />);

    expect(screen.getByText('NH')).toBeTruthy();
    expect(screen.getByLabelText('Nguyễn Thu Hà')).toBeTruthy();
  });

  it('cỡ và bo góc đi theo prop, mặc định là 44 tròn', async () => {
    const { unmount } = await render(<Avatar name="Sarah Chen" testID="anh" />);
    expect(screen.getByTestId('anh').props.style).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 9999,
    });
    await unmount();

    await render(<Avatar name="Sarah Chen" size={56} shape="rounded" testID="anh" />);
    expect(screen.getByTestId('anh').props.style).toMatchObject({
      width: 56,
      height: 56,
      borderRadius: 16,
    });
  });
});
