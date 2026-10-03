/**
 * @file CommentItem.tsx
 * @description Một bình luận (gốc hoặc reply), theo mẫu của `PostDetail.dc.html`:
 * avatar 36 bên trái, rồi một "bong bóng" bo `6px 18px 18px 18px` chứa tên và
 * nội dung, và dưới bong bóng là dòng hành động 12px màu `ink-muted`.
 *
 * Bình luận do bot "SkillSwap AI" viết được gắn badge "AI" và bong bóng nền nhạt
 * để người đọc biết đây không phải người thật (spec §5.5). Thiết kế dùng đúng vị
 * trí badge đó cho nhãn "Mentor"; ở đây là badge AI vì đó là dữ liệu repo thật
 * có.
 */

import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/core/ui/Avatar';
import { fonts } from '@/core/ui/theme';
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

/**
 * Bo góc bong bóng: góc trên-trái gần như vuông để nó "chỉ" về phía avatar,
 * ba góc còn lại bo 18 — đúng `border-radius: 6px 18px 18px 18px` của thiết kế.
 */
const BO_GOC_BONG = {
  borderTopLeftRadius: 6,
  borderTopRightRadius: 18,
  borderBottomRightRadius: 18,
  borderBottomLeftRadius: 18,
} as const;

export function CommentItem({
  comment,
  testID,
  isReply = false,
  onReply,
  onToggleLike,
  onReport,
}: CommentItemProps) {
  const cuaBot = isBotComment(comment);

  return (
    <View
      testID={testID}
      className={`flex-row gap-2.5 px-4 py-2 ${isReply ? 'pl-12' : ''}`}
    >
      <Avatar name={comment.authorFullName} size={40} />

      <View className="min-w-0 flex-1 gap-1">
        <View
          // Bong bóng là chỗ DUY NHẤT đổi nền giữa bot và người thật; khung ngoài
          // để trong suốt trên nền `surface-page` của màn hình, đúng thiết kế.
          testID={testID ? `${testID}-bong` : undefined}
          className={`self-start border border-line px-3.5 py-2.5 ${
            cuaBot ? 'bg-surface-tint' : 'bg-surface'
          }`}
          style={BO_GOC_BONG}
        >
          <View className="flex-row items-center gap-1.5">
            <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.bold }}>
              {comment.authorFullName}
            </Text>
            {cuaBot ? (
              <View className="rounded-full bg-accent px-1.5 py-0.5">
                <Text
                  className="text-on-accent"
                  style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 13 }}
                >
                  AI
                </Text>
              </View>
            ) : null}
          </View>

          {isReply && comment.replyToUserName ? (
            <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
              Trả lời {comment.replyToUserName}
            </Text>
          ) : null}

          <Text
            className="text-ink-body"
            style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}
          >
            {comment.content}
          </Text>
        </View>

        {/* Dòng hành động dưới bong bóng, thụt vào 8 như thiết kế. */}
        <View className="flex-row items-center gap-3 pl-2">
          {/*
            Không có `onToggleLike` thì đây KHÔNG phải nút — cùng lý do đã ghi ở
            PostCard: `Pressable disabled` vẫn giữ role "button" nên trình đọc màn
            hình đọc ra một cái nút không bấm được.
          */}
          {onToggleLike ? (
            <Pressable
              testID={`so-thich-binh-luan-${comment.commentId}`}
              accessibilityRole="button"
              accessibilityLabel={
                comment.reactedByCurrentUser ? 'Bỏ thích bình luận' : 'Thích bình luận'
              }
              onPress={() => onToggleLike(comment)}
              // Dòng chữ chỉ cao 16 — `hitSlop` kéo vùng chạm lên mức 44 bắt buộc.
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              className="flex-row items-center gap-1"
            >
              <Text
                className={`text-caption ${
                  comment.reactedByCurrentUser ? 'text-accent' : 'text-ink-muted'
                }`}
                style={{ fontFamily: fonts.semibold }}
              >
                Thích
              </Text>
              <Text
                className={`text-caption ${
                  comment.reactedByCurrentUser ? 'text-accent' : 'text-ink-muted'
                }`}
                style={{ fontFamily: fonts.semibold }}
              >
                {comment.reactionCount}
              </Text>
            </Pressable>
          ) : (
            <View
              testID={`so-thich-binh-luan-${comment.commentId}`}
              className="flex-row items-center gap-1"
            >
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
                Thích
              </Text>
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
                {comment.reactionCount}
              </Text>
            </View>
          )}

          {onReply ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onReply(comment)}
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
            >
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.semibold }}>
                Trả lời
              </Text>
            </Pressable>
          ) : null}

          {onReport ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onReport(comment)}
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
            >
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.semibold }}>
                Báo cáo
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
