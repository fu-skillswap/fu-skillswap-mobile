/**
 * @file Button.tsx
 * @description Nút dùng chung. Khi `busy` thì thay nhãn bằng spinner và chặn
 * bấm — để người dùng không gửi hai lần một thao tác mà backend tính vào hạn
 * mức (đăng bài 5 lần/10 phút, bình luận 20 lần/10 phút).
 */

import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '@/core/ui/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Đang xử lý: hiện spinner và không nhận thêm lần bấm nào */
  busy?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  testID?: string;
}

const CONTAINER_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-surface border border-border-color',
  danger: 'bg-danger',
};

const LABEL_BY_VARIANT: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-text-main',
  danger: 'text-white',
};

export function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
  variant = 'primary',
  testID,
}: ButtonProps) {
  const inactive = busy || disabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      className={`h-control-lg items-center justify-center rounded-md px-4 ${CONTAINER_BY_VARIANT[variant]} ${inactive ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? undefined : colors.surface} />
      ) : (
        <Text className={`font-semibold ${LABEL_BY_VARIANT[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
