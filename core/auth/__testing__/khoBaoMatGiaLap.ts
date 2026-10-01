/**
 * @file khoBaoMatGiaLap.ts
 * @description Keystore giả giữ trong RAM, thay cho `expo-secure-store` trong test.
 * CHỈ dùng từ test (`jest.mock`), không có đường nào từ code app tới đây.
 *
 * Vì sao tồn tại: mọi test cần tới refresh token đã lưu đều mock đúng ở biên
 * native (`expo-secure-store`) chứ KHÔNG mock `@/core/auth/session` — nhờ vậy
 * `session.ts` thật luôn nằm trong đường chạy và không test nào kiểm trên một
 * seam do chính nó dựng ra. Gom hình dạng mock vào MỘT chỗ để chỉ có một chỗ
 * phải đối chiếu với package thật.
 *
 * Hình dạng dưới đây khớp export THẬT của `expo-secure-store@57.0.4` — đã mở
 * `node_modules/expo-secure-store/package.json` (`"main": "build/SecureStore.js"`)
 * và chính file đó để đọc: module CHỈ có named export và **KHÔNG có default
 * export**. Mock bịa thêm `default` sẽ làm `import SecureStore from
 * 'expo-secure-store'` chạy được trong test nhưng vỡ trên máy thật.
 *
 * Chỉ dựng lại ba hàm `session.ts` dùng tới. Thêm hàm chưa ai gọi là tự bịa ra
 * hành vi không có gì đối chiếu.
 */

/**
 * Tạo một keystore giả mới, độc lập.
 * Gọi trong factory của `jest.mock`:
 * `jest.mock('expo-secure-store', () => require('@/core/auth/__testing__/khoBaoMatGiaLap').taoKhoBaoMatGiaLap());`
 */
export function taoKhoBaoMatGiaLap() {
  const kho = new Map<string, string>();
  return {
    __esModule: true,
    // `getItemAsync` thật resolve `null` khi chưa có khoá (doc Expo v57), KHÔNG
    // phải `undefined` — giữ đúng điều đó ở đây, nếu không test sẽ xanh nhờ một
    // hành vi mà thiết bị thật không có.
    getItemAsync: jest.fn(async (key: string) => (kho.has(key) ? kho.get(key) : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      kho.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      kho.delete(key);
    }),
  };
}
