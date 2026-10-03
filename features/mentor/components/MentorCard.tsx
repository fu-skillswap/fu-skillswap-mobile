/**
 * @file MentorCard.tsx
 * @description Thẻ mentor trong danh sách, theo mẫu `<article>` của
 * `Mentors.dc.html`: card bo 24 nền trắng, viền `line`, bóng `shadows.card`,
 * padding 16, gap 12 — hàng avatar 56 bo 16, hàng nhãn, rồi chân thẻ có viền trên.
 *
 * ## Hai chỗ thiết kế KHÔNG khớp được với API, và đã xử thế nào
 *
 * 1. **"Từ 150.000 S-coins" ở chân thẻ bị BỎ.**
 *    `MentorDiscoveryCardResponse.java` không trả dịch vụ hay giá — giá chỉ có
 *    trong `MentorDiscoveryDetailResponse.services`. Muốn hiện giá thấp nhất thì
 *    phải gọi thêm một request chi tiết cho TỪNG thẻ, và dòng "Từ …" trong thiết
 *    kế là dữ liệu mẫu. Chỗ đó thay bằng số buổi đã dạy + tình trạng nhận học
 *    viên, cả hai đều có thật trên card.
 * 2. **Nút "Đặt lịch" gradient ở chân thẻ bị BỎ.** Màn `Booking` chưa dựng, nên
 *    đó sẽ là một nút chết — thứ repo này đã phải phá bỏ hai lần. Cả thẻ vẫn bấm
 *    được để mở hồ sơ, đúng như `href="MentorDetail.dc.html"` trên tên mentor.
 *
 * ## Đọc DTO
 *
 * Mọi trường đọc qua section LỒNG (`identity.*`, `reputation.*`, `match.score`).
 * Bản phẳng `mentorUserId`/`displayName`/`ratingState`/`matchScore` bị
 * `@JsonIgnore` nên KHÔNG có trong JSON, và đọc trượt ra `undefined` mà không có
 * lỗi kiểu nào chặn. `match.score` cũng không được dùng ở đây: nó có thể `null`
 * (nhất là khi sort khác `relevance`) và thẻ phải render đủ mà không cần nó.
 */

import { BadgeCheck, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/core/ui/Avatar';
import { Chip } from '@/core/ui/Chip';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, shadows, spacing } from '@/core/ui/theme';
import { MentorRating } from '@/features/mentor/components/MentorRating';
import { SupportLevelBadges } from '@/features/mentor/components/SupportLevelBadges';
import type { MentorDiscoveryCardResponse } from '@/features/mentor/types';

export interface MentorCardProps {
  mentor: MentorDiscoveryCardResponse;
  onPress: (mentorUserId: string) => void;
  /** Lý do gợi ý, chỉ có ở danh sách `/recommendations`; bỏ hẳn khối khi rỗng */
  matchReasons?: string[];
}

/** Tối đa hai lý do: thiết kế không có chỗ cho một đoạn văn trong thẻ */
const SO_LY_DO_TOI_DA = 2;

export function MentorCard({ mentor, onPress, matchReasons }: MentorCardProps) {
  const { identity, mentoring, evidence, reputation, availability } = mentor;

  // Thiết kế có đúng MỘT dòng phụ dưới tên ("Senior Product Manager · Google").
  // `headline` là trường đúng nghĩa đó; mentor chưa viết headline thì tụt về
  // phần mô tả chuyên môn, chứ không để lại một dòng trống.
  const dongPhu = identity.headline ?? mentoring.expertiseDescription;
  const lyDo = (matchReasons ?? []).slice(0, SO_LY_DO_TOI_DA);

  return (
    <Pressable
      accessibilityRole="button"
      // Nhãn trợ năng mang tên mentor: trình đọc màn hình đọc cả thẻ thành một
      // chuỗi dài, và "nút" không nói được nó mở hồ sơ của ai.
      accessibilityLabel={`Xem hồ sơ ${identity.displayName}`}
      onPress={() => onPress(identity.mentorUserId)}
      testID={`the-mentor-${identity.mentorUserId}`}
      className="gap-3 rounded-lg border border-line bg-surface"
      style={[{ padding: spacing.card }, shadows.card]}
    >
      <View className="flex-row gap-3">
        {/* Avatar 56 bo 16 nền `surface-tint` chữ `accent` 18/700 — đúng thiết kế. */}
        <Avatar name={identity.displayName} size={56} shape="rounded" />

        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text
              numberOfLines={1}
              className="shrink text-body-lg text-ink"
              style={{ fontFamily: fonts.bold }}
            >
              {identity.displayName}
            </Text>
            {identity.isVerified ? (
              // Icon Lucide mang `aria-hidden`, nên nhãn phải nằm trên View bọc
              // ngoài — nếu không, dấu xác minh hoàn toàn vô hình với trình đọc
              // màn hình.
              <View accessible accessibilityLabel="Đã xác minh" testID="dau-xac-minh">
                <BadgeCheck size={16} color={colors.accent} strokeWidth={2.2} />
              </View>
            ) : null}
          </View>

          {dongPhu ? (
            <Text
              numberOfLines={2}
              className="text-ink-body"
              style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 }}
            >
              {dongPhu}
            </Text>
          ) : null}

          <View className="pt-0.5">
            <MentorRating reputation={reputation} testID="diem-danh-gia" />
          </View>
        </View>
      </View>

      {/*
        Hàng nhãn của thiết kế. Nguồn thật là các môn học nổi bật mà backend trả
        (tối đa 2), hiện bằng mã môn vì tên môn dài hơn một pill. Không có môn nào
        thì tụt về ba mức hỗ trợ — cũng là dữ liệu thật và cùng dáng pill.
      */}
      {evidence.subjectHighlights.length > 0 ? (
        <View testID="mon-noi-bat" className="flex-row flex-wrap gap-2">
          {evidence.subjectHighlights.map((mon) => (
            <Chip key={mon.id} label={mon.subjectCode} variant="tag" />
          ))}
        </View>
      ) : (
        <SupportLevelBadges
          testID="muc-ho-tro"
          foundation={mentoring.foundationSupportLevel}
          outputReview={mentoring.outputReviewSupportLevel}
          direction={mentoring.directionSupportLevel}
        />
      )}

      {lyDo.length > 0 ? (
        <View testID="ly-do-goi-y" className="flex-row gap-1.5 rounded-md bg-surface-tint p-2.5">
          <Sparkles size={14} color={colors.accent} strokeWidth={2} />
          <View className="min-w-0 flex-1 gap-0.5">
            {lyDo.map((ly) => (
              <Text
                key={ly}
                className="text-caption text-accent"
                style={{ fontFamily: fonts.semibold }}
              >
                {ly}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {/* Chân thẻ: viền trên 1px `line`, padding-top 12 — đúng thiết kế. */}
      <View className="flex-row items-center gap-2 border-t border-line pt-3">
        <View className="min-w-0 flex-1">
          <Text className="text-tab-label text-ink-muted" style={{ fontFamily: fonts.regular }}>
            Đã dạy
          </Text>
          {/*
            Con số và đơn vị là HAI `Text` cạnh nhau, không phải một `Text` lồng
            `Text`: lồng vào thì node chữ ngoài mang children là một mảng
            `["30", " ", <Text/>]`, và `getByText('30')` của RNTL không khớp —
            tức con số trở thành thứ không test nào kiểm được.
          */}
          <View className="flex-row items-baseline gap-1">
            <Text
              testID="so-buoi-da-day"
              className="text-body-lg text-ink"
              style={{ fontFamily: fonts.bold }}
            >
              {reputation.completedSessions}
            </Text>
            <Text
              className="text-tab-label text-ink-muted"
              style={{ fontFamily: fonts.semibold }}
            >
              buổi
            </Text>
          </View>
        </View>
        {/*
          `availability.isAvailable` của CARD là `boolean` nguyên thuỷ phía Java,
          nên không-null — khác detail (`Boolean` đóng hộp). Vì vậy ở đây được
          phép rẽ hai nhánh thẳng, không cần nhánh "chưa rõ".
        */}
        <StatusBadge
          label={availability.isAvailable ? 'Đang nhận học viên' : 'Tạm không nhận'}
          tone={availability.isAvailable ? 'success' : 'neutral'}
          testID="tinh-trang-nhan-hoc"
        />
      </View>
    </Pressable>
  );
}
