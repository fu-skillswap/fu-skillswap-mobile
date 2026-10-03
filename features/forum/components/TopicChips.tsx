/**
 * @file TopicChips.tsx
 * @description Hàng chip chọn chủ đề. `null` nghĩa là không lọc theo chủ đề —
 * màn hình chỉ quay về newsfeed cá nhân hoá khi KHÔNG còn bộ lọc nào khác; nếu
 * ô tìm kiếm vẫn có chữ thì danh sách vẫn đi qua endpoint tra cứu.
 *
 * Chip lấy từ `core/ui/Chip` dáng `filter` (cao 40, chọn thì nền `accent` chữ
 * trắng). Trước đây file này có một bản `Chip` RIÊNG dựng tay — đúng thứ mà
 * `core/ui/` đã có, chỉ khác vài px và thiếu `hitSlop` bù vùng chạm 44.
 */

import { ScrollView } from 'react-native';

import { Chip } from '@/core/ui/Chip';
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
      contentContainerClassName="gap-2 px-gutter py-2"
    >
      {choPhepBoChon ? (
        <Chip
          label="Tất cả"
          variant="filter"
          selected={selectedTopicId === null}
          onPress={() => onSelect(null)}
        />
      ) : null}
      {topics.map((topic) => (
        <Chip
          key={topic.id}
          label={topic.nameVi}
          variant="filter"
          selected={selectedTopicId === topic.id}
          onPress={() => onSelect(topic.id)}
        />
      ))}
    </ScrollView>
  );
}
