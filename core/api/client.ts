/**
 * @file client.ts
 * @description HTTP client trung tâm của app mobile, port từ `models/apiClient.ts`
 * của FE web. Giữ access token trong RAM, bóc envelope ApiResponse, tự làm mới
 * token khi gặp 401 theo cơ chế promise singleton và chuẩn hoá lỗi về ApiClientError.
 * Refresh token do tầng native giữ trong cookie store, JavaScript không đọc được.
 */

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ApiClientError, type ApiResponse, type ValidationError } from '@/core/api/errors';
import { getEnv } from '@/core/config/env';

/** Phản hồi của `POST /api/auth/refresh` (khai báo tại chỗ để core/api không phụ thuộc core/auth) */
interface RefreshTokenResponse {
  accessToken: string;
  tokenType: string;
}

/** Access token chỉ nằm trong bộ nhớ tiến trình, không ghi xuống đĩa */
let memoryToken: string | null = null;

/** Promise của lần refresh đang chạy, để nhiều request 401 song song chỉ refresh một lần */
let refreshPromise: Promise<string> | null = null;

let unauthenticatedHandler: (() => void) | undefined;
let tokenRefreshedHandler: ((token: string) => void | Promise<void>) | undefined;

/** Cập nhật access token trong bộ nhớ; truyền null để xoá khi đăng xuất */
export const setAccessToken = (token: string | null): void => {
  memoryToken = token;
};

/** Lấy access token hiện tại */
export const getAccessToken = (): string | null => memoryToken;

/** Đăng ký hàm chạy khi phiên hết hạn hoàn toàn (không refresh được nữa) */
export const setUnauthenticatedHandler = (handler?: () => void): void => {
  unauthenticatedHandler = handler;
};

/**
 * Đăng ký hàm chạy sau mỗi lần refresh thành công.
 * `core/auth` dùng chỗ này để ghi cookie xuống đĩa trên Android.
 */
export const setTokenRefreshedHandler = (
  handler?: (token: string) => void | Promise<void>,
): void => {
  tokenRefreshedHandler = handler;
};

/** Các path không được tự refresh khi gặp 401, tránh vòng lặp vô hạn */
function canRefresh(path: string): boolean {
  return (
    !path.startsWith('/api/auth/refresh') &&
    !path.startsWith('/api/auth/logout') &&
    !path.startsWith('/api/auth/google')
  );
}

const axiosInstance = axios.create({
  baseURL: getEnv().apiUrl,
  // React Native tự quản lý cookie ở tầng native; cờ này giữ cho hành vi giống FE web.
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (memoryToken && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${memoryToken}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiResponse<unknown> | null;
    if (envelope && typeof envelope === 'object' && 'data' in envelope) {
      // `data` có thể là null hợp lệ với HTTP 2xx — không được coi là lỗi.
      // Bắt buộc ép kiểu `any`: chữ ký interceptor của axios yêu cầu trả về
      // `AxiosResponse | Promise<AxiosResponse>`, nhưng interceptor này cố ý
      // trả thẳng payload đã bóc khỏi envelope (đổi hẳn kiểu trả về).
      return envelope.data as any;
    }
    return response.data;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = error.response?.status ?? 0;
    const path = originalRequest?.url ?? '';

    if (status === 401 && originalRequest && !originalRequest._retry && canRefresh(path)) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers?.set('Authorization', `Bearer ${newToken}`);
        return await axiosInstance(originalRequest);
      } catch (refreshError) {
        unauthenticatedHandler?.();
        return Promise.reject(refreshError);
      }
    }

    const envelope = error.response?.data;
    const payload = envelope?.data;
    throw new ApiClientError(
      status,
      envelope?.code ?? error.code ?? 'NETWORK_ERROR',
      envelope?.message ?? error.message ?? `Gọi API thất bại (${status}).`,
      Array.isArray(payload) ? (payload as ValidationError[]) : null,
      envelope?.retryAfterSeconds,
    );
  },
);

/** Gọi `/api/auth/refresh` một lần duy nhất dù có bao nhiêu request cùng gặp 401 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient<RefreshTokenResponse>('/api/auth/refresh', { method: 'POST' })
      .then(async (tokenRes) => {
        setAccessToken(tokenRes.accessToken);
        await tokenRefreshedHandler?.(tokenRes.accessToken);
        return tokenRes.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Hàm gọi API duy nhất cho toàn bộ repository của app.
 * @param path - Đường dẫn tương đối, ví dụ "/api/auth/me"
 * @param config - Cấu hình axios; chấp nhận cả `body` kiểu RequestInit cho tương thích
 * @returns Payload đã bóc khỏi envelope
 */
export const apiClient = async <T>(
  path: string,
  config: AxiosRequestConfig & { body?: unknown } = {},
): Promise<T> => {
  const method = (config.method ?? 'GET').toString().toUpperCase();
  let data = config.data;
  if (data === undefined && config.body !== undefined && config.body !== null) {
    data = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
  }

  const result = await axiosInstance.request<ApiResponse<T>>({
    ...config,
    url: path,
    method,
    data,
  });

  return result as unknown as T;
};

/** Chủ động làm mới phiên từ refresh cookie — dùng khi khởi động app */
export const refreshSession = (): Promise<string> => refreshAccessToken();

/** Đưa client về trạng thái sạch — chỉ dùng trong test */
export function __resetApiClientForTests(): void {
  memoryToken = null;
  refreshPromise = null;
  unauthenticatedHandler = undefined;
  tokenRefreshedHandler = undefined;
}
