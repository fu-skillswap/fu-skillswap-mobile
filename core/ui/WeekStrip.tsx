/**
 * @file WeekStrip.tsx
 * @description Dải 7 ngày của thiết kế (`Booking.dc.html`, `MentorSchedule.dc.html`):
 * bảy ô bằng nhau cao 64–68, bo 16; ô đang chọn nền `accent` chữ trắng kèm bóng
 * nút; ô không chọn được viền đứt và mờ; có thể có chấm nhỏ dưới số ngày.
 */

import { Pressable, Text, View } from 'react-native';

import type { OTrongTuan } from '@/core/time/lichTuan';
import { colors, fonts, radius, shadows } from '@/core/ui/theme';

export interface WeekStripProps {
  days: readonly OTrongTuan[];
  /** `iso` của ngày đang chọn */
  selected: string | null;
  onSelect: (iso: string) => void;
  /** Ngày không chọn được (không có lịch, đã qua…) */
  isDisabled?: (day: OTrongTuan) => boolean;
  /** Ngày có chấm (có việc) */
  hasDot?: (day: OTrongTuan) => boolean;
  /** Tiền tố testID của từng ô: `${testIDPrefix}-${iso}` */
  testIDPrefix?: string;
}

export function WeekStrip({
  days,
  selected,
  onSelect,
  isDisabled,
  hasDot,
  testIDPrefix = 'ngay',
}: WeekStripProps) {
  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {days.map((o) => {
        const chon = o.iso === selected;
        const tat = isDisabled?.(o) ?? false;
        const cham = hasDot?.(o) ?? false;
        const mauChu = chon ? 'text-on-accent' : tat ? 'text-ink-muted' : 'text-ink';
        return (
          <Pressable
            key={o.iso}
            testID={`${testIDPrefix}-${o.iso}`}
            accessibilityRole="button"
            accessibilityLabel={`${o.tenThu} ${o.ngay} tháng ${o.thang}${tat ? ', không có lịch' : ''}`}
            accessibilityState={{ selected: chon, disabled: tat }}
            disabled={tat}
            onPress={() => onSelect(o.iso)}
            className={`flex-1 items-center justify-center ${
              chon ? 'border border-accent bg-accent' : tat ? 'border border-dashed border-line' : 'border border-line bg-surface'
            }`}
            style={[
              { height: hasDot ? 68 : 64, borderRadius: radius.md, gap: 2, opacity: tat ? 0.6 : 1 },
              chon ? shadows.button : null,
            ]}
          >
            <Text className={mauChu} style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
              {o.nhanThu}
            </Text>
            <Text className={mauChu} style={{ fontFamily: fonts.bold, fontSize: 17 }}>
              {String(o.ngay).padStart(2, '0')}
            </Text>
            {hasDot ? (
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: radius.full,
                  backgroundColor: cham ? (chon ? colors.onAccent : colors.accent) : 'transparent',
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
