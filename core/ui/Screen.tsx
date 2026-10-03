/**
 * @file Screen.tsx
 * @description Khung ngoài cùng của một màn hình: nền `surface-page` và safe area.
 *
 * `gutter` bật lề hai bên 20px của thiết kế. Mặc định TẮT vì màn hình có
 * `FlatList` phải tự đặt lề qua `contentContainerStyle` — lề ở khung ngoài sẽ
 * cắt luôn vùng cuộn và thanh cuộn.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({
  children,
  gutter = false,
  testID,
}: {
  children: ReactNode;
  /** Lề hai bên 20px theo thiết kế */
  gutter?: boolean;
  testID?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-surface-page" testID={testID}>
      <View className={`flex-1 ${gutter ? 'px-gutter' : ''}`}>{children}</View>
    </SafeAreaView>
  );
}
