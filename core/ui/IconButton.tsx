/**
 * @file IconButton.tsx
 * @description Nút TRÒN chỉ có icon. Thiết kế dùng dáng này ở ba chỗ với ba sắc
 * khác nhau, nên gom vào một prop `variant` thay vì ba component:
 *
 * - `outline` 44 — nền trắng viền `line`, icon `ink`: nút tròn trên đầu trang
 *   (chuông thông báo ở `Main`, bánh răng ở `Profile`).
 * - `tint` 46 — nền `surface-tint`, icon `accent`: nút Gửi của thanh nhập bình
 *   luận ở `PostDetail`.
 * - `gradient` 56 — gradient 135° + bóng xanh: nút nổi "Tạo bài viết" ở `Main`.
 *
 * KHÔNG dùng `Button` cho mấy chỗ này: `Button` là viên thuốc có nhãn chữ, nó
 * luôn render một `Text`. Một nút chỉ có icon thì chữ duy nhất mô tả nó là
 * `accessibilityLabel`, nên label ở đây là **bắt buộc** — icon Lucide mang
 * `aria-hidden` nên nếu thiếu label thì trình đọc màn hình đọc ra một nút không
 * tên.
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, gradientButton, shadows, spacing } from '@/core/ui/theme';

export type IconButtonVariant = 'outline' | 'tint' | 'gradient';

export interface IconButtonProps {
  /**
   * Nhãn trợ năng, BẮT BUỘC: không có chữ nào khác mô tả nút này.
   * Ví dụ "Tạo bài viết", "Gửi bình luận".
   */
  label: string;
  /** Icon đã tạo sẵn kèm màu — chỗ gọi quyết định màu để khớp `variant` */
  icon: ReactNode;
  onPress: () => void;
  /** Đang xử lý: thay icon bằng spinner và chặn bấm */
  busy?: boolean;
  disabled?: boolean;
  variant?: IconButtonVariant;
  testID?: string;
}

/** Đường kính theo từng dáng, đúng số đo trong thiết kế */
const SIZE: Record<IconButtonVariant, number> = {
  outline: spacing.touch,
  tint: 46,
  gradient: 56,
};

const CONTAINER: Record<IconButtonVariant, string> = {
  outline: 'border border-line bg-surface',
  tint: 'bg-surface-tint',
  gradient: '',
};

const SPINNER: Record<IconButtonVariant, string> = {
  outline: colors.ink,
  tint: colors.accent,
  gradient: colors.onAccent,
};

export function IconButton({
  label,
  icon,
  onPress,
  busy = false,
  disabled = false,
  variant = 'outline',
  testID,
}: IconButtonProps) {
  const inactive = busy || disabled;
  const canh = SIZE[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      className={`items-center justify-center overflow-hidden rounded-full ${CONTAINER[variant]} ${
        inactive ? 'opacity-50' : ''
      }`}
      style={[
        { width: canh, height: canh },
        variant === 'gradient' && !inactive ? shadows.button : null,
      ]}
    >
      {variant === 'gradient' ? (
        <LinearGradient
          // `linear-gradient(135deg, …)`: chéo từ góc trên-trái xuống dưới-phải.
          colors={[gradientButton[0], gradientButton[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {busy ? (
        <ActivityIndicator color={SPINNER[variant]} />
      ) : (
        <View className="items-center justify-center">{icon}</View>
      )}
    </Pressable>
  );
}
