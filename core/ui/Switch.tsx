/**
 * @file Switch.tsx
 * @description Công tắc 52×30 của thiết kế (`MentorServiceDetail`, `MentorServices`):
 * rãnh bo tròn, núm trắng 24 cách mép 3px, trượt sang phải khi bật.
 *
 * Không dùng `Switch` của React Native: nó vẽ bằng control hệ điều hành nên trên
 * Android ra màu Material và kích thước khác, không khớp 52×30 của thiết kế.
 */

import { Pressable, View } from 'react-native';

import { colors, radius } from '@/core/ui/theme';

/** Kích thước lấy đúng từ `renderVals()` của `MentorServiceDetail` */
const RANH_RONG = 52;
const RANH_CAO = 30;
const NUM = 24;
const LE = 3;

/**
 * Màu rãnh lúc TẮT. `#C9D6EE` chỉ xuất hiện trong style tính động của thiết kế,
 * KHÔNG có trong `tokens.json`, nên không thêm được vào `core/ui/theme.ts`
 * (`theme.test.ts` canh `colors` khớp 1:1 với `tokens.json`). Giữ ở đây, cạnh
 * component duy nhất dùng nó, thay vì bịa thêm một token ngoài thiết kế.
 */
const MAU_RANH_TAT = '#C9D6EE';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Bắt buộc: công tắc không có nhãn chữ bên trong nên phải tự khai báo */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID}
      // Rãnh cao 30, thấp hơn mức chạm 44 — bù bằng `hitSlop` dọc 7px mỗi phía.
      hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }}
      className={`shrink-0 justify-center ${disabled ? 'opacity-50' : ''}`}
      style={{
        width: RANH_RONG,
        height: RANH_CAO,
        borderRadius: radius.full,
        backgroundColor: value ? colors.accent : MAU_RANH_TAT,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: LE,
          left: value ? RANH_RONG - NUM - LE : LE,
          width: NUM,
          height: NUM,
          borderRadius: radius.full,
          backgroundColor: colors.white,
        }}
      />
    </Pressable>
  );
}
