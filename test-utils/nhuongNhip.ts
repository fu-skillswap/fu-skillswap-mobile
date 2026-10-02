/**
 * @file nhuongNhip.ts
 * @description Các hàm "nhường một nhịp BÊN TRONG act()" dùng chung cho mọi file
 * test render component. Chỗ duy nhất giữ các con số chờ, thay vì chép lại trong
 * từng file test.
 *
 * VÌ SAO LÀ MỘT THƯ MỤC RIÊNG Ở GỐC REPO, KHÔNG PHẢI `__tests__/` HAY `core/`:
 * - Không đặt được trong `__tests__/`: `testMatch` thực tế của repo là mặc định
 *   của Jest (preset `jest-expo` không ghi đè `testMatch` — kiểm bằng
 *   `npx jest --listTests` hoặc thông báo "No tests found" của Jest), và mẫu đầu
 *   tiên là `**​/__tests__/**​/*.[jt]s?(x)`: MỌI file .ts trong `__tests__/` đều bị
 *   coi là một test suite, nên file helper sẽ thành suite rỗng và `npm test` đỏ.
 *   Không sửa được `package.json` để lách.
 * - Không đặt trong `core/`: `core/` là code chạy thật trên thiết bị và có luật
 *   "`core/` không import từ `features/`"; nhét module chỉ-dùng-trong-test vào đó
 *   làm mờ ranh giới đó. Thư mục `test-utils/` ở gốc nói rõ nó là gì.
 * - `moduleNameMapper` `^@/(.*)$` trỏ về gốc repo, nên cả test ở `__tests__/...`
 *   lẫn test colocate trong `features/...` đều import được bằng
 *   `@/test-utils/nhuongNhip`.
 */

import { act } from '@testing-library/react-native';

/** Nhường `ms` mili giây thời gian thật, BÊN TRONG một act() đã await */
async function nhuong(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/**
 * Nhường một nhịp cho `VirtualizedList` dọn hàng đợi của nó, gọi ở CUỐI mỗi test
 * có render danh sách.
 *
 * FlatList gom việc render ô vào `_updateCellsToRenderBatcher` — một bộ hẹn giờ
 * ~50ms. Nếu nó nổ trong khoảng giữa lúc thân test kết thúc và lúc RNTL gỡ cây,
 * React cập nhật ngoài phạm vi act và in cảnh báo; chạy 6 lần mới bẩn 1 lần nên
 * rất dễ bị kết luận nhầm là đã hết.
 *
 * Phải gọi trong THÂN test chứ không đặt được vào `afterEach`: auto-cleanup của
 * RNTL đăng ký `afterEach` ngay lúc import và jest-circus chạy hook theo đúng
 * thứ tự khai báo, nên nó luôn gỡ cây trước mọi `afterEach` viết ở đây (kiểm
 * chứng: gọi `screen.unmount()` trong afterEach ném "`render` function has not
 * been called").
 */
export async function donHangDoiDanhSach() {
  await nhuong(60);
}

/**
 * Nhường đủ lâu để một bộ hẹn giờ debounce nổ BÊN TRONG act(), gọi sau lần gõ
 * CUỐI vào một ô tìm kiếm có `useDebouncedValue`.
 *
 * `delayMs` phải là đúng con số của màn hình đang test (ví dụ
 * `DO_TRE_TIM_KIEM_MS = 350` ở `ForumFeedScreen`), không phải một con số đoán.
 * Hàm tự cộng thêm một khoảng dư để không chạy đua với chính hạn chót.
 *
 * VÌ SAO CẦN, VÀ VÌ SAO `donHangDoiDanhSach()` (60ms) KHÔNG THAY ĐƯỢC:
 * - 60ms chỉ đủ cho bộ gom ô ~50ms của `FlatList`. Debounce tìm kiếm là 350ms,
 *   gấp gần 6 lần — hẹn giờ debounce còn treo nguyên khi `donHangDoiDanhSach()`
 *   trả về.
 * - Cảnh báo "not wrapped in act(...)" chỉ phát ra khi
 *   `IS_REACT_ACT_ENVIRONMENT === true` VÀ `ReactSharedInternals.actQueue === null`
 *   (xem `warnIfUpdatesNotWrappedWithActDEV`). Trong thân test, `fireEvent` bọc
 *   act (actQueue khác null) và `waitFor` của RNTL chạy trong `wrapAsync` — hàm
 *   này TẮT act-environment ngay ĐỒNG BỘ lúc gọi — nên cả hai chỗ đó đều im
 *   lặng. Khe thật sự nguy hiểm là lúc Jest chuyển từ thân test sang `afterEach`
 *   gỡ cây: ở đó act-environment đã bật lại mà không còn act nào bọc.
 * - Khe đó bình thường chỉ dài dưới một mili giây, nên lỗi phụ thuộc tải: chỉ khi
 *   4 worker của `npm test` tranh CPU và OS cho worker nghỉ đúng vào lúc hạn
 *   debounce tới thì cú `setDebounced` mới rơi vào đó. Vì vậy chạy riêng một file
 *   luôn sạch, còn `npm test` bẩn vài phần trăm số lần — và vì vậy "chạy 5 lần
 *   thấy sạch" không chứng minh được gì.
 *
 * Gọi hàm này làm việc đó thành TẤT ĐỊNH: hạn debounce tới khi còn ở trong act.
 */
export async function nhuongChoDebounce(delayMs: number) {
  await nhuong(delayMs + 50);
}
