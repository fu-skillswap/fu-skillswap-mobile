/**
 * @file EmptyState.tsx
 * @description Trạng thái rỗng dùng chung — phân biệt rõ với trạng thái lỗi:
 * rỗng nghĩa là gọi API thành công nhưng không có dữ liệu.
 *
 * Giá trị theo khối rỗng của `MyBookings`: padding 32/16, gap 8, tiêu đề
 * 16/700 màu `ink`, mô tả 13 màu `ink-muted`, nút phụ cao 44 nền `surface-tint`.
 *
 * `illustration` là prop chứ không phải ảnh Koko dựng cứng: bộ asset Koko
 * (`koko-reading.png`…) CHƯA có trong `assets/` của repo này — mục 3 của
 * HANDOFF.md nói phải lấy từ design system. Khi có ảnh thì màn hình truyền
 * `<Image …>` vào đây, không phải sửa component.
 */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/core/ui/Button';
import { fonts } from '@/core/ui/theme';

export function EmptyState({
  title,
  description,
  illustration,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  /** Hình minh hoạ phía trên tiêu đề (thiết kế dùng Koko 140×140) */
  illustration?: ReactNode;
  /** Nhãn nút phụ dưới mô tả; chỉ hiện khi có cả `onAction` */
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 py-8">
      {illustration}
      <Text
        className="text-center text-base text-ink"
        style={{ fontFamily: fonts.bold }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          className="text-center text-caption-lg text-ink-muted"
          style={{ fontFamily: fonts.regular }}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="pt-2">
          <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}
