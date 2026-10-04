/**
 * @file Chip.tsx
 * @description Thẻ pill. Thiết kế dùng ba dáng khác nhau nên gom vào một prop
 * `variant`, giá trị lấy đúng từ `renderVals()` của các màn hình:
 *
 * - `filter` (`Mentors`, `MyBookings`): cao 40, chọn thì nền `accent` chữ trắng,
 *   không chọn thì nền trắng viền `line` chữ `ink-body`.
 * - `slot` (`Booking`, khung giờ): cao 48, chọn thì viền 2px `accent` trên nền
 *   `surface-tint`, hết chỗ thì nền `neutral-soft` và gạch ngang chữ.
 * - `tag` (nhãn chủ đề trong card bài viết / mentor): nền `surface-tint`, chữ
 *   `accent` 12/600, mặc định KHÔNG bấm được.
 *
 * Vùng chạm: `filter` chỉ cao 40 theo thiết kế, nhỏ hơn mức 44 bắt buộc, nên
 * component bù bằng `hitSlop` dọc chứ không phóng to khối hiển thị.
 */

import { Pressable, Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

type NetChu = keyof typeof fonts;

export type ChipVariant = 'filter' | 'slot' | 'tag';

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Hết chỗ / không chọn được: `slot` gạch ngang chữ, các dáng khác mờ đi */
  disabled?: boolean;
  /** Không truyền thì chip là nhãn thuần, không có vai trò bấm */
  onPress?: () => void;
  variant?: ChipVariant;
  testID?: string;
}

interface Dang {
  khoi: string;
  chu: string;
  nen: string;
  chuHoatDong: string;
  chuChon: string;
  net: NetChu;
  netChon: NetChu;
}

const DANG: Record<ChipVariant, Dang> = {
  filter: {
    khoi: 'h-10 rounded-full px-3.5 border',
    chu: 'text-caption-lg',
    nen: 'border-line bg-surface',
    chuHoatDong: 'text-ink-body',
    chuChon: 'text-on-accent',
    net: 'semibold',
    netChon: 'bold',
  },
  slot: {
    khoi: 'h-control-input rounded-full px-3 border',
    chu: 'text-body',
    nen: 'border-line bg-surface',
    chuHoatDong: 'text-ink',
    chuChon: 'text-accent',
    net: 'semibold',
    netChon: 'bold',
  },
  tag: {
    khoi: 'rounded-full px-2.5 py-1',
    chu: 'text-caption',
    nen: 'bg-surface-tint',
    chuHoatDong: 'text-accent',
    chuChon: 'text-on-accent',
    net: 'semibold',
    netChon: 'bold',
  },
};

/** Nền + viền của chip theo từng trạng thái, đúng các giá trị trong thiết kế */
function lopKhoi(variant: ChipVariant, selected: boolean, disabled: boolean) {
  const d = DANG[variant];
  if (disabled) {
    return variant === 'slot' ? 'border-neutral-soft bg-neutral-soft' : `${d.nen} opacity-60`;
  }
  if (!selected) {
    return d.nen;
  }
  if (variant === 'slot') {
    return 'border-2 border-accent bg-surface-tint';
  }
  return variant === 'filter' ? 'border-accent bg-accent' : 'bg-accent';
}

export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  variant = 'filter',
  testID,
}: ChipProps) {
  const d = DANG[variant];
  const mauChu = disabled ? 'text-ink-muted' : selected ? d.chuChon : d.chuHoatDong;
  const net = disabled ? fonts.medium : fonts[selected ? d.netChon : d.net];

  const chu = (
    <Text
      className={`${d.chu} ${mauChu}`}
      style={{
        fontFamily: net,
        // `slot` hết chỗ: thiết kế gạch ngang chữ thay vì chỉ làm mờ.
        textDecorationLine: disabled && variant === 'slot' ? 'line-through' : 'none',
      }}
    >
      {label}
    </Text>
  );
  const lop = `items-center justify-center ${d.khoi} ${lopKhoi(variant, selected, disabled)}`;

  if (!onPress) {
    return (
      <View className={lop} testID={testID}>
        {chu}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      // Chip cao 40/48 — `hitSlop` kéo vùng chạm lên tối thiểu 44 mỗi chiều.
      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
      className={lop}
    >
      {chu}
    </Pressable>
  );
}
