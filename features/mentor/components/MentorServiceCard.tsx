/**
 * @file MentorServiceCard.tsx
 * @description Một dịch vụ mentor mở bán, theo thẻ dịch vụ của
 * `MentorDetail.dc.html`: card bo 24 nền trắng, ô icon 44 bo 16 nền
 * `surface-tint`, tên 15/700, dòng phụ 12 `ink-muted`, giá 16/800 bên phải kèm
 * nhãn "S-COINS" 10/700 giãn chữ.
 *
 * Thẻ này là **TĨNH, không `Pressable`**. Thiết kế có nút "Đặt lịch · 150.000
 * S-coins" dẫn sang màn `Booking`, nhưng màn đó CHƯA dựng: chọn khung giờ, báo
 * giá và thanh toán thuộc đợt sau. Một ô bấm được mà không đi đâu là nút chết,
 * thứ repo này đã phải phá bỏ hai lần — nên ở đây không có `onPress`, không có
 * `accessibilityRole="button"`, và không có CTA nào mời người dùng chạm.
 *
 * Giá đi qua `moTaGiaDichVu()` — nơi duy nhất biết phân biệt "miễn phí", "có
 * giá" và "chưa có giá". Đừng nội suy `priceScoin` ở đây.
 */

import { Clock, FileText } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/core/ui/theme';
import { moTaGiaDichVu, moTaThoiLuong } from '@/features/mentor/serviceDisplay';
import type { MentorServiceResponse } from '@/features/mentor/types';

export interface MentorServiceCardProps {
  service: MentorServiceResponse;
}

export function MentorServiceCard({ service }: MentorServiceCardProps) {
  const gia = moTaGiaDichVu(service);

  return (
    <View
      testID={`dich-vu-${service.serviceId}`}
      className="flex-row gap-3 rounded-lg border border-line bg-surface"
      style={{ padding: spacing.card }}
    >
      <View
        className="shrink-0 items-center justify-center bg-surface-tint"
        style={{ width: spacing.touch, height: spacing.touch, borderRadius: radius.md }}
      >
        <FileText size={22} color={colors.accent} strokeWidth={2} />
      </View>

      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
          {service.title}
        </Text>
        <View className="flex-row items-center gap-1">
          <Clock size={14} color={colors.inkMuted} strokeWidth={2} />
          <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
            {moTaThoiLuong(service)}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          className="text-caption text-ink-body"
          style={{ fontFamily: fonts.regular, lineHeight: 18 }}
        >
          {service.description}
        </Text>
        {/*
          `maintainPostSessionChat` là `boolean` nguyên thuỷ phía Java nên
          không-null. Chỉ nói khi nó BẬT: "không duy trì chat" là mặc định, và in
          ra một dòng phủ định cho mọi dịch vụ chỉ làm thẻ dài thêm.
        */}
        {service.maintainPostSessionChat ? (
          <Text className="text-caption text-accent" style={{ fontFamily: fonts.semibold }}>
            Giữ chat sau buổi học
          </Text>
        ) : null}
      </View>

      <View className="shrink-0 items-end">
        {gia.so ? (
          <>
            <Text
              testID={`gia-${service.serviceId}`}
              className="text-ink"
              style={{ fontFamily: fonts.extrabold, fontSize: 16 }}
            >
              {gia.so}
            </Text>
            <Text
              className="text-ink-muted"
              style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 }}
            >
              S-COINS
            </Text>
          </>
        ) : (
          <Text
            testID={`gia-${service.serviceId}`}
            className="text-caption text-success-ink"
            style={{ fontFamily: fonts.bold }}
          >
            {gia.nhan}
          </Text>
        )}
      </View>
    </View>
  );
}
