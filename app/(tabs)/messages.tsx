import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/** Vỏ rỗng của tab Tin nhắn — màn `Messages` thuộc giai đoạn sau, chưa dựng lần này. */
export default function MessagesScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page">
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        Tin nhắn
      </Text>
    </View>
  );
}
