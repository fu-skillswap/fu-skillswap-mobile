/**
 * @file banPhim.ts
 * @description Bù trừ cho `KeyboardAvoidingView` trên iOS.
 *
 * `KeyboardAvoidingView` đo vị trí của chính nó so với khung CHA, không phải so
 * với màn hình. Đặt trong `Screen` (SafeAreaView) thì khung cha đã bị đẩy xuống
 * một đoạn bằng vùng an toàn phía trên (tai thỏ/Dynamic Island, 47–59pt), nên nó
 * tính thiếu đúng chừng đó và ô nhập vẫn bị bàn phím che mất một phần. Màn nằm
 * dưới thanh tiêu đề native của Stack còn thiếu thêm chiều cao thanh đó.
 */

import { HeaderHeightContext } from 'expo-router/react-navigation';
import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Giá trị cho `keyboardVerticalOffset`.
 * @param phanTrenThem - Phần nằm trên `KeyboardAvoidingView` mà KHÔNG thuộc vùng an
 *   toàn, ví dụ chiều cao thanh tiêu đề native của Stack
 */
export function useBuTruBanPhim(phanTrenThem = 0): number {
  // Đọc context trực tiếp thay vì `useSafeAreaInsets()` — cùng lý do như
  // `BottomBar`: thiếu provider (test, modal tự dựng) thì coi inset bằng 0 chứ
  // không làm sập màn.
  const insets = useContext(SafeAreaInsetsContext);
  return (insets?.top ?? 0) + phanTrenThem;
}

/**
 * Giá trị cho `keyboardVerticalOffset` của một màn nằm DƯỚI thanh tiêu đề native
 * của Stack (`headerShown: true`, ví dụ `app/forum/_layout.tsx`).
 *
 * Khác `useBuTruBanPhim`: dưới thanh tiêu đề, `SafeAreaView` của `Screen` không
 * chạm tai thỏ nên vùng an toàn phía trên của nó là 0, và mép trên của nội dung
 * nằm đúng ở đáy thanh tiêu đề. `HeaderHeightContext` đã gồm cả thanh trạng thái,
 * nên cộng thêm `insets.top` là bù hai lần và ô nhập nhảy cao lơ lửng.
 *
 * Đọc context trực tiếp thay vì `useHeaderHeight()`: hook đó ném lỗi khi không
 * có navigator (test, màn dựng rời). Không có thanh tiêu đề thì lùi về
 * `useBuTruBanPhim()`.
 */
export function useBuTruBanPhimDuoiHeader(): number {
  const chieuCaoHeader = useContext(HeaderHeightContext);
  const buTruKhongHeader = useBuTruBanPhim();
  return chieuCaoHeader ?? buTruKhongHeader;
}
