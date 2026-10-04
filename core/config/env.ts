/**
 * @file env.ts
 * @description Đọc và kiểm tra biến môi trường EXPO_PUBLIC_* của app mobile.
 * Babel thay thế các biến EXPO_PUBLIC_* ngay lúc build nên bắt buộc đọc bằng
 * đường dẫn tĩnh `process.env.EXPO_PUBLIC_X`, không truy cập động theo tên.
 * Đây là nơi duy nhất trong app được chạm vào `process.env`.
 */

/** Cấu hình môi trường đã chuẩn hoá và kiểm tra */
export interface AppEnv {
  /** Origin của backend Spring Boot, không có dấu "/" ở cuối */
  apiUrl: string;
  /** Origin của AI service; chuỗi rỗng nghĩa là AI chưa được cấu hình (rủi ro R3 trong spec) */
  aiUrl: string;
  /** Google OAuth Web Client ID, phải trùng GOOGLE_CLIENT_ID của backend */
  googleWebClientId: string;
  /** true khi đã có aiUrl, dùng để bật/tắt các màn hình phụ thuộc AI */
  isAiConfigured: boolean;
  /** userId của tài khoản bot "SkillSwap AI"; rỗng nghĩa là không gắn badge AI cho bình luận nào */
  forumBotUserId: string;
  /** Biến môi trường có YÊU CẦU chế độ mock hay không — CHƯA tính tới `__DEV__` */
  mockModeRequested: boolean;
}

/** Nguồn biến môi trường thô, tách riêng để test được mà không đụng process.env */
export interface RawEnvSource {
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_AI_URL?: string;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
  EXPO_PUBLIC_FORUM_BOT_USER_ID?: string;
  EXPO_PUBLIC_MOCK_MODE?: string;
}

/** Bỏ khoảng trắng, dấu nháy thừa và dấu "/" ở cuối chuỗi URL */
function normalizeUrl(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '');
}

/**
 * Chuẩn hoá và kiểm tra một bộ biến môi trường.
 * @param source - Bộ biến thô (thường là `process.env`)
 * @returns Cấu hình đã chuẩn hoá
 * @throws Error nếu thiếu biến bắt buộc
 */
export function readEnv(source: RawEnvSource): AppEnv {
  const apiUrl = normalizeUrl(source.EXPO_PUBLIC_API_URL);
  const aiUrl = normalizeUrl(source.EXPO_PUBLIC_AI_URL);
  const googleWebClientId = (source.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  const forumBotUserId = (source.EXPO_PUBLIC_FORUM_BOT_USER_ID ?? '').trim();

  if (!apiUrl) {
    throw new Error('Thiếu EXPO_PUBLIC_API_URL trong cấu hình môi trường');
  }
  if (!googleWebClientId) {
    throw new Error('Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong cấu hình môi trường');
  }

  return {
    apiUrl,
    aiUrl,
    googleWebClientId,
    isAiConfigured: aiUrl.length > 0,
    forumBotUserId,
    mockModeRequested: (source.EXPO_PUBLIC_MOCK_MODE ?? '').trim() === '1',
  };
}

let cached: AppEnv | null = null;

/** Lấy cấu hình môi trường của app (đọc một lần rồi nhớ lại) */
export function getEnv(): AppEnv {
  if (!cached) {
    cached = readEnv({
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_AI_URL: process.env.EXPO_PUBLIC_AI_URL,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_FORUM_BOT_USER_ID: process.env.EXPO_PUBLIC_FORUM_BOT_USER_ID,
      EXPO_PUBLIC_MOCK_MODE: process.env.EXPO_PUBLIC_MOCK_MODE,
    });
  }
  return cached;
}

/** Xoá cache cấu hình — chỉ dùng trong test */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Chế độ mock có đang bật hay không.
 *
 * Bật thì MSW chạy ngay trong app chặn mọi `/api/*`, và `getGoogleIdToken()`
 * trả token giả — dùng để xem giao diện trên máy thật khi backend chưa sẵn sàng.
 *
 * `__DEV__` là vế BẮT BUỘC, không phải để cho đẹp: nó khiến bản build phát hành
 * không thể bật chế độ này bằng bất cứ biến môi trường nào. Đừng rút nó ra.
 */
export function isMockMode(): boolean {
  return __DEV__ && getEnv().mockModeRequested;
}
