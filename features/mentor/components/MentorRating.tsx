/**
 * @file MentorRating.tsx
 * @description Khối điểm đánh giá của mentor: ngôi sao + điểm + số lượt.
 *
 * Mọi quyết định "có được hiện điểm hay không" đi qua `moTaDiemDanhGia()` —
 * `features/mentor/rating.ts` là nơi DUY NHẤT biết luật đó. Component này không
 * được tự đọc `ratingAverage`, và không có nhánh nào cho ra một con số mặc định.
 *
 * Khi mentor CHƯA có đánh giá, cả ngôi sao LẪN con số đều biến mất, chỉ còn chữ
 * "Chưa có đánh giá". Giữ lại ngôi sao cũng đã là nói dối: một ngôi sao vàng
 * cạnh một chỗ trống trông như điểm đang tải, không như "chưa ai đánh giá".
 *
 * Dáng lấy từ `Mentors.dc.html`: sao 14px tô `#F59E0B`, điểm 12/600, số lượt
 * 12/400 màu `ink-muted` trong ngoặc.
 */

import { Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { colors, fonts } from '@/core/ui/theme';
import { moTaDiemDanhGia } from '@/features/mentor/rating';
import type { MentorReputation } from '@/features/mentor/types';

export interface MentorRatingProps {
  reputation: MentorReputation;
  /**
   * Ẩn phần "(N đánh giá)", chỉ còn sao và điểm.
   *
   * Dùng ở hàng ba chỉ số của màn hồ sơ: ở đó cột kế bên ĐÃ là "Lượt review",
   * nên in số lượt lần nữa vừa trùng thông tin vừa làm chữ tràn đè lên đường
   * kẻ chia cột (gặp thật trên máy ảo 04/10/2026).
   *
   * Nhánh "Chưa có đánh giá" KHÔNG đổi: luật không-hiện-điểm vẫn do
   * `moTaDiemDanhGia()` quyết, cờ này chỉ bớt phần đuôi khi ĐÃ có điểm.
   */
  anSoLuot?: boolean;
  testID?: string;
}

export function MentorRating({ reputation, anSoLuot = false, testID }: MentorRatingProps) {
  const mo = moTaDiemDanhGia(reputation);

  if (!mo.coDiem) {
    return (
      <View testID={testID} className="flex-row items-center">
        <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
          Chưa có đánh giá
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID} className="flex-row items-center gap-1">
      <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={0} />
      {/*
        testID nằm trên chính `Text` giữ con số, không trên khối bọc ngoài: test
        cần khẳng định được là KHÔNG có con số nào xuất hiện, và icon Lucide mang
        `aria-hidden` nên RNTL không tra được nó.
      */}
      <Text
        testID={testID ? `${testID}-diem` : undefined}
        className="text-caption text-ink"
        style={{ fontFamily: fonts.semibold }}
      >
        {mo.diem}
      </Text>
      {anSoLuot ? null : (
        <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
          ({mo.soLuot} đánh giá)
        </Text>
      )}
    </View>
  );
}
