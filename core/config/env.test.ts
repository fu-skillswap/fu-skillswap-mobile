import { isMockMode, readEnv, resetEnvCache } from '@/core/config/env';

describe('readEnv', () => {
  it('chuẩn hoá URL: bỏ khoảng trắng, dấu nháy và dấu / ở cuối', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: ' "https://api.skillswap.asia/" ',
      EXPO_PUBLIC_AI_URL: 'https://ai.skillswap.asia/',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '  abc.apps.googleusercontent.com  ',
    });

    expect(env.apiUrl).toBe('https://api.skillswap.asia');
    expect(env.aiUrl).toBe('https://ai.skillswap.asia');
    expect(env.googleWebClientId).toBe('abc.apps.googleusercontent.com');
  });

  it('coi AI là chưa cấu hình khi EXPO_PUBLIC_AI_URL trống', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com',
    });

    expect(env.aiUrl).toBe('');
    expect(env.isAiConfigured).toBe(false);
  });

  it('báo lỗi rõ ràng khi thiếu EXPO_PUBLIC_API_URL', () => {
    expect(() =>
      readEnv({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com' }),
    ).toThrow('Thiếu EXPO_PUBLIC_API_URL');
  });

  it('báo lỗi rõ ràng khi thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', () => {
    expect(() => readEnv({ EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia' })).toThrow(
      'Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    );
  });

  it('đọc forumBotUserId, để rỗng khi không cấu hình', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com',
    });

    expect(env.forumBotUserId).toBe('');
  });

  it('forumBotUserId được cắt khoảng trắng thừa', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com',
      EXPO_PUBLIC_FORUM_BOT_USER_ID: '  bot-user-id  ',
    });

    expect(env.forumBotUserId).toBe('bot-user-id');
  });
});

/**
 * `__DEV__` được khai báo là `const` trong typings của React Native nên không
 * ghi trực tiếp được; test phải đi qua `globalThis`. Gói lại thành hàm để cast
 * chỉ tồn tại đúng một chỗ.
 */
function datCoDev(value: boolean): void {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}

/**
 * Gán biến môi trường mock mode. `undefined` phải XOÁ biến chứ không gán —
 * `process.env.X = undefined` trong Node biến giá trị thành chuỗi "undefined",
 * và biến rác đó sống sót sang các file test khác dùng chung tiến trình worker.
 */
function datCoMock(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_MOCK_MODE;
  } else {
    process.env.EXPO_PUBLIC_MOCK_MODE = value;
  }
}

describe('isMockMode', () => {
  const devBanDau = __DEV__;
  const coBanDau = process.env.EXPO_PUBLIC_MOCK_MODE;

  afterEach(() => {
    datCoDev(devBanDau);
    datCoMock(coBanDau);
    resetEnvCache();
  });

  it('bản dev và cờ bật thì mock mode bật', () => {
    datCoDev(true);
    datCoMock('1');
    resetEnvCache();

    expect(isMockMode()).toBe(true);
  });

  it('bản dev nhưng cờ tắt thì mock mode tắt', () => {
    datCoDev(true);
    datCoMock('');
    resetEnvCache();

    expect(isMockMode()).toBe(false);
  });

  it('BẢN PHÁT HÀNH thì mock mode LUÔN tắt, kể cả khi cờ bật', () => {
    // Đây là thứ duy nhất ngăn một bản build lên Play Store đi kèm đường vòng
    // qua đăng nhập. Nếu ai đó rút `__DEV__` ra khỏi biểu thức, app phát hành
    // sẽ nhận token giả và tự coi là đã đăng nhập.
    datCoDev(false);
    datCoMock('1');
    resetEnvCache();

    expect(isMockMode()).toBe(false);
  });

  it('chỉ đúng chuỗi "1" mới bật, các giá trị lấp lửng thì không', () => {
    // Một biến môi trường bị set thành "false" hay "0" là ý định TẮT. Dùng
    // `Boolean(value)` ở đây sẽ bật mock mode cho cả hai chuỗi đó.
    datCoDev(true);
    for (const value of ['0', 'false', 'no', 'true']) {
      datCoMock(value);
      resetEnvCache();
      expect(isMockMode()).toBe(false);
    }
  });

  it('cờ bật nhưng có khoảng trắng hai đầu thì vẫn bật', () => {
    datCoDev(true);
    datCoMock('  1  ');
    resetEnvCache();

    expect(isMockMode()).toBe(true);
  });

  it('readEnv ghi lại YÊU CẦU mock mode tách khỏi __DEV__', () => {
    // `mockModeRequested` chỉ nói "biến môi trường có xin mock mode hay không",
    // không dính tới `__DEV__` — nhờ vậy `isMockMode()` mới là nơi DUY NHẤT
    // trong codebase nhân thêm vế `__DEV__`.
    expect(readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com',
      EXPO_PUBLIC_MOCK_MODE: '1',
    }).mockModeRequested).toBe(true);

    expect(readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.skillswap.asia',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'abc.apps.googleusercontent.com',
    }).mockModeRequested).toBe(false);
  });
});
