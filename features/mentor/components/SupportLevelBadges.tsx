/**
 * @file SupportLevelBadges.tsx
 * @description Ba mức hỗ trợ của mentor (nền tảng / review bài / định hướng),
 * thang 1–4 theo `mentor-discovery.md` §3.
 *
 * Mức `null` nghĩa là mentor **CHƯA KHAI**, khác hẳn khai mức thấp nhất — nên nó
 * bị bỏ hẳn khỏi giao diện thay vì hiện `0/4`. Hiện 0 cho cái chưa khai là bịa ra
 * một thông tin backend không nói, và lại là thông tin xấu cho mentor.
 *
 * Dáng dùng `Chip variant="tag"` của `core/ui/` — đúng pill nền `surface-tint`
 * chữ `accent` 12/600 mà `Mentors.dc.html` vẽ cho hàng nhãn trong thẻ mentor.
 */

import { View } from 'react-native';

import { Chip } from '@/core/ui/Chip';

export interface SupportLevelBadgesProps {
  foundation: number | null;
  outputReview: number | null;
  direction: number | null;
  testID?: string;
}

export function SupportLevelBadges({
  foundation,
  outputReview,
  direction,
  testID,
}: SupportLevelBadgesProps) {
  const cacMuc = [
    { nhan: 'Nền tảng', muc: foundation },
    { nhan: 'Review bài', muc: outputReview },
    { nhan: 'Định hướng', muc: direction },
  ].filter((item): item is { nhan: string; muc: number } => item.muc != null);

  // Cả ba đều chưa khai thì không render gì — một hàng trống vẫn ăn khoảng cách
  // `gap` của khối cha và để lại một lỗ không ai hiểu vì sao có.
  if (cacMuc.length === 0) {
    return null;
  }

  return (
    <View testID={testID} className="flex-row flex-wrap gap-2">
      {cacMuc.map((item) => (
        <Chip key={item.nhan} label={`${item.nhan} ${item.muc}/4`} variant="tag" />
      ))}
    </View>
  );
}
