/**
 * @file CommentReplies.tsx
 * @description Luồng reply của MỘT bình luận gốc: nút "Xem N phản hồi" / "Ẩn
 * phản hồi" và, khi mở, danh sách reply tải từ
 * `GET /api/forum/comments/{commentId}/replies`.
 *
 * Backend không trả reply trong danh sách bình luận của bài — chỉ `replyCount`
 * trên từng gốc — nên đây là đường DUY NHẤT để người dùng đọc được reply.
 *
 * Danh sách reply là một component con chỉ được dựng khi đã mở: hook
 * `useCommentReplies` nằm trong đó, nên một bài có 20 bình luận gốc không bắn 20
 * request ngay lúc mở màn hình.
 */

import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { colors, fonts } from '@/core/ui/theme';
import { CommentItem } from '@/features/forum/components/CommentItem';
import { useCommentReplies } from '@/features/forum/hooks/useForumQueries';
import type { ForumCommentResponse } from '@/features/forum/types';

export interface CommentRepliesProps {
  postId: string;
  /** Bình luận GỐC sở hữu luồng reply này */
  root: ForumCommentResponse;
  /** Luồng đang mở hay đóng — màn hình giữ, để mở sẵn sau khi gửi reply */
  expanded: boolean;
  onToggle: (rootId: string) => void;
  onReply: (comment: ForumCommentResponse) => void;
  onToggleLike: (comment: ForumCommentResponse) => void;
  onReport: (comment: ForumCommentResponse) => void;
}

/** Dòng chữ bấm được, cùng cỡ với dòng hành động của `CommentItem` */
function NutChu({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      // Dòng chữ chỉ cao 16 — `hitSlop` kéo vùng chạm lên mức 44 bắt buộc.
      hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
      className="self-start py-1"
    >
      <Text className="text-caption text-accent" style={{ fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CommentReplies({
  postId,
  root,
  expanded,
  onToggle,
  onReply,
  onToggleLike,
  onReport,
}: CommentRepliesProps) {
  // Gốc chưa có reply và đang đóng thì không có gì để bấm — không dựng nút chết.
  if (!expanded && root.replyCount <= 0) {
    return null;
  }

  return (
    <View>
      <View className="pl-16">
        <NutChu
          testID={`nut-phan-hoi-${root.commentId}`}
          label={expanded ? 'Ẩn phản hồi' : `Xem ${root.replyCount} phản hồi`}
          onPress={() => onToggle(root.commentId)}
        />
      </View>
      {expanded ? (
        <DanhSachPhanHoi
          postId={postId}
          rootId={root.commentId}
          onReply={onReply}
          onToggleLike={onToggleLike}
          onReport={onReport}
        />
      ) : null}
    </View>
  );
}

function DanhSachPhanHoi({
  postId,
  rootId,
  onReply,
  onToggleLike,
  onReport,
}: {
  postId: string;
  rootId: string;
  onReply: (comment: ForumCommentResponse) => void;
  onToggleLike: (comment: ForumCommentResponse) => void;
  onReport: (comment: ForumCommentResponse) => void;
}) {
  const phanHoi = useCommentReplies(postId, rootId);

  const trangThai = trangThaiTai({
    isPaused: phanHoi.isPaused,
    isPending: phanHoi.isPending,
    isError: phanHoi.isError,
    coDuLieu: phanHoi.replies.length > 0,
  });

  if (trangThai === 'dang-tai') {
    return (
      <View className="items-start py-2 pl-16">
        <ActivityIndicator testID={`dang-tai-phan-hoi-${rootId}`} color={colors.accent} />
      </View>
    );
  }

  if (trangThai === 'mat-ket-noi') {
    return (
      <Text
        className="py-2 pl-16 text-caption text-ink-muted"
        style={{ fontFamily: fonts.medium }}
      >
        Phản hồi sẽ tải khi có mạng trở lại.
      </Text>
    );
  }

  if (trangThai === 'loi') {
    return (
      <View className="pl-16">
        <NutChu
          testID={`loi-tai-phan-hoi-${rootId}`}
          label="Không tải được phản hồi. Chạm để thử lại."
          onPress={() => void phanHoi.refetch()}
        />
      </View>
    );
  }

  return (
    <View testID={`danh-sach-phan-hoi-${rootId}`}>
      {phanHoi.replies.map((reply) => (
        <CommentItem
          key={reply.commentId}
          comment={reply}
          isReply
          // `onReply` nhận nguyên reply được bấm: việc quy về bình luận gốc là
          // của `resolveReplyTarget` lúc gửi, không phải của chỗ này.
          onReply={onReply}
          onToggleLike={onToggleLike}
          onReport={onReport}
        />
      ))}
      {phanHoi.isFetchingNextPage ? (
        <View className="items-start py-2 pl-16">
          <ActivityIndicator testID={`dang-tai-them-phan-hoi-${rootId}`} color={colors.accent} />
        </View>
      ) : phanHoi.hasNextPage ? (
        <View className="pl-16">
          <NutChu
            testID={`nut-them-phan-hoi-${rootId}`}
            label="Xem thêm phản hồi"
            onPress={phanHoi.taiTrangKe}
          />
        </View>
      ) : null}
    </View>
  );
}
