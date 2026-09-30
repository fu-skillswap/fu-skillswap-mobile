/**
 * @file EmptyState.tsx
 * @description Trạng thái rỗng dùng chung — phân biệt rõ với trạng thái lỗi:
 * rỗng nghĩa là gọi API thành công nhưng không có dữ liệu.
 */

import { Text, View } from 'react-native';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8">
      <Text className="text-center text-base font-semibold text-text-main">{title}</Text>
      {description ? (
        <Text className="text-center text-text-muted">{description}</Text>
      ) : null}
    </View>
  );
}
