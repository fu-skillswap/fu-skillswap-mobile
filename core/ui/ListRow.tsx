/**
 * @file ListRow.tsx
 * @description Hàng menu cao 56 trong `Profile` / `MentorMore`: icon 20 màu
 * accent, nhãn 14/600 màu `ink`, giá trị phụ 13/500 màu `ink-muted` hoặc mũi
 * nhọn 18 màu `ink-muted` ở cuối.
 *
 * Divider là `border-top` của hàng THỨ HAI trở đi trong thiết kế, nên hàng tự
 * nhận `divider` chứ không để `Card` vẽ hộ: nhóm hàng có thể nằm trong nhiều
 * khung khác nhau, và chỉ hàng mới biết nó có phải hàng đầu không.
 *
 * Dùng chung với `Card flush` — card bỏ padding, mỗi hàng tự có padding 16.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/core/ui/theme';

export interface ListRowProps {
  label: string;
  /** Icon đầu hàng, 20px theo thiết kế */
  icon?: ReactNode;
  /** Chữ phụ sát lề phải (ví dụ "Tiếng Việt") */
  value?: string;
  /** Mũi nhọn ">" cuối hàng; chỉ có ý nghĩa với hàng điều hướng */
  chevron?: boolean;
  /** Viền trên 1px — bật cho mọi hàng TRỪ hàng đầu của nhóm */
  divider?: boolean;
  /** Hàng phá huỷ (Đăng xuất…): nhãn màu `danger` */
  destructive?: boolean;
  onPress?: () => void;
  /**
   * Việc của hàng đang chạy (ví dụ đang đăng xuất): hiện vòng quay ở cuối hàng
   * và KHOÁ hàng, để một cú chạm nữa không gửi thêm một request.
   */
  busy?: boolean;
  testID?: string;
}

export function ListRow({
  label,
  icon,
  value,
  chevron = false,
  divider = false,
  destructive = false,
  onPress,
  busy = false,
  testID,
}: ListRowProps) {
  const noiDung = (
    <>
      {icon}
      <Text
        className={`flex-1 text-body ${destructive ? 'text-danger' : 'text-ink'}`}
        style={{ fontFamily: fonts.semibold }}
      >
        {label}
      </Text>
      {value ? (
        <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.medium }}>
          {value}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator
          testID={testID ? `${testID}-dang-chay` : undefined}
          color={destructive ? colors.danger : colors.accent}
        />
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      ) : null}
    </>
  );

  const lop = `flex-row items-center gap-3 px-4 ${divider ? 'border-t border-line' : ''}`;
  // Thiết kế dùng `min-height: 56px`: hàng cao 56 nhưng giãn ra được nếu nhãn
  // phải xuống dòng, nên là `minHeight` chứ không phải `height`.
  const kichCo = { minHeight: 56, paddingVertical: 8 };

  if (!onPress) {
    return (
      <View className={lop} style={kichCo} testID={testID}>
        {noiDung}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      testID={testID}
      className={lop}
      // 56 > 44 nên vùng chạm đã đủ; `spacing.touch` ở đây là mức sàn phòng khi
      // ai đó đổi chiều cao hàng mà quên kiểm lại.
      style={[kichCo, { minHeight: Math.max(56, spacing.touch) }]}
    >
      {noiDung}
    </Pressable>
  );
}
