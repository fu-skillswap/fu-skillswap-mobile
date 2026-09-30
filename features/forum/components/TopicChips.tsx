/**
 * @file TopicChips.tsx
 * @description Hàng chip chọn chủ đề. `null` nghĩa là không lọc theo chủ đề —
 * màn hình chỉ quay về newsfeed cá nhân hoá khi KHÔNG còn bộ lọc nào khác; nếu
 * ô tìm kiếm vẫn có chữ thì danh sách vẫn đi qua endpoint tra cứu.
 */

import { Pressable, ScrollView, Text } from 'react-native';

import type { ForumTopicResponse } from '@/features/forum/types';

export interface TopicChipsProps {
  topics: ForumTopicResponse[];
  selectedTopicId: string | null;
  onSelect: (topicId: string | null) => void;
  /**
   * Có vẽ chip "Tất cả" (nghĩa là bỏ lọc) hay không.
   *
   * Màn danh sách cần nó. Màn SOẠN BÀI thì không: ở đó "Tất cả" đọc thành "bỏ
   * chủ đề", và bấm vào sẽ khoá nút Đăng bài mà không một dòng nào giải thích —
   * một khái niệm của màn đọc rò sang màn ghi.
   */
  choPhepBoChon?: boolean;
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
      // Trạng thái chọn phải nằm trong cây trợ năng, không chỉ trong màu nền:
      // trình đọc màn hình không thấy được `className`.
      accessibilityState={{ selected: active }}
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

export function TopicChips({
  topics,
  selectedTopicId,
  onSelect,
  choPhepBoChon = true,
}: TopicChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 py-2"
    >
      {choPhepBoChon ? (
        <Chip label="Tất cả" active={selectedTopicId === null} onPress={() => onSelect(null)} />
      ) : null}
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
