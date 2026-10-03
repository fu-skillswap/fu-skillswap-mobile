import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/** Vỏ rỗng của tab Lịch hẹn — màn `MyBookings` thuộc giai đoạn sau, chưa dựng lần này. */
export default function BookingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page">
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        Lịch hẹn
      </Text>
    </View>
  );
}
