/**
 * @file CommentItem.tsx
 * @description Một bình luận (gốc hoặc reply). Bình luận do bot "SkillSwap AI"
 * viết được gắn badge "AI" và nền nhạt để người đọc biết đây không phải người
 * thật (spec §5.5).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/core/ui/theme';
import { isBotComment } from '@/features/forum/commentTree';
import type { ForumCommentResponse } from '@/features/forum/types';

export interface CommentItemProps {
  comment: ForumCommentResponse;
  /** Chỉ dùng trong test, để kiểm được lớp thụt lề và nền của bot */
  testID?: string;
  /** Reply thì thụt vào và hiện tên người được trả lời */
  isReply?: boolean;
  onReply?: (comment: ForumCommentResponse) => void;
  onToggleLike?: (comment: ForumCommentResponse) => void;
  onReport?: (comment: ForumCommentResponse) => void;
}

export function CommentItem({
  comment,
  testID,
  isReply = false,
  onReply,
  onToggleLike,
  onReport,
}: CommentItemProps) {
  const cuaBot = isBotComment(comment);

  const icon = (
    <Ionicons
      name={comment.reactedByCurrentUser ? 'heart' : 'heart-outline'}
      size={16}
      color={comment.reactedByCurrentUser ? colors.danger : colors.textMuted}
    />
  );
  const soLuotThich = <Text className="text-xs text-text-muted">{comment.reactionCount}</Text>;

  return (
    <View
      testID={testID}
      className={`gap-1 px-4 py-3 ${isReply ? 'pl-12' : ''} ${cuaBot ? 'bg-primary-light' : 'bg-surface'}`}
    >
      <View className="flex-row items-center gap-2">
        <Text className="font-semibold text-text-main">{comment.authorFullName}</Text>
        {cuaBot ? (
          <View className="rounded-full bg-primary px-2 py-0.5">
            <Text className="text-xs font-semibold text-white">AI</Text>
          </View>
        ) : null}
      </View>

      {isReply && comment.replyToUserName ? (
        <Text className="text-xs text-text-muted">Trả lời {comment.replyToUserName}</Text>
      ) : null}

      <Text className="text-text-secondary">{comment.content}</Text>

      <View className="flex-row items-center gap-4 pt-1">
        {/*
          Không có `onToggleLike` thì đây KHÔNG phải nút — cùng lý do đã ghi ở
          PostCard: `Pressable disabled` vẫn giữ role "button" nên trình đọc màn
          hình đọc ra một cái nút không bấm được. Task 9 truyền hàm vào thì nó
          mới thành nút thật.
        */}
        {onToggleLike ? (
          <Pressable
            testID={`so-thich-binh-luan-${comment.commentId}`}
            accessibilityRole="button"
            accessibilityLabel={comment.reactedByCurrentUser ? 'Bỏ thích bình luận' : 'Thích bình luận'}
            onPress={() => onToggleLike(comment)}
            className="flex-row items-center gap-1"
          >
            {icon}
            {soLuotThich}
          </Pressable>
        ) : (
          <View testID={`so-thich-binh-luan-${comment.commentId}`} className="flex-row items-center gap-1">
            {icon}
            {soLuotThich}
          </View>
        )}

        {onReply ? (
          <Pressable accessibilityRole="button" onPress={() => onReply(comment)}>
            <Text className="text-xs text-text-muted">Trả lời</Text>
          </Pressable>
        ) : null}

        {onReport ? (
          <Pressable accessibilityRole="button" onPress={() => onReport(comment)}>
            <Text className="text-xs text-text-muted">Báo cáo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
