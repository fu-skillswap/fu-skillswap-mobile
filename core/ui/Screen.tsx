/**
 * @file Screen.tsx
 * @description Khung ngoài cùng của một màn hình: nền theo token và safe area.
 */

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" testID={testID}>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
