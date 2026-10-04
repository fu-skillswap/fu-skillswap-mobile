/**
 * @file OfflineBanner.tsx
 * @description Banner "Không có kết nối" ở đầu màn hình (spec §6). Dữ liệu đã
 * tải vẫn xem được nhờ cache của TanStack Query, nên đây là thông báo chứ
 * không phải màn hình chặn.
 */

import { Text, View } from 'react-native';

import { useIsOffline } from '@/core/net/onlineStatus';
import { fonts } from '@/core/ui/theme';

export function OfflineBanner() {
  if (!useIsOffline()) {
    return null;
  }

  return (
    <View className="bg-warning-soft px-4 py-2">
      <Text
        className="text-center text-caption-lg text-warning-ink"
        style={{ fontFamily: fonts.semibold }}
      >
        Không có kết nối
      </Text>
    </View>
  );
}
