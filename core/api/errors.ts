/**
 * @file errors.ts
 * @description Kiểu envelope chuẩn của backend SkillSwap, lớp lỗi ApiClientError
 * (port từ `models/apiClient.ts` của FE web) và nơi duy nhất quyết định cách
 * hiển thị lỗi cho người dùng.
 */

/** Chi tiết lỗi validate theo từng trường do backend trả về */
export interface ValidationError {
  field: string | null;
  message: string;
  rejectedValue: unknown;
}

/** Envelope chuẩn bọc mọi phản hồi của backend */
export interface ApiResponse<T> {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  /** Payload; có thể là null hợp lệ với HTTP 2xx (ví dụ: chưa có đánh giá buổi học) */
  data: T | ValidationError[] | null;
  retryAfterSeconds?: number;
}

/** Lỗi HTTP đã chuẩn hoá; mọi tầng phía trên chỉ bắt kiểu này */
export class ApiClientError extends Error {
  /**
   * @param status - Mã HTTP; 0 nghĩa là không gọi được tới server (mất mạng)
   * @param code - Mã nghiệp vụ của backend (ví dụ: "AUTH_1003", "FORUM_4201")
   * @param message - Thông điệp backend trả về
   * @param data - Danh sách lỗi validate theo trường, nếu có
   * @param retryAfterSeconds - Số giây cần chờ trước khi thử lại (lỗi 429)
   */
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: ValidationError[] | null = null,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Hành động gợi ý cho giao diện sau khi hiển thị lỗi */
export type UserMessageAction = 'RETRY' | 'RELOAD' | 'LOGIN' | 'NONE';

/** Thông điệp lỗi đã sẵn sàng hiển thị */
export interface UserMessage {
  title: string;
  description: string;
  action: UserMessageAction;
  retryAfterSeconds?: number;
}

/**
 * Quy đổi một lỗi bất kỳ thành thông điệp tiếng Việt cho người dùng.
 * Đây là nơi duy nhất quyết định cách hiển thị lỗi trong toàn app.
 */
export function toUserMessage(error: unknown): UserMessage {
  if (!(error instanceof ApiClientError)) {
    return {
      title: 'Đã có lỗi xảy ra',
      description: 'Vui lòng thử lại sau ít phút.',
      action: 'RETRY',
    };
  }

  if (error.status === 0) {
    return {
      title: 'Không có kết nối',
      description: 'Kiểm tra lại kết nối mạng rồi thử lại.',
      action: 'RETRY',
    };
  }

  if (error.status === 401) {
    return {
      title: 'Phiên đăng nhập đã kết thúc',
      description: 'Đăng nhập lại để tiếp tục sử dụng.',
      action: 'LOGIN',
    };
  }

  if (error.status === 403) {
    return {
      title: 'Không có quyền thực hiện',
      description: error.message,
      action: 'RELOAD',
    };
  }

  if (error.status === 404) {
    return {
      title: 'Không tìm thấy dữ liệu',
      description: error.message,
      action: 'RELOAD',
    };
  }

  if (error.status === 409) {
    return {
      title: 'Trạng thái vừa thay đổi',
      description: 'Dữ liệu đã được cập nhật, vui lòng xem lại trước khi thao tác tiếp.',
      action: 'RELOAD',
    };
  }

  if (error.status === 429) {
    return {
      title: 'Bạn thao tác hơi nhanh',
      description: error.message,
      action: 'RETRY',
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }

  if (error.status >= 500) {
    return {
      title: 'Hệ thống đang bận',
      description: 'Vui lòng thử lại sau ít phút.',
      action: 'RETRY',
    };
  }

  return {
    title: 'Không thực hiện được',
    description: error.message,
    action: 'NONE',
  };
}
