/**
 * @file TextField.tsx
 * @description Ô nhập của thiết kế: nhãn 13/600, khoảng cách 6, ô cao 48
 * (radius 12, viền 1px `line`, chữ 15/500 màu `ink`). Khi focus thiết kế đổi
 * sang viền 2px `accent` (xem `Onboarding`, ô "Mã số sinh viên").
 *
 * `multiline` dùng cho textarea trong `Onboarding` / `MentorServiceDetail`:
 * padding 12×14, chữ 14/21, không cho kéo giãn.
 */

import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, controlHeight, fonts, radius } from '@/core/ui/theme';

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Chú thích mờ trong nhãn, ví dụ "(không bắt buộc)" */
  hint?: string;
  /**
   * Thông báo lỗi. Có lỗi thì viền và chữ phụ chuyển màu `danger`, và ô mang
   * `accessibilityInvalid` để trình đọc màn hình báo trường sai.
   */
  error?: string;
  multiline?: boolean;
  /** Số dòng của textarea; thiết kế dùng `rows="3"` */
  numberOfLines?: number;
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline = false,
  numberOfLines = 3,
  editable = true,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  testID,
}: TextFieldProps) {
  const [dangFocus, setDangFocus] = useState(false);

  // Thứ tự ưu tiên của viền: lỗi > đang focus > bình thường. Lỗi phải thắng
  // focus, nếu không thì ô vừa bị báo sai lại trông như ô đang hợp lệ.
  const vien = error
    ? 'border-2 border-danger'
    : dangFocus
      ? 'border-2 border-accent'
      : 'border border-line';

  return (
    <View className="gap-1.5">
      <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
        {label}
        {hint ? (
          <Text className="text-ink-muted" style={{ fontFamily: fonts.regular }}>
            {' '}
            {hint}
          </Text>
        ) : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        // Nhãn đã ở ngay trên ô nhưng RN không nối nhãn với ô như `<label for>`
        // của web, nên phải khai `accessibilityLabel` tay.
        aria-invalid={error ? true : undefined}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setDangFocus(true)}
        onBlur={() => setDangFocus(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        testID={testID}
        className={`bg-surface text-ink ${vien} ${editable ? '' : 'opacity-60'}`}
        style={[
          {
            borderRadius: radius.input,
            fontFamily: fonts.medium,
            color: colors.ink,
          },
          multiline
            ? // `textAlignVertical` để chữ bắt đầu từ mép trên trên Android;
              // mặc định Android canh giữa dọc trong ô nhiều dòng.
              {
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                lineHeight: 21,
                minHeight: 21 * numberOfLines + 24,
                textAlignVertical: 'top' as const,
              }
            : { height: controlHeight.input, paddingHorizontal: 14, fontSize: 15 },
        ]}
      />
      {error ? (
        <Text className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
