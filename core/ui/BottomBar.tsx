/**
 * @file BottomBar.tsx
 * @description Thanh hành động cố định đáy màn hình. Thiết kế có hai dáng:
 *
 * - `flat` (mặc định — `Onboarding`, `MentorServiceDetail`): nền trắng,
 *   `border-top` 1px `line`, padding 14/20/30.
 * - `sheet` (`Booking`): bo 28 hai góc trên, bóng `0 -8px 32px rgba(15,45,107,0.08)`,
 *   padding 18/20/30 — dùng khi thanh còn chứa phần tóm tắt phía trên nút.
 *
 * Padding dưới 30 của thiết kế là để chừa thanh gesture của iPhone. Ở đây lấy
 * safe area thật thay vì hằng 30: trên máy không có notch 30px là khoảng trống
 * vô ích, còn trên máy notch cao hơn thì 30px lại không đủ.
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { shadows } from '@/core/ui/theme';

export interface BottomBarProps {
  /** Nút chính, luôn chiếm hết chỗ còn lại */
  primary: ReactNode;
  /** Nút phụ bên trái nút chính (ví dụ "Để sau"), co theo nội dung */
  secondary?: ReactNode;
  /** Khối nằm trên hàng nút (tóm tắt thời gian, tổng tiền…) */
  summary?: ReactNode;
  variant?: 'flat' | 'sheet';
  testID?: string;
}

export function BottomBar({
  primary,
  secondary,
  summary,
  variant = 'flat',
  testID,
}: BottomBarProps) {
  // Đọc context trực tiếp chứ KHÔNG dùng `useSafeAreaInsets()`: hook đó NÉM
  // lỗi khi không có `SafeAreaProvider` phía trên, và app này không tự dựng
  // provider — nó mượn provider mà native stack của expo-router dựng hộ. Một
  // thanh hành động không được phép làm sập màn hình chỉ vì nằm ngoài stack
  // (modal tự dựng, test, Storybook). Không có provider thì coi inset bằng 0 và
  // dùng nguyên 30px của thiết kế.
  const insets = useContext(SafeAreaInsetsContext);
  const leDuoi = insets?.bottom ?? 0;
  const laSheet = variant === 'sheet';

  return (
    <View
      testID={testID}
      className={`bg-surface ${laSheet ? '' : 'border-t border-line'}`}
      style={[
        {
          paddingTop: laSheet ? 18 : 14,
          paddingHorizontal: 20,
          // Padding dưới 30 của thiết kế trừ đi phần safe area đã chừa sẵn,
          // nhưng không bao giờ thấp hơn 14.
          paddingBottom: Math.max(14, 30 - leDuoi),
        },
        laSheet
          ? {
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              // Bóng của thiết kế là bóng HƯỚNG LÊN; `shadows.card` đổ xuống,
              // nên đảo dấu `height` và giữ nguyên bán kính/độ mờ.
              ...shadows.card,
              shadowOffset: { width: 0, height: -8 },
            }
          : null,
      ]}
    >
      {summary ? <View className="pb-3.5">{summary}</View> : null}
      <View className="flex-row items-center gap-2.5">
        {secondary}
        <View className="flex-1">{primary}</View>
      </View>
    </View>
  );
}
