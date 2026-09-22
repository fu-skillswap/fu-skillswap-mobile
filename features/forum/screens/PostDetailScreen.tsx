/**
 * @file PostDetailScreen.tsx
 * @description Chi tiết bài viết kèm cây bình luận 1 cấp.
 *
 * Bài viết và bình luận là HAI query độc lập, nên mỗi bên tự quyết trạng thái
 * hiển thị của mình: bình luận hỏng không được phép xoá bài viết khỏi màn hình,
 * và bài viết tải xong không có nghĩa là bình luận đã có.
 */

import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { CommentItem } from '@/features/forum/components/CommentItem';
import { useForumComments, useForumPost } from '@/features/forum/hooks/useForumQueries';
import type { ForumCommentResponse } from '@/features/forum/types';

export function PostDetailScreen({ postId }: { postId: string }) {
  const post = useForumPost(postId);
  const comments = useForumComments(postId);
  const [, setReplyTo] = useState<ForumCommentResponse | null>(null);

  /**
   * Chốt chặn ĐỒNG BỘ cho việc tải trang bình luận kế — y hệt lý do đã ghi ở
   * ForumFeedScreen: FlatList bắn `onEndReached` nhiều lần trong cùng một frame,
   * cả hai lần cùng đọc `isFetchingNextPage === false` của lần render cũ nên
   * cùng một cursor bị gửi đi hai lượt và trang đó bị nối vào hai lần.
   */
  const dangTaiTrangKe = useRef(false);
  const taiTrangKe = () => {
    if (dangTaiTrangKe.current || !comments.hasNextPage || comments.isFetchingNextPage) return;
    dangTaiTrangKe.current = true;
    void comments.fetchNextPage().finally(() => {
      dangTaiTrangKe.current = false;
    });
  };

  const taiLai = () => {
    void post.refetch();
    void comments.refetch();
  };

  if (post.isLoading) {
    return (
      <Screen testID="man-hinh-chi-tiet-bai-viet">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bai-viet" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // Chỉ chiếm cả màn hình khi thật sự KHÔNG có gì để hiện. `isError` của TanStack
  // v5 bật cả khi query đã có data và chỉ lần refetch nền hỏng; dựa vào mình nó
  // thì một lần kéo-để-tải-lại hụt sóng sẽ xoá mất bài người dùng đang đọc.
  if (post.isError && post.data === undefined) {
    return (
      <Screen testID="man-hinh-chi-tiet-bai-viet">
        <ErrorView error={post.error} onAction={taiLai} />
      </Screen>
    );
  }

  return (
    <Screen testID="man-hinh-chi-tiet-bai-viet">
      <OfflineBanner />
      <FlatList
        testID="danh-sach-binh-luan"
        data={comments.comments}
        keyExtractor={(comment) => comment.commentId}
        // `grow` để EmptyState/ErrorView (flex-1) căn giữa được phần còn lại của
        // màn hình thay vì dính ngay dưới bài viết.
        contentContainerClassName="grow"
        ListHeaderComponent={
          <View>
            {post.isError ? (
              <Pressable
                testID="loi-tai-lai-nen"
                accessibilityRole="button"
                onPress={taiLai}
                className="mx-4 mt-2 rounded-md bg-danger-soft px-3 py-2"
              >
                <Text className="text-sm text-danger">
                  Không tải lại được bài viết. Chạm để thử lại.
                </Text>
              </Pressable>
            ) : null}

            <View className="gap-2 bg-surface px-4 py-4">
              <Text className="text-xs text-text-muted">{post.data?.forumTopic.nameVi}</Text>
              <Text className="text-lg font-bold text-text-main">{post.data?.title}</Text>
              <Text className="text-text-secondary">{post.data?.content}</Text>
              <Text className="pt-2 text-xs text-text-muted">
                {post.data?.commentCount} bình luận
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <CommentItem comment={item} onReply={setReplyTo} />
            {item.replies.map((reply) => (
              <CommentItem key={reply.commentId} comment={reply} isReply onReply={setReplyTo} />
            ))}
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={taiTrangKe}
        refreshing={post.isRefetching}
        onRefresh={taiLai}
        ListFooterComponent={
          comments.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator testID="dang-tai-binh-luan-ke" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          // Ba trạng thái khác nhau, không gộp: đang tải, lỗi, và rỗng thật.
          // Gộp lỗi vào rỗng sẽ nói dối người dùng là "bài này chưa ai bình luận".
          comments.isLoading ? null : comments.isError ? (
            <ErrorView error={comments.error} onAction={() => void comments.refetch()} />
          ) : (
            <EmptyState
              title="Chưa có bình luận"
              description="Hãy là người đầu tiên trả lời bài viết này."
            />
          )
        }
      />
    </Screen>
  );
}
