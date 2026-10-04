/**
 * @file Button.tsx
 * @description Nút dùng chung. Thiết kế có ba dáng nút — gradient (chính),
 * nền `surface-tint` (phụ), viền 1px trên nền trắng (nhẹ) — nên repo giữ MỘT
 * component với prop `variant` chứ không tách `PrimaryButton`/`SecondaryButton`:
 * cả ba chỉ khác màu nền và màu chữ, mọi hành vi (`busy`, `disabled`, vùng chạm,
 * `accessibilityState`) là một.
 *
 * Khi `busy` thì thay nhãn bằng spinner và chặn bấm — để người dùng không gửi
 * hai lần một thao tác mà backend tính vào hạn mức (đăng bài 5 lần/10 phút,
 * bình luận 20 lần/10 phút).
 *
 * Quy ước style của `core/ui`: màu và layout viết bằng class NativeWind, còn
 * `fontFamily` và bóng đổ đi qua `style` lấy từ `core/ui/theme.ts` — vì nét chữ
 * phải là tên file font thật (xem ghi chú ở `fonts`) và bóng đổ là prop RN chứ
 * không phải chuỗi CSS.
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, controlHeight, fonts, gradientButton, shadows } from '@/core/ui/theme';

/**
 * - `primary` — gradient 135° + bóng xanh, nút hành động chính của màn hình
 * - `secondary` — nền `surface-tint`, chữ `accent` (mục 5 của HANDOFF.md)
 * - `ghost` — nền trắng viền `line`, chữ `ink-body`: nút phụ cạnh nút chính
 *   trong card (ví dụ "Hủy lịch" ở `MyBookings`)
 * - `danger` — chữ đỏ cho hành động phá huỷ; thiết kế chỉ khai màu CHỮ cho lỗi
 *   nên đây là nền `surface` viền `line`, không phải khối đỏ
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** `sm` 44 (nút trong card) · `md` 52 (nút trên form) · `lg` 56 (nút ở `BottomBar`) */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Đang xử lý: hiện spinner và không nhận thêm lần bấm nào */
  busy?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon đặt trước nhãn, 20px theo thiết kế */
  icon?: ReactNode;
  testID?: string;
}

const HEIGHT_BY_SIZE: Record<ButtonSize, number> = {
  sm: controlHeight.md,
  md: controlHeight.lg,
  lg: 56,
};

/** Cỡ chữ theo thiết kế: nút 44 và 52 dùng 14–15, nút 56 dùng 16 */
const LABEL_CLASS_BY_SIZE: Record<ButtonSize, string> = {
  sm: 'text-body',
  md: 'text-body-lg',
  lg: 'text-base',
};

const CONTAINER_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'bg-surface-tint',
  ghost: 'border border-line bg-surface',
  danger: 'border border-line bg-surface',
};

const LABEL_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: 'text-on-accent',
  secondary: 'text-accent',
  ghost: 'text-ink-body',
  danger: 'text-danger',
};

const SPINNER_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: colors.onAccent,
  secondary: colors.accent,
  ghost: colors.inkBody,
  danger: colors.danger,
};

export function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  icon,
  testID,
}: ButtonProps) {
  const inactive = busy || disabled;
  const noiDung = busy ? (
    <ActivityIndicator color={SPINNER_BY_VARIANT[variant]} />
  ) : (
    <View className="flex-row items-center justify-center gap-2">
      {icon}
      <Text
        className={`${LABEL_CLASS_BY_SIZE[size]} ${LABEL_BY_VARIANT[variant]}`}
        style={{ fontFamily: fonts.bold }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      className={`items-center justify-center overflow-hidden rounded-full px-5 ${CONTAINER_BY_VARIANT[variant]} ${inactive ? 'opacity-50' : ''}`}
      style={[
        { height: HEIGHT_BY_SIZE[size] },
        variant === 'primary' && !inactive ? shadows.button : null,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          // `linear-gradient(135deg, …)` của thiết kế: chéo từ góc trên-trái
          // xuống góc dưới-phải.
          colors={[gradientButton[0], gradientButton[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {noiDung}
    </Pressable>
  );
}
