/**
 * @file client.ts
 * @description HTTP client trung tâm của app mobile, port từ `models/apiClient.ts`
 * của FE web. Giữ access token trong RAM, bóc envelope ApiResponse, tự làm mới
 * token khi gặp 401 theo cơ chế promise singleton và chuẩn hoá lỗi về ApiClientError.
 *
 * Refresh token do CHÍNH APP giữ trong keystore (`core/auth/session.ts`), không
 * còn nằm trong cookie native nữa — xem JSDoc của file đó để biết vì sao đổi.
 * Module này gửi nó lên qua header `X-Refresh-Token` và ghi lại token mới mỗi
 * lần backend rotate.
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { Platform } from 'react-native';

import { ApiClientError, type ApiResponse, type ValidationError } from '@/core/api/errors';
import { docRefreshToken, luuRefreshToken, xoaRefreshToken } from '@/core/auth/session';
import { getEnv } from '@/core/config/env';

/**
 * Phản hồi của `POST /api/auth/refresh`, khai báo tại chỗ để `core/api` không
 * phụ thuộc vào kiểu của `core/auth`. (Phụ thuộc duy nhất theo chiều đó là
 * `core/auth/session.ts` — module đó chỉ import `expo-secure-store`, nên không
 * có vòng import nào.)
 *
 * `refreshToken` là `null` với client web và CÓ GIÁ TRỊ với client mobile:
 * backend chỉ trả nó khi `isMobileClient()` đúng, tức là khi request mang refresh
 * token trong header/body hoặc mang `X-Client-Type`/`X-Client-Platform` — đó là
 * lý do các header dưới đây là bắt buộc, không phải để cho đẹp.
 */
interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string | null;
  tokenType: string;
}

/** Header backend đọc refresh token từ đó (`AuthController.extractRefreshToken` đọc header TRƯỚC body) */
const HEADER_REFRESH_TOKEN = 'X-Refresh-Token';

/**
 * Nền tảng để khai trong `X-Client-Platform`, hoặc `null` nếu không phải máy di
 * động (backend chỉ hiểu `android|ios`).
 *
 * CẢNH BÁO — ĐỪNG BỎ HEADER NÀY ĐỂ LÁCH: backend chặn
 * `POST /api/me/payment-orders/checkout` bằng 403 `PAY_4031` khi thấy
 * `X-Client-Platform: android`, theo đúng yêu cầu của Google Play (bản mobile chỉ
 * được TIÊU số dư, không được nạp tiền). Bỏ header để gọi được endpoint đó là
 * cách chắc chắn nhất để app bị từ chối khỏi Play. Hiện app chưa gọi endpoint
 * thanh toán nào nên quy tắc này chưa ảnh hưởng tới màn hình nào cả.
 */
function nenTangClient(): 'android' | 'ios' | null {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
}

/** Access token chỉ nằm trong bộ nhớ tiến trình, không ghi xuống đĩa */
let memoryToken: string | null = null;

/** Promise của lần refresh đang chạy, để nhiều request 401 song song chỉ refresh một lần */
let refreshPromise: Promise<string> | null = null;

/**
 * Đếm số lần phiên bị xoá (đăng xuất). Một lần refresh đang chạy ngầm sẽ chụp lại
 * giá trị này lúc bắt đầu; nếu giá trị đổi trước khi refresh xong (tức là đã đăng
 * xuất trong lúc chờ) thì kết quả refresh bị coi là rác — không được ghi token mới
 * vào bộ nhớ, tránh hồi sinh một phiên đã bị người dùng chủ động kết thúc.
 */
let sessionEpoch = 0;

let unauthenticatedHandler: (() => void) | undefined;

/** Cập nhật access token trong bộ nhớ; truyền null để xoá khi đăng xuất */
export const setAccessToken = (token: string | null): void => {
  memoryToken = token;
  if (token === null) {
    sessionEpoch += 1;
  }
};

/** Lấy access token hiện tại */
export const getAccessToken = (): string | null => memoryToken;

/** Đăng ký hàm chạy khi phiên hết hạn hoàn toàn (không refresh được nữa) */
export const setUnauthenticatedHandler = (handler?: () => void): void => {
  unauthenticatedHandler = handler;
};

/** Thân phản hồi có phải envelope `ApiResponse<T>` của backend không */
function laEnvelope(body: unknown): body is ApiResponse<unknown> {
  // Nhận diện theo `code` + (`status` hoặc `timestamp`) chứ KHÔNG theo `data`:
  // backend bỏ hẳn khoá `data` khi nó null (`@JsonInclude(NON_NULL)`). Còn JSON
  // trần không bọc envelope — AI service `/v1/chat` trả `{ content, requestId,
  // sourcesUsed }` — không có `code` nên đi thẳng qua, không bị bóc nhầm.
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const obj = body as Record<string, unknown>;
  return typeof obj.code === 'string' && (typeof obj.status === 'number' || 'timestamp' in obj);
}

/** Các path không được tự refresh khi gặp 401, tránh vòng lặp vô hạn */
function canRefresh(path: string): boolean {
  return (
    !path.startsWith('/api/auth/refresh') &&
    !path.startsWith('/api/auth/logout') &&
    !path.startsWith('/api/auth/google')
  );
}

/**
 * Instance axios thật sự, chỉ được tạo khi có request đầu tiên (xem `getAxiosInstance`).
 * Không tạo ngay lúc module được nạp: `getEnv()` có thể ném lỗi nếu build thiếu biến
 * môi trường bắt buộc, và lúc module này được evaluate (trước khi có cây React hay
 * error boundary nào) là quá sớm để lỗi đó nổ ra — nó sẽ làm app trắng màn hình ngay
 * lúc khởi động, không cách nào hiển thị thông báo cho người dùng.
 */
let axiosInstance: AxiosInstance | null = null;

/** Tạo (một lần duy nhất) và trả về axios instance đã gắn interceptor */
function getAxiosInstance(): AxiosInstance {
  if (axiosInstance) {
    return axiosInstance;
  }

  const instance = axios.create({
    baseURL: getEnv().apiUrl,
    // Backend vẫn set cookie phiên cho mọi client; app không đọc cookie nào nữa
    // (xem core/auth/session.ts) nhưng cờ này giữ hành vi giống FE web và không
    // gây hại.
    withCredentials: true,
    timeout: 20_000,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (memoryToken && !config.headers.has('Authorization')) {
        config.headers.set('Authorization', `Bearer ${memoryToken}`);
      }
      // Hai header này phải đi kèm MỌI request, không chỉ `/api/auth/refresh`:
      // `isMobileClient()` của backend đọc chúng để biết đây là client mobile, và
      // chỉ client mobile mới được trả refreshToken mới trong body khi rotate.
      config.headers.set('X-Client-Type', 'mobile');
      const nenTang = nenTangClient();
      if (nenTang) {
        config.headers.set('X-Client-Platform', nenTang);
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  instance.interceptors.response.use(
    (response) => {
      const envelope = response.data as ApiResponse<unknown> | null;
      if (laEnvelope(envelope)) {
        // `data` có thể là null hợp lệ với HTTP 2xx — không được coi là lỗi.
        // `ApiResponse.java` có `@JsonInclude(NON_NULL)`, nên `data: null` lên
        // dây là VẮNG HẲN khoá `data`: không quy về `null` thì nơi gọi nhận cả
        // envelope và tưởng đó là payload.
        // Bắt buộc ép kiểu `any`: chữ ký interceptor của axios yêu cầu trả về
        // `AxiosResponse | Promise<AxiosResponse>`, nhưng interceptor này cố ý
        // trả thẳng payload đã bóc khỏi envelope (đổi hẳn kiểu trả về).
        return (envelope.data ?? null) as any;
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

        let newToken: string;
        try {
          newToken = await refreshAccessToken();
        } catch (refreshError) {
          // CHỈ khi backend từ chối chính refresh token (401/403 — hết hạn, bị thu
          // hồi, hoặc máy chưa lưu token nào) thì phiên mới chết thật, đây mới là
          // lúc đăng xuất toàn app. Mất mạng, timeout, 5xx, 429 ở bước refresh là
          // lỗi nhất thời: đăng xuất ở đây sẽ xoá luôn refresh token còn tốt, bắt
          // người dùng đăng nhập lại bằng Google đúng lúc họ đang ở chỗ sóng yếu.
          // Request gốc vẫn bị từ chối với lỗi của bước refresh, để màn hình hiện
          // "Không có kết nối" và lần gọi sau thử refresh lại từ đầu.
          if (refreshError instanceof ApiClientError && (refreshError.status === 401 || refreshError.status === 403)) {
            unauthenticatedHandler?.();
          }
          return Promise.reject(refreshError);
        }

        originalRequest.headers?.set('Authorization', `Bearer ${newToken}`);
        try {
          return await getAxiosInstance()(originalRequest);
        } catch (retryError) {
          // Chỉ 401 lần hai mới nghĩa là phiên đã chết; 500/403/429/mất mạng ở
          // đúng request bị retry là lỗi nhất thời, không được đăng xuất người
          // dùng vì chúng (xem Fix 1 trong đợt review cuối).
          if (retryError instanceof ApiClientError && retryError.status === 401) {
            unauthenticatedHandler?.();
          }
          return Promise.reject(retryError);
        }
      }

      const envelope = error.response?.data;
      const payload = envelope?.data;
      // AI service (FastAPI) không bọc envelope: lỗi của nó có dạng `{ "detail": "…" }`
      // với `detail` là câu tiếng Việt viết sẵn cho người dùng ("Bạn đã hỏi khá
      // nhiều trong một giờ qua…"). Đọc nó thay vì để lộ "Request failed with
      // status code 429" của axios.
      const chiTiet = (envelope as { detail?: unknown } | undefined)?.detail;
      throw new ApiClientError(
        status,
        envelope?.code ?? error.code ?? 'NETWORK_ERROR',
        envelope?.message ??
          (typeof chiTiet === 'string' && chiTiet.trim() ? chiTiet : undefined) ??
          error.message ??
          `Gọi API thất bại (${status}).`,
        Array.isArray(payload) ? (payload as ValidationError[]) : null,
        envelope?.retryAfterSeconds,
      );
    },
  );

  axiosInstance = instance;
  return instance;
}

/** Gọi `/api/auth/refresh` một lần duy nhất dù có bao nhiêu request cùng gặp 401 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const epochAtStart = sessionEpoch;
    // IIFE async thay cho `.then()` vì thân hàm giờ có bước `await` đọc keystore
    // TRƯỚC khi gọi API. Promise vẫn được gán vào `refreshPromise` ngay trong
    // cùng một lượt đồng bộ, nên cơ chế singleton (nhiều request 401 song song
    // chỉ refresh một lần) không đổi.
    refreshPromise = (async () => {
      const refreshTokenDaLuu = await docRefreshToken();
      if (!refreshTokenDaLuu) {
        // Máy này chưa có phiên nào lưu được. KHÔNG gọi API: `/api/auth/refresh`
        // rỗng chỉ trả về 401, và cái giá là một round trip mạng chèn vào đúng
        // lúc khởi động app, trước khi màn hình đăng nhập kịp hiện ra.
        //
        // Phải là ApiClientError(401), KHÔNG phải Error thường: `toUserMessage()`
        // quy mọi lỗi không-phải-ApiClientError về "Đã có lỗi xảy ra / thử lại
        // sau ít phút / action RETRY". Với một phiên đã chết thì lời khuyên đó
        // sai — hành động đúng là LOGIN, và chỉ nhánh `status === 401` mới trả về
        // nó. Giữ đúng lớp lỗi cũng giữ nguyên hợp đồng cho mọi repository đang
        // phân biệt lỗi theo `status` (ví dụ `profileRepo` coi 404 là "chưa có").
        throw new ApiClientError(
          401,
          'AUTH_1003',
          'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
        );
      }

      let tokenRes: RefreshTokenResponse;
      try {
        tokenRes = await apiClient<RefreshTokenResponse>('/api/auth/refresh', {
          method: 'POST',
          headers: { [HEADER_REFRESH_TOKEN]: refreshTokenDaLuu },
        });
      } catch (error) {
        // CHỈ 401 mới nghĩa là backend đã từ chối chính refresh token này (hết
        // hạn, bị thu hồi, hoặc là token mồ côi còn sót trong Keychain sau khi
        // cài lại app trên iOS). Xoá nó để lần mở app sau đi thẳng ra màn hình
        // đăng nhập thay vì lặp lại một request chắc chắn thất bại.
        //
        // Mất mạng (status 0), 500, 429 thì KHÔNG xoá: token vẫn có thể còn tốt,
        // và xoá nó sẽ bắt người dùng đăng nhập lại bằng Google đúng lúc họ đang
        // offline — việc họ không làm được.
        if (error instanceof ApiClientError && error.status === 401) {
          await xoaRefreshToken();
        }
        throw error;
      }

      if (sessionEpoch !== epochAtStart) {
        // Người dùng đã đăng xuất (setAccessToken(null)) trong lúc refresh này
        // đang chạy ngầm. Cả access token LẪN refresh token vừa nhận về giờ là
        // rác — không được ghi vào bộ nhớ, không được ghi xuống keystore, không
        // được coi là "đã refresh xong". Nếu không, phiên đã chết sẽ sống lại:
        // access token ngay sau khi AuthProvider báo unauthenticated, và refresh
        // token ở lần MỞ APP SAU.
        throw new Error('Phiên đã đăng xuất trong lúc đang làm mới access token');
      }
      setAccessToken(tokenRes.accessToken);
      if (tokenRes.refreshToken) {
        // Backend rotate refresh token mỗi lần refresh: không ghi lại token mới
        // thì lần refresh kế tiếp vẫn gửi token cũ đã bị thu hồi, và phiên chết
        // sau đúng một vòng. Phản hồi KHÔNG có `refreshToken` (null — hình dạng
        // của client web) thì giữ nguyên token đang lưu, không ghi rỗng lên nó.
        await luuRefreshToken(tokenRes.refreshToken);
      }
      return tokenRes.accessToken;
    })().finally(() => {
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

  const result = await getAxiosInstance().request<ApiResponse<T>>({
    ...config,
    url: path,
    method,
    data,
  });

  return result as unknown as T;
};

/** Chủ động làm mới phiên từ refresh token đã lưu trong keystore — dùng khi khởi động app */
export const refreshSession = (): Promise<string> => refreshAccessToken();

/** Đưa client về trạng thái sạch — chỉ dùng trong test */
export function __resetApiClientForTests(): void {
  memoryToken = null;
  refreshPromise = null;
  sessionEpoch = 0;
  unauthenticatedHandler = undefined;
  // Instance axios cũng phải bị xoá: nó nhớ `baseURL` chốt tại lúc tạo (đọc từ
  // getEnv() ở đúng một lần gọi getAxiosInstance() đầu tiên). Nếu test đổi
  // EXPO_PUBLIC_API_URL rồi resetEnvCache() mà không xoá instance này, request
  // tiếp theo vẫn âm thầm dùng baseURL cũ — resetEnvCache() trông như không
  // làm gì cả.
  axiosInstance = null;
}
