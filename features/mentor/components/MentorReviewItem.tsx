/**
 * @file MentorReviewItem.tsx
 * @description Một đánh giá trong tab "Đánh giá" của hồ sơ mentor.
 *
 * `MentorReviewResponse.rating` là `Integer` 1–5 của MỘT người đánh giá, nên nó
 * luôn có và luôn được hiện — khác hẳn `reputation.ratingAverage` của cả mentor
 * (thứ phải đi qua `moTaDiemDanhGia()`). Ở đây không có luật "chưa có đánh giá":
 * nếu đang render item này thì đánh giá đó tồn tại.
 *
 * `createdAt` là `LocalDateTime` KHÔNG offset, nên đi qua
 * `dinhDangNgay()` của `core/time/localDateTime.ts` chứ KHÔNG qua `new Date()` —
 * `new Date("2026-09-28T23:30:00")` đọc thành giờ địa phương của máy và có thể
 * nhảy sang ngày khác ở múi giờ khác. Đọc không ra thì bỏ hẳn dòng ngày.
 */

import { Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Avatar } from '@/core/ui/Avatar';
import { colors, fonts } from '@/core/ui/theme';
import { dinhDangNgay } from '@/core/time/localDateTime';
import type { MentorReviewResponse } from '@/features/mentor/types';

export interface MentorReviewItemProps {
  review: MentorReviewResponse;
}

export function MentorReviewItem({ review }: MentorReviewItemProps) {
  const ngay = dinhDangNgay(review.createdAt);

  return (
    <View
      testID={`danh-gia-${review.reviewId}`}
      className="gap-2 rounded-lg border border-line bg-surface p-4"
    >
      <View className="flex-row items-center gap-2.5">
        <Avatar name={review.reviewerDisplayName} size={40} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
            {review.reviewerDisplayName}
          </Text>
          {ngay ? (
            <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
              {ngay}
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1" accessible accessibilityLabel={`${review.rating} trên 5 sao`}>
          <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={0} />
          <Text className="text-caption text-ink" style={{ fontFamily: fonts.semibold }}>
            {review.rating}/5
          </Text>
        </View>
      </View>

      {/* Người đánh giá chỉ chấm sao mà không viết gì là chuyện thường — bỏ hẳn
          khối nhận xét thay vì để một dòng trống. */}
      {review.comment ? (
        <Text
          className="text-ink-body"
          style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}
        >
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}
