/**
 * @file PostDetailScreen.tsx
 * @description Chi tiết bài viết kèm cây bình luận 1 cấp.
 *
 * Bài viết và bình luận là HAI query độc lập, nên mỗi bên tự quyết trạng thái
 * hiển thị của mình: bình luận hỏng không được phép xoá bài viết khỏi màn hình,
 * và bài viết tải xong không có nghĩa là bình luận đã có.
 *
 * Việc quy cờ của TanStack thành một trạng thái hiển thị nằm ở
 * `core/api/queryState.ts` — đọc JSDoc ở đó trước khi sửa mấy nhánh dưới đây.
 */

import { useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { CommentItem } from '@/features/forum/components/CommentItem';
import { useForumComments, useForumPost } from '@/features/forum/hooks/useForumQueries';

export function PostDetailScreen({ postId }: { postId: string }) {
  const post = useForumPost(postId);
  const comments = useForumComments(postId);

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

  const trangThaiBai = trangThaiTai({
    isPaused: post.isPaused,
    isPending: post.isPending,
    isError: post.isError,
    coDuLieu: post.data !== undefined,
  });

  if (trangThaiBai === 'dang-tai') {
    return (
      <Screen testID="man-hinh-chi-tiet-bai-viet">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bai-viet" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (trangThaiBai === 'mat-ket-noi') {
    return (
      <Screen testID="man-hinh-chi-tiet-bai-viet">
        <OfflineBanner />
        <EmptyState
          title="Không có kết nối"
          description="Bài viết sẽ tải khi có mạng trở lại."
        />
      </Screen>
    );
  }

  if (trangThaiBai === 'loi') {
    return (
      <Screen testID="man-hinh-chi-tiet-bai-viet">
        <ErrorView error={post.error} onAction={taiLai} />
      </Screen>
    );
  }

  const trangThaiBinhLuan = trangThaiTai({
    isPaused: comments.isPaused,
    isPending: comments.isPending,
    isError: comments.isError,
    coDuLieu: comments.comments.length > 0,
  });

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
            {/*
              `buildCommentTree` nâng reply mồ côi — reply mà bình luận gốc của nó
              nằm ở trang trước — lên làm gốc để nó không biến mất. Nhưng nó vẫn
              LÀ một reply, nên phải giữ dòng "Trả lời ai"; bỏ đi thì người đọc
              thấy một câu cụt lủn không hiểu đang nói với ai.
            */}
            <CommentItem comment={item} isReply={Boolean(item.replyToCommentId)} />
            {item.replies.map((reply) => (
              <CommentItem key={reply.commentId} comment={reply} isReply />
            ))}
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={taiTrangKe}
        // Cả hai query cùng tải lại, nên spinner chỉ được tắt khi cả hai xong.
        refreshing={post.isRefetching || comments.isRefetching}
        onRefresh={taiLai}
        ListFooterComponent={
          comments.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator testID="dang-tai-binh-luan-ke" color={colors.primary} />
            </View>
          ) : comments.isError && comments.comments.length > 0 ? (
            // Trang bình luận KẾ hỏng: danh sách đã có nội dung nên ListEmptyComponent
            // không render, và không có chỗ nào khác báo cho người dùng biết.
            <Pressable
              testID="loi-tai-them-binh-luan"
              accessibilityRole="button"
              onPress={() => void comments.fetchNextPage()}
              className="mx-4 my-3 rounded-md bg-danger-soft px-3 py-2"
            >
              <Text className="text-sm text-danger">
                Không tải được thêm bình luận. Chạm để thử lại.
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          // Bốn trạng thái khác nhau, không gộp. Gộp bất kỳ cái nào vào "rỗng"
          // đều thành nói dối người dùng là "bài này chưa ai bình luận".
          trangThaiBinhLuan === 'dang-tai' ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator testID="dang-tai-binh-luan" color={colors.primary} />
            </View>
          ) : trangThaiBinhLuan === 'mat-ket-noi' ? (
            <EmptyState
              title="Không có kết nối"
              description="Bình luận sẽ tải khi có mạng trở lại."
            />
          ) : trangThaiBinhLuan === 'loi' ? (
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
