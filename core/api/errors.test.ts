import { ApiClientError, toUserMessage } from '@/core/api/errors';

describe('toUserMessage', () => {
  it('401 → yêu cầu đăng nhập lại', () => {
    const msg = toUserMessage(new ApiClientError(401, 'AUTH_1003', 'Refresh token hết hạn'));

    expect(msg.action).toBe('LOGIN');
    expect(msg.title).toBe('Phiên đăng nhập đã kết thúc');
  });

  it('409 → báo trạng thái vừa thay đổi và yêu cầu tải lại', () => {
    const msg = toUserMessage(new ApiClientError(409, 'SYS_0007', 'Booking đã đổi trạng thái'));

    expect(msg.action).toBe('RELOAD');
    expect(msg.title).toBe('Trạng thái vừa thay đổi');
  });

  it('429 → giữ nguyên thông điệp của backend và kèm số giây chờ', () => {
    const msg = toUserMessage(
      new ApiClientError(429, 'TOO_MANY_REQUESTS', 'Bạn thao tác hơi nhanh', null, 45),
    );

    expect(msg.action).toBe('RETRY');
    expect(msg.description).toBe('Bạn thao tác hơi nhanh');
    expect(msg.retryAfterSeconds).toBe(45);
  });

  it('5xx → thông báo chung kèm nút thử lại', () => {
    const msg = toUserMessage(new ApiClientError(500, 'SYS_0010', 'Internal error'));

    expect(msg.action).toBe('RETRY');
    expect(msg.title).toBe('Hệ thống đang bận');
  });

  it('mất mạng (status 0) → báo không có kết nối', () => {
    const msg = toUserMessage(new ApiClientError(0, 'NETWORK_ERROR', 'Network Error'));

    expect(msg.action).toBe('RETRY');
    expect(msg.title).toBe('Không có kết nối');
  });

  it('400 → hiển thị đúng thông điệp của backend', () => {
    const msg = toUserMessage(new ApiClientError(400, 'FORUM_4201', 'Nội dung chứa từ ngữ vi phạm'));

    expect(msg.action).toBe('NONE');
    expect(msg.description).toBe('Nội dung chứa từ ngữ vi phạm');
  });

  it('403 → báo không có quyền và tải lại dữ liệu', () => {
    const msg = toUserMessage(new ApiClientError(403, 'AUTH_1002', 'Không có quyền'));

    expect(msg.action).toBe('RELOAD');
  });

  it('404 → báo dữ liệu không còn tồn tại', () => {
    const msg = toUserMessage(new ApiClientError(404, 'SYS_0003', 'Không tìm thấy'));

    expect(msg.action).toBe('RELOAD');
    expect(msg.title).toBe('Không tìm thấy dữ liệu');
  });

  it('lỗi lạ không phải ApiClientError → thông báo chung', () => {
    const msg = toUserMessage(new Error('boom'));

    expect(msg.action).toBe('RETRY');
    expect(msg.title).toBe('Đã có lỗi xảy ra');
  });
});
