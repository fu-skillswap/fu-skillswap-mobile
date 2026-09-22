/**
 * @file jest.setup.ts
 * @description Thiết lập chạy trước mỗi test file. Đặt sẵn biến môi trường để
 * các module đọc cấu hình lúc import không ném lỗi trong môi trường test.
 */

process.env.EXPO_PUBLIC_API_URL ??= 'https://api.skillswap.asia';
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??= 'test-web-client-id.apps.googleusercontent.com';
process.env.EXPO_PUBLIC_FORUM_BOT_USER_ID ??= 'bot-user-id';

import axios from 'axios';

// MSW chặn ở tầng http của Node; trong Jest phải ép axios dùng adapter 'http'
// thay vì XMLHttpRequest thì handler mới bắt được request.
axios.defaults.adapter = 'http';

// `@expo/vector-icons` nạp font bất đồng bộ rồi setState khi xong. Trong test,
// việc đó xảy ra sau khi assertion đã chạy nên React cảnh báo "An update to Icon
// inside a test was not wrapped in act(...)". Không test nào assert vào icon, nên
// thay bằng một host component rỗng: cây vẫn render được, không còn tác dụng phụ.
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

