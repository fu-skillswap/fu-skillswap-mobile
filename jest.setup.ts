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

/**
 * `@expo/vector-icons` nạp font bất đồng bộ rồi setState khi xong. Trong test,
 * việc đó xảy ra sau khi assertion đã chạy nên React cảnh báo "An update to Icon
 * inside a test was not wrapped in act(...)".
 *
 * Mock phải giữ ĐÚNG hình dạng export thật (`@expo/vector-icons/Ionicons.js` là
 * ESM, default là đối tượng do `createIconSet` tạo, có kèm các static `Button`,
 * `font`, `glyphMap`, `loadFont`). Trả về một chuỗi thì cây vẫn render được,
 * nhưng chuỗi là primitive nên mất sạch static — ai viết `useFonts(Ionicons.font)`
 * sau này sẽ chỉ vỡ trong test chứ không vỡ trên máy thật, đúng cái bẫy
 * "mock bịa hình dạng package" repo này đã dính nhiều lần.
 *
 * Mock này KHÔNG che được lỗi tên icon sai: `name` vẫn do `tsc` kiểm.
 */
function mockIconSet() {
  const Icon = () => null;
  Icon.displayName = 'Ionicons';
  Icon.Button = () => null;
  Icon.font = {};
  Icon.glyphMap = {};
  Icon.loadFont = async () => {};
  Icon.getImageSource = async () => null;
  return Icon;
}

jest.mock('@expo/vector-icons/Ionicons', () => ({ __esModule: true, default: mockIconSet() }));
// Mock cả barrel: `import { Ionicons } from '@expo/vector-icons'` đi đường khác,
// không dính mock ở trên, và cảnh báo act() sẽ quay lại mà không ai hiểu vì sao.
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: mockIconSet() }));
