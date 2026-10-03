/**
 * @file SegmentedControl.tsx
 * @description Bộ chọn 2–3 mục chia đều bề ngang: khung nền `surface-tint`
 * padding 4 bo tròn, mỗi mục cao 40 bo tròn; mục đang chọn nền trắng chữ
 * `accent` 13/700, mục còn lại trong suốt chữ `ink-body` 13/600.
 *
 * Giá trị lấy từ `MentorDetail` / `MentorWallet` / `MentorSchedule` /
 * `MentorServices` — bốn màn hình dùng đúng một bộ số.
 *
 * Khác `FilterTabs` ở chỗ: `FilterTabs` cuộn ngang và lọc một danh sách,
 * `SegmentedControl` chia đều và đổi hẳn nội dung đang xem.
 */

import { Pressable, Text, View } from 'react-native';

import { fonts, shadows } from '@/core/ui/theme';

export interface SegmentedItem<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="flex-row gap-1 rounded-full bg-surface-tint p-1"
    >
      {items.map((item) => {
        const dangChon = item.value === value;

        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: dangChon }}
            onPress={() => onChange(item.value)}
            testID={`${testID ?? 'phan-doan'}-${item.value}`}
            // Mục cao 40 + padding 4 của khung = 48, đủ vùng chạm 44.
            className={`h-10 flex-1 items-center justify-center rounded-full ${dangChon ? 'bg-surface' : ''}`}
            // Thiết kế cho mục đang chọn bóng `0 2px 8px rgba(15,45,107,0.08)`,
            // gần `shadows.card` nhưng nhạt hơn; repo không tự thêm kiểu bóng
            // thứ ba nên dùng luôn `shadows.card`.
            style={dangChon ? shadows.card : null}
          >
            <Text
              className={`text-caption-lg ${dangChon ? 'text-accent' : 'text-ink-body'}`}
              style={{ fontFamily: dangChon ? fonts.bold : fonts.semibold }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
