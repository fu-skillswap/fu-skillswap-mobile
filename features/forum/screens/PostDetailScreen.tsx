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

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { Button } from '@/core/ui/Button';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { CommentItem } from '@/features/forum/components/CommentItem';
import { useDeletePost, useToggleCommentLike } from '@/features/forum/hooks/useForumMutations';
import { useForumComments, useForumPost } from '@/features/forum/hooks/useForumQueries';

export function PostDetailScreen({ postId }: { postId: string }) {
  const router = useRouter();
  /**
   * Rời màn hình cho an toàn.
   *
   * Vào thẳng `/forum/{id}` bằng deep link hay thông báo đẩy thì stack rỗng, và
   * `back()` là no-op: xoá bài xong người dùng ngồi nhìn chính bài vừa xoá, hộp
   * xác nhận đã đóng, không hiểu chuyện gì vừa xảy ra.
   */
  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };
  const { user } = useAuth();
  const post = useForumPost(postId);
  const comments = useForumComments(postId);
  const { toggle: thaTimBinhLuan } = useToggleCommentLike(postId);
  const xoaBai = useDeletePost();

  /**
   * Hộp xác nhận xoá là một `Modal` TỰ VẼ, không phải `Alert.alert`.
   *
   * `Alert` là hộp thoại chặn của hệ điều hành: nó không nằm trong cây React nên
   * không kiểm được bằng test, và trong môi trường tự động hoá nó chặn luôn
   * luồng đang chạy. Modal tự vẽ đổi lại được cả hai điều đó, và Task 11 sẽ
   * dùng lại đúng khuôn này cho `ReportSheet`.
   */
  const [dangHoiXoa, setDangHoiXoa] = useState(false);

  // Backend chỉ cho CHÍNH tác giả sửa/xoá (forum.md §3.6–3.7). So sánh ở đây là
  // để giao diện không bày ra nút chắc chắn nhận 403, không phải để thay cho
  // việc kiểm tra của backend.
  const laTacGia = Boolean(user && post.data && user.publicId === post.data.authorUserId);

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

              {laTacGia ? (
                <View className="flex-row gap-2 pt-2">
                  <Button
                    label="Sửa bài"
                    variant="secondary"
                    onPress={() => router.push({ pathname: '/forum/compose', params: { postId } })}
                    testID="nut-sua-bai"
                  />
                  <Button
                    label="Xoá bài"
                    variant="danger"
                    onPress={() => setDangHoiXoa(true)}
                    testID="nut-xoa-bai"
                  />
                </View>
              ) : null}
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
            <CommentItem
              comment={item}
              isReply={Boolean(item.replyToCommentId)}
              onToggleLike={thaTimBinhLuan}
            />
            {item.replies.map((reply) => (
              <CommentItem
                key={reply.commentId}
                comment={reply}
                isReply
                onToggleLike={thaTimBinhLuan}
              />
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

      <Modal
        testID="hop-thoai-xoa"
        visible={dangHoiXoa}
        transparent
        animationType="fade"
        // Nút back cứng của Android cũng phải đóng được hộp này, nếu không
        // người dùng bị kẹt trong một câu hỏi không có đường thoát.
        onRequestClose={() => setDangHoiXoa(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View testID="hop-xac-nhan-xoa" className="w-full gap-3 rounded-lg bg-surface p-4">
            <Text className="text-base font-semibold text-text-main">Xoá bài viết này?</Text>
            <Text className="text-text-secondary">
              Bài viết và toàn bộ bình luận sẽ biến mất. Thao tác này không hoàn tác được.
            </Text>

            {xoaBai.isError ? (
              // Xoá hỏng mà không nói gì là kiểu tệ nhất: hộp vẫn mở, nút hết
              // quay, và người dùng không biết bài đã xoá được hay chưa — họ sẽ
              // bấm lại. Thông điệp lấy nguyên văn của backend (403 khi không
              // phải tác giả, 404 khi bài đã bị xoá sẵn).
              <View testID="loi-xoa-bai" className="gap-1 rounded-md bg-danger-soft p-3">
                <Text className="font-semibold text-danger">
                  {toUserMessage(xoaBai.error).title}
                </Text>
                <Text className="text-danger">{toUserMessage(xoaBai.error).description}</Text>
              </View>
            ) : null}
            <View className="flex-row justify-end gap-2">
              <Button
                label="Không xoá"
                variant="secondary"
                onPress={() => setDangHoiXoa(false)}
                testID="nut-huy-xoa"
              />
              <Button
                label="Xoá hẳn"
                variant="danger"
                busy={xoaBai.isPending}
                onPress={() =>
                  xoaBai.mutate(postId, {
                    onSuccess: () => {
                      setDangHoiXoa(false);
                      roiDi();
                    },
                  })
                }
                testID="nut-xac-nhan-xoa"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
