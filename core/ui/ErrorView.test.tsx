import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiClientError } from '@/core/api/errors';
import { ErrorView } from '@/core/ui/ErrorView';

describe('ErrorView', () => {
  it('lỗi 5xx: hiện nút "Thử lại" và gọi onAction', async () => {
    const onAction = jest.fn();
    await render(<ErrorView error={new ApiClientError(500, 'SYS_0010', 'Lỗi')} onAction={onAction} />);

    expect(screen.getByText('Hệ thống đang bận')).toBeTruthy();
    fireEvent.press(screen.getByText('Thử lại'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('lỗi 409: nhãn nút là "Tải lại"', async () => {
    await render(
      <ErrorView error={new ApiClientError(409, 'SYS_0007', 'Đổi rồi')} onAction={jest.fn()} />,
    );

    expect(screen.getByText('Tải lại')).toBeTruthy();
  });

  it('lỗi kiểm duyệt 400: hiện đúng thông điệp backend và KHÔNG có nút hành động', async () => {
    // FORUM_4201 rơi vào nhánh mặc định (action NONE): thử lại cũng vô ích,
    // người dùng phải sửa nội dung.
    await render(
      <ErrorView error={new ApiClientError(400, 'FORUM_4201', 'Nội dung chứa từ ngữ vi phạm')} />,
    );

    expect(screen.getByText('Nội dung chứa từ ngữ vi phạm')).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(screen.queryByText('Tải lại')).toBeNull();
  });

  it('lỗi 429: hiện thêm số giây phải chờ', async () => {
    await render(
      <ErrorView error={new ApiClientError(429, 'TOO_MANY_REQUESTS', 'Chậm lại', null, 45)} />,
    );

    expect(screen.getByText(/45 giây/)).toBeTruthy();
  });

  it('không truyền onAction thì không hiện nút dù action khác NONE', async () => {
    await render(<ErrorView error={new ApiClientError(500, 'SYS_0010', 'Lỗi')} />);

    expect(screen.queryByText('Thử lại')).toBeNull();
  });
});
