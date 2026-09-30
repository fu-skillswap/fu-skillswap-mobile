/**
 * @file OfflineBanner.tsx
 * @description Banner "Không có kết nối" ở đầu màn hình (spec §6). Dữ liệu đã
 * tải vẫn xem được nhờ cache của TanStack Query, nên đây là thông báo chứ
 * không phải màn hình chặn.
 */

import { Text, View } from 'react-native';

import { useIsOffline } from '@/core/net/onlineStatus';

export function OfflineBanner() {
  if (!useIsOffline()) {
    return null;
  }

  return (
    <View className="bg-warning-soft px-4 py-2">
      <Text className="text-center text-sm text-text-main">Không có kết nối</Text>
    </View>
  );
}
