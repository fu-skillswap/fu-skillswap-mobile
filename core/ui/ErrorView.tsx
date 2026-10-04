/**
 * @file ErrorView.tsx
 * @description Hiển thị lỗi theo đúng quyết định của `toUserMessage`, kể cả
 * phần `action` mà trước giai đoạn 2 chưa màn hình nào dùng tới.
 *
 * Thuần trình bày: không điều hướng, không tự gọi lại API. Người gọi truyền
 * `onAction` và tự quyết định hành động — `core/ui` không được biết tới router.
 */

import { Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import type { UserMessageAction } from '@/core/api/errors';
import { Button } from '@/core/ui/Button';
import { fonts } from '@/core/ui/theme';

/** Nhãn nút suy ra từ hành động mà `toUserMessage` đề xuất */
const ACTION_LABEL: Record<UserMessageAction, string | null> = {
  RETRY: 'Thử lại',
  RELOAD: 'Tải lại',
  LOGIN: 'Đăng nhập lại',
  NONE: null,
};

export function ErrorView({ error, onAction }: { error: unknown; onAction?: () => void }) {
  const message = toUserMessage(error);
  const label = ACTION_LABEL[message.action];

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-center text-base text-ink" style={{ fontFamily: fonts.bold }}>
        {message.title}
      </Text>
      <Text
        className="text-center text-caption-lg text-ink-muted"
        style={{ fontFamily: fonts.regular }}
      >
        {message.description}
      </Text>
      {message.retryAfterSeconds ? (
        <Text
          className="text-center text-caption-lg text-ink-muted"
          style={{ fontFamily: fonts.regular }}
        >
          Vui lòng thử lại sau {message.retryAfterSeconds} giây.
        </Text>
      ) : null}
      {label && onAction ? (
        <View className="pt-2">
          <Button label={label} onPress={onAction} variant="secondary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}
