/**
 * @file TopicChips.tsx
 * @description Hàng chip chọn chủ đề. `null` nghĩa là không lọc — khi đó màn
 * hình quay về newsfeed cá nhân hoá thay vì gọi endpoint tra cứu.
 */

import { Pressable, ScrollView, Text } from 'react-native';

import type { ForumTopicResponse } from '@/features/forum/types';

export interface TopicChipsProps {
  topics: ForumTopicResponse[];
  selectedTopicId: string | null;
  onSelect: (topicId: string | null) => void;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`h-control-md items-center justify-center rounded-full px-4 ${
        active ? 'bg-primary' : 'bg-surface border border-border-color'
      }`}
    >
      <Text className={active ? 'text-sm font-semibold text-white' : 'text-sm text-text-secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TopicChips({ topics, selectedTopicId, onSelect }: TopicChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 py-2"
    >
      <Chip label="Tất cả" active={selectedTopicId === null} onPress={() => onSelect(null)} />
      {topics.map((topic) => (
        <Chip
          key={topic.id}
          label={topic.nameVi}
          active={selectedTopicId === topic.id}
          onPress={() => onSelect(topic.id)}
        />
      ))}
    </ScrollView>
  );
}
