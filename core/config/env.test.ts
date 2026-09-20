import { readEnv } from '@/core/config/env';

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
});
