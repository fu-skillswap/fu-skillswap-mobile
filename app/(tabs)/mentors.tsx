import { Text, View } from 'react-native';

import { fonts } from '@/core/ui/theme';

/** Vỏ rỗng của tab Mentor — màn `Mentors` thuộc giai đoạn 4, chưa dựng lần này. */
export default function MentorsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-page">
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        Mentor
      </Text>
    </View>
  );
}
