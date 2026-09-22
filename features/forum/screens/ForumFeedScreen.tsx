/**
 * @file ForumFeedScreen.tsx
 * @description Màn hình diễn đàn: newsfeed theo ngành, lọc theo chủ đề, tìm kiếm.
 *
 * Ba trạng thái được phân biệt rõ và không gộp: đang tải, lỗi (ErrorView), và
 * rỗng (EmptyState — gọi API thành công nhưng không có bài nào).
 */

import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';

import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors } from '@/core/ui/theme';
import { PostCard } from '@/features/forum/components/PostCard';
import { TopicChips } from '@/features/forum/components/TopicChips';
import { useForumList, useForumTopics } from '@/features/forum/hooks/useForumQueries';

export function ForumFeedScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);

  const topics = useForumTopics();
  const list = useForumList({
    keyword: keyword.trim() || undefined,
    forumTopicId: topicId ?? undefined,
  });

  const openPost = (postId: string) => router.push(`/forum/${postId}` as Href);

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

      {list.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-dien-dan" color={colors.primary} />
        </View>
      ) : list.isError ? (
        <ErrorView error={list.error} onAction={() => void list.refetch()} />
      ) : (
        <FlatList
          data={list.posts}
          keyExtractor={(post) => post.postId}
          renderItem={({ item }) => <PostCard post={item} onPress={openPost} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) {
              void list.fetchNextPage();
            }
          }}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
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
