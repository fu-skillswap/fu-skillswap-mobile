const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * Giữ MSW và toàn bộ fixture mock ra khỏi bundle khi chế độ mock TẮT.
 *
 * Vì sao cần: đặt `require('msw/native')` bên trong một nhánh `if` không giữ
 * được gì. `require()` chỉ hoãn việc THỰC THI; Metro phân tích tĩnh và vẫn đưa
 * module vào graph bất kể nhánh nào chạy. Đã đo trên bundle thật
 * (`npx expo export --platform android`): 4.1MB → 5.0MB, tức +1.0MB (+26%), và
 * `grep` trên file `.hbc` tìm thấy cả `setupServer` lẫn fixture `HE180001`.
 *
 * Cách làm: đổi hướng `core/dev/mockHandlers` — điểm import DUY NHẤT của MSW và
 * của mọi handler mock — sang `core/dev/mockHandlers.empty.ts`, một file không
 * import gì cả.
 *
 * Mặc định (biến môi trường không đặt) là LOẠI BỎ mock. Hướng an toàn nằm ở phía
 * mặc định: quên đặt biến thì mất chế độ mock, không phải lỡ ship MSW.
 *
 * Lưu ý: đây là chuyện kích thước bundle và bề mặt tấn công. Chế độ mock vẫn
 * không thể KÍCH HOẠT trong bản phát hành dù có MSW trong bundle, vì
 * `isMockMode()` đòi `__DEV__` — xem `core/config/env.ts`.
 */
const batCheDoMock = process.env.EXPO_PUBLIC_MOCK_MODE === '1';
const duongDanMockHandlers = path.resolve(__dirname, 'core/dev/mockHandlers.ts');
const duongDanBanRong = path.resolve(__dirname, 'core/dev/mockHandlers.empty.ts');

const resolveRequestGoc = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ketQua = resolveRequestGoc
    ? resolveRequestGoc(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

  if (
    !batCheDoMock &&
    ketQua &&
    ketQua.type === 'sourceFile' &&
    path.resolve(ketQua.filePath) === duongDanMockHandlers
  ) {
    return { type: 'sourceFile', filePath: duongDanBanRong };
  }

  return ketQua;
};

module.exports = withNativeWind(config, { input: './global.css' });
