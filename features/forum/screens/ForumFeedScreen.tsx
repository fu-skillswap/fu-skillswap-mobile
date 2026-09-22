/**
 * @file ForumFeedScreen.tsx
 * @description Màn hình diễn đàn: newsfeed theo ngành, lọc theo chủ đề, tìm kiếm.
 *
 * Bốn trạng thái được phân biệt rõ và không gộp: đang tải, lỗi khi chưa có gì
 * (ErrorView chiếm màn hình), lỗi khi ĐÃ có dữ liệu (banner, giữ nguyên danh
 * sách), và rỗng (EmptyState — gọi API thành công nhưng không có bài nào).
 */

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { PostCard } from '@/features/forum/components/PostCard';
import { TopicChips } from '@/features/forum/components/TopicChips';
import { useTogglePostLike } from '@/features/forum/hooks/useForumMutations';
import { useForumList, useForumTopics } from '@/features/forum/hooks/useForumQueries';

/**
 * Từ khoá phải đứng yên bấy nhiêu mili giây mới được đưa vào query key.
 * Thấp hơn thì gõ nhanh vẫn sinh request thừa; cao hơn thì người dùng thấy chậm.
 */
const DO_TRE_TIM_KIEM_MS = 350;

export function ForumFeedScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);

  // Ô nhập cập nhật tức thì để không giật chữ; chỉ giá trị đã lắng mới đi vào
  // query key — xem JSDoc của useDebouncedValue.
  const timKiem = useDebouncedValue(keyword.trim(), DO_TRE_TIM_KIEM_MS);

  const topics = useForumTopics();
  const list = useForumList({
    keyword: timKiem || undefined,
    forumTopicId: topicId ?? undefined,
  });

  const openPost = (postId: string) => router.push(`/forum/${postId}`);

  // Một hook cho cả danh sách: chốt chặn chống bấm trùng nằm trong hook, nên
  // mọi thẻ dùng chung nó mới chặn được.
  const { toggle: thaTim } = useTogglePostLike();

  /**
   * Chốt chặn ĐỒNG BỘ cho việc tải trang kế.
   *
   * FlatList bắn `onEndReached` nhiều lần liên tiếp trong cùng một frame. Nếu chỉ
   * dựa vào `isFetchingNextPage`, cả hai lần gọi đều đọc cùng một giá trị `false`
   * của lần render cũ — React chưa kịp render lại — và cùng một cursor được gửi
   * đi hai lần: trang đó bị nối vào danh sách hai lượt và người dùng thấy bài
   * trùng. Ref đổi ngay lập tức nên lần gọi thứ hai bị chặn.
   */
  const dangTaiTrangKe = useRef(false);
  const taiTrangKe = () => {
    if (dangTaiTrangKe.current || !list.hasNextPage || list.isFetchingNextPage) return;
    dangTaiTrangKe.current = true;
    void list.fetchNextPage().finally(() => {
      dangTaiTrangKe.current = false;
    });
  };

  // Quy cờ của TanStack thành MỘT trạng thái — luật và hai cái bẫy nằm ở JSDoc
  // của `core/api/queryState.ts`, đừng tự suy diễn lại ở đây.
  const trangThai = trangThaiTai({
    isPaused: list.isPaused,
    isPending: list.isPending,
    isError: list.isError,
    coDuLieu: list.posts.length > 0,
  });

  return (
    <Screen testID="man-hinh-dien-dan">
      <OfflineBanner />

      <View className="px-4 pt-2">
        <TextInput
          accessibilityLabel="Tìm kiếm bài viết"
          placeholder="Tìm bài viết"
          value={keyword}
          onChangeText={setKeyword}
          returnKeyType="search"
          className="h-control-lg rounded-md border border-border-color bg-surface px-3 text-text-main"
        />
      </View>

      <TopicChips
        topics={topics.data ?? []}
        selectedTopicId={topicId}
        onSelect={setTopicId}
      />

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-dien-dan" color={colors.primary} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState
          title="Không có kết nối"
          description="Bài viết sẽ tải khi có mạng trở lại."
        />
      ) : trangThai === 'loi' ? (
        <ErrorView error={list.error} onAction={() => void list.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-bai-viet"
          data={list.posts}
          keyExtractor={(post) => post.postId}
          renderItem={({ item }) => (
            <PostCard post={item} onPress={openPost} onToggleLike={thaTim} />
          )}
          // `grow` để EmptyState (flex-1) căn giữa được theo chiều dọc: nếu thiếu,
          // contentContainer co lại vừa nội dung và khối rỗng dính lên đầu.
          contentContainerClassName="grow"
          ListHeaderComponent={
            list.isError ? (
              <Pressable
                testID="loi-tai-lai-nen"
                accessibilityRole="button"
                onPress={() => void list.refetch()}
                className="mx-4 mt-2 rounded-md bg-danger-soft px-3 py-2"
              >
                <Text className="text-sm text-danger">
                  Không tải được bài mới. Chạm để thử lại.
                </Text>
              </Pressable>
            ) : null
          }
          onEndReachedThreshold={0.5}
          onEndReached={taiTrangKe}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator testID="dang-tai-trang-ke" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có bài viết nào"
              description="Hãy là người đầu tiên bắt đầu một cuộc thảo luận."
            />
          }
        />
      )}
    </Screen>
  );
}
