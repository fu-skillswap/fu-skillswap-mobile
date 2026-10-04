/**
 * @file BookingSteps.tsx
 * @description Thanh tiến trình ba đoạn của luồng đặt lịch (`Booking.dc.html`,
 * `BookingConfirm.dc.html`): mỗi đoạn cao 6, bo tròn, đoạn đã qua màu `accent`,
 * đoạn chưa tới màu `line`.
 *
 * Thanh này chỉ để nhìn; trình đọc màn hình đã nghe "Bước 2/3" ở phụ đề header,
 * nên nó được ẩn khỏi cây trợ năng thay vì đọc lại lần nữa.
 */

import { View } from 'react-native';

export function BookingSteps({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <View
      testID="tien-trinh-dat-lich"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-row"
      style={{ gap: 6 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          testID={i < current ? 'doan-da-qua' : 'doan-chua-toi'}
          className={`flex-1 rounded-full ${i < current ? 'bg-accent' : 'bg-line'}`}
          style={{ height: 6 }}
        />
      ))}
    </View>
  );
}
