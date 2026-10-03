/**
 * @file FilterTabs.tsx
 * @description Hàng chip lọc cuộn ngang ở đầu `Mentors` và `MyBookings`.
 * Chỉ là lớp bố cục mỏng quanh `Chip variant="filter"` — mọi màu sắc và trạng
 * thái nằm ở `Chip`, ở đây chỉ có khoảng cách 8px và việc tràn ra lề phải
 * (thiết kế dùng `margin-right: -20px` để chip cuối lấn ra khỏi lề 20px).
 */

import { ScrollView } from 'react-native';

import { Chip } from '@/core/ui/Chip';
import { spacing } from '@/core/ui/theme';

export interface FilterTabItem<T extends string> {
  value: T;
  label: string;
}

export interface FilterTabsProps<T extends string> {
  items: readonly FilterTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nhãn cho trình đọc màn hình, ví dụ "Lọc lịch đặt" */
  accessibilityLabel: string;
  testID?: string;
}

export function FilterTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: FilterTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      // Lề phải âm: chip cuối cùng tràn qua lề màn hình để người dùng thấy
      // hàng còn cuộn được.
      style={{ marginRight: -spacing.gutter }}
      contentContainerStyle={{ gap: 8, paddingRight: spacing.gutter }}
    >
      {items.map((item) => (
        <Chip
          key={item.value}
          label={item.label}
          selected={item.value === value}
          onPress={() => onChange(item.value)}
          testID={`${testID ?? 'loc'}-${item.value}`}
        />
      ))}
    </ScrollView>
  );
}
