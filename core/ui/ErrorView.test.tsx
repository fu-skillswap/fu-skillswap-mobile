import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiClientError } from '@/core/api/errors';
import { ErrorView } from '@/core/ui/ErrorView';

describe('ErrorView', () => {
  it('lỗi 5xx: hiện nút "Thử lại" và gọi onAction', async () => {
    const onAction = jest.fn();
    await render(<ErrorView error={new ApiClientError(500, 'SYS_0010', 'Lỗi')} onAction={onAction} />);

    expect(screen.getByText('Hệ thống đang bận')).toBeTruthy();
    await fireEvent.press(screen.getByText('Thử lại'));

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

  it('lỗi kiểm duyệt vẫn KHÔNG có nút kể cả khi người gọi truyền onAction', async () => {
    // Đây là kịch bản component này sinh ra để ngăn: nội dung bị backend từ
    // chối vì chứa từ cấm, thử lại đúng nội dung đó chắc chắn bị từ chối lần
    // nữa. Nếu về sau ai đó tách việc hiện nút ra khỏi ACTION_LABEL và chỉ
    // dựa vào `onAction`, người dùng sẽ có nút "Thử lại" dẫn vào vòng lặp —
    // test này là thứ chặn lại.
    await render(
      <ErrorView
        error={new ApiClientError(400, 'FORUM_4201', 'Nội dung chứa từ ngữ vi phạm')}
        onAction={jest.fn()}
      />,
    );

    expect(screen.getByText('Nội dung chứa từ ngữ vi phạm')).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(screen.queryByText('Tải lại')).toBeNull();
    expect(screen.queryByText('Đăng nhập lại')).toBeNull();
  });

  it('lỗi 401: nhãn nút là "Đăng nhập lại"', async () => {
    await render(
      <ErrorView error={new ApiClientError(401, 'AUTH_1003', 'Hết phiên')} onAction={jest.fn()} />,
    );

    expect(screen.getByText('Đăng nhập lại')).toBeTruthy();
  });

  it('không truyền onAction thì không hiện nút dù action khác NONE', async () => {
    await render(<ErrorView error={new ApiClientError(500, 'SYS_0010', 'Lỗi')} />);

    expect(screen.queryByText('Thử lại')).toBeNull();
  });
});
