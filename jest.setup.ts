/**
 * @file jest.setup.ts
 * @description Thiết lập chạy trước mỗi test file. Đặt sẵn biến môi trường để
 * các module đọc cấu hình lúc import không ném lỗi trong môi trường test.
 */

process.env.EXPO_PUBLIC_API_URL ??= 'https://api.skillswap.asia';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??= 'test-web-client-id.apps.googleusercontent.com';
