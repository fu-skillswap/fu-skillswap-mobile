/**
 * @file NutGui.tsx
 * @description Nút gửi tròn 48 nền gradient của khung soạn tin — dùng chung cho
 * phòng chat với mentor và màn Chat với Koko (cùng một nút trong
 * `ChatDetail.dc.html` và `KokoChat.dc.html`).
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Send } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, gradientButton, shadows } from '@/core/ui/theme';

export interface NutGuiProps {
  disabled: boolean;
  /** Đang gửi: hiện vòng quay và chặn bấm lần hai */
  busy: boolean;
  onPress: () => void;
  testID?: string;
}

export function NutGui({ disabled, busy, onPress, testID = 'nut-gui-tin' }: NutGuiProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gửi"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      testID={testID}
      className="items-center justify-center overflow-hidden rounded-full"
      style={[{ width: 48, height: 48, opacity: disabled ? 0.5 : 1 }, disabled ? null : shadows.button]}
    >
      <LinearGradient
        colors={[gradientButton[0], gradientButton[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Bọc trong View: trên web, phần tử có `position` mới nổi lên trên lớp gradient tuyệt đối. */}
      <View>
        {busy ? <ActivityIndicator color={colors.onAccent} /> : <Send size={20} color={colors.onAccent} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}
