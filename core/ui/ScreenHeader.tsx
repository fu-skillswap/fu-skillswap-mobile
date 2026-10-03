/**
 * @file ScreenHeader.tsx
 * @description Đầu màn hình con: nút back tròn 44 + tiêu đề 18/700, có thể kèm
 * "eyebrow" (chữ hoa nhỏ màu accent) hoặc dòng phụ 12px màu `ink-muted`.
 *
 * Màn hình tab dùng tiêu đề 26/700 không có nút back — truyền `onBack` rỗng để
 * bỏ nút, `size="lg"` để lấy cỡ chữ của màn tab.
 *
 * Không tự gọi `router.back()`: `core/ui` không được biết tới router, nên người
 * gọi truyền `onBack`.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/core/ui/theme';

export interface ScreenHeaderProps {
  title: string;
  /** Chữ hoa nhỏ màu accent phía trên tiêu đề (ví dụ "DỊCH VỤ TƯ VẤN 1:1") */
  eyebrow?: string;
  /** Dòng phụ dưới tiêu đề (ví dụ "Bước 2/3 · với Sarah Chen") */
  subtitle?: string;
  /** Có `onBack` thì hiện nút back tròn 44; không có thì bỏ hẳn nút */
  onBack?: () => void;
  /** Nút phụ nằm sát lề phải (nút lọc, nút cài đặt…) */
  trailing?: ReactNode;
  /** `sm` tiêu đề 18/700 (màn con) · `lg` tiêu đề 26/700 (màn tab) */
  size?: 'sm' | 'lg';
  testID?: string;
}

export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  trailing,
  size = 'sm',
  testID,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-3" testID={testID}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={onBack}
          testID="nut-quay-lai"
          className="items-center justify-center rounded-full border border-line bg-surface"
          style={{ width: spacing.touch, height: spacing.touch }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text
            className="text-tab-label text-accent"
            style={{ fontFamily: fonts.semibold, letterSpacing: 1.3 }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          className={size === 'lg' ? 'text-screen-title text-ink' : 'text-screen-title-sub text-ink'}
          style={{ fontFamily: fonts.bold }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}
