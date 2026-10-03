import { fireEvent, render, screen } from '@testing-library/react-native';
import { Plus } from 'lucide-react-native';

import { IconButton } from '@/core/ui/IconButton';

describe('IconButton', () => {
  it('tra được bằng nhãn trợ năng, bấm vào thì gọi onPress', async () => {
    // Icon Lucide mang `aria-hidden`, nên nhãn trợ năng là THỨ DUY NHẤT mô tả
    // nút này — cả với trình đọc màn hình lẫn với test.
    const onPress = jest.fn();
    await render(<IconButton label="Tạo bài viết" icon={<Plus />} onPress={onPress} />);

    await fireEvent.press(screen.getByLabelText('Tạo bài viết'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('busy thì chặn bấm và báo trạng thái busy cho trợ năng', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton label="Gửi bình luận" icon={<Plus />} onPress={onPress} busy testID="nut" />,
    );

    await fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('nut').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('disabled thì chặn bấm nhưng KHÔNG báo là đang xử lý', async () => {
    // Gộp hai cờ thành một sẽ làm trình đọc màn hình nói "đang xử lý" cho một
    // nút chỉ đơn giản là chưa dùng được (ô nhập bình luận còn rỗng).
    const onPress = jest.fn();
    await render(
      <IconButton label="Gửi bình luận" icon={<Plus />} onPress={onPress} disabled testID="nut" />,
    );

    await fireEvent.press(screen.getByTestId('nut'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('nut').props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
  });

  it('mỗi dáng có đúng đường kính của thiết kế', async () => {
    // 44 (nút tròn đầu trang) · 46 (nút Gửi) · 56 (nút nổi tạo bài). Ba con số
    // này lấy từ `Main.dc.html` và `PostDetail.dc.html`, không nội suy.
    await render(
      <>
        <IconButton label="A" icon={<Plus />} onPress={jest.fn()} variant="outline" testID="a" />
        <IconButton label="B" icon={<Plus />} onPress={jest.fn()} variant="tint" testID="b" />
        <IconButton label="C" icon={<Plus />} onPress={jest.fn()} variant="gradient" testID="c" />
      </>,
    );

    const canh = (testID: string) =>
      // `style` là mảng (kích cỡ + bóng đổ) nên phải làm phẳng trước khi đọc.
      [screen.getByTestId(testID).props.style].flat(2).find((s) => s && s.width)?.width;

    expect(canh('a')).toBe(44);
    expect(canh('b')).toBe(46);
    expect(canh('c')).toBe(56);
  });
});
