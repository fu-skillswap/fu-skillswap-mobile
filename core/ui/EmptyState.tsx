/**
 * @file EmptyState.tsx
 * @description Trạng thái rỗng dùng chung — phân biệt rõ với trạng thái lỗi:
 * rỗng nghĩa là gọi API thành công nhưng không có dữ liệu.
 *
 * Giá trị theo khối rỗng của `MyBookings`: padding 32/16, gap 8, tiêu đề
 * 16/700 màu `ink`, mô tả 13 màu `ink-muted`, nút phụ cao 44 nền `surface-tint`.
 *
 * `illustration` là prop chứ không phải ảnh Koko dựng cứng, và nó phải ở lại như
 * vậy: thiết kế dùng TƯ THẾ KHÁC NHAU theo ngữ cảnh (đang đọc cho danh sách bài
 * viết, "404" cho tìm-mà-không-thấy, tư thế chuẩn cho việc chưa làm). Dựng cứng
 * một tư thế vào đây là buộc mọi khối rỗng của app nói cùng một câu.
 *
 * Màn hình truyền `<BrandImage source={KOKO_READING} size={140} … />` vào đây;
 * `core/ui/BrandImage.tsx` lo kích thước tường minh, `resizeMode="contain"` và
 * việc ẩn ảnh trang trí khỏi trình đọc màn hình. Cỡ 140 là cỡ của khối rỗng duy
 * nhất mà thiết kế vẽ kèm số đo (`MyBookings.dc.html` dòng 35).
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
