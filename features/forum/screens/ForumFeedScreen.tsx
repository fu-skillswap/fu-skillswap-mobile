/**
 * @file ForumFeedScreen.tsx
 * @description Tab "Bảng tin": lời chào, ô tìm kiếm, chip chủ đề, danh sách bài.
 *
 * Bốn trạng thái được phân biệt rõ và không gộp: đang tải, lỗi khi chưa có gì
 * (ErrorView chiếm màn hình), lỗi khi ĐÃ có dữ liệu (banner, giữ nguyên danh
 * sách), và rỗng (EmptyState — gọi API thành công nhưng không có bài nào).
 *
 * `Main.dc.html` vẽ màn này thành một dashboard: lời chào + ô tìm mentor + card
 * Koko + carousel "Mentor nổi bật" + danh sách bài. Lần này CHỈ dựng phần có dữ
 * liệu thật — lời chào (tên từ `useAuth()`) và danh sách bài theo đúng kiểu thẻ
 * của thiết kế. Ba khối còn lại bị bỏ qua có chủ ý, lý do ghi ngay tại chỗ.
 */

import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { useDebouncedValue } from '@/core/hooks/useDebouncedValue';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { IconButton } from '@/core/ui/IconButton';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors, controlHeight, fonts, spacing } from '@/core/ui/theme';
import { PostCard } from '@/features/forum/components/PostCard';
import { TopicChips } from '@/features/forum/components/TopicChips';
import { useTogglePostLike } from '@/features/forum/hooks/useForumMutations';
import { useForumList, useForumTopics } from '@/features/forum/hooks/useForumQueries';

/**
 * Từ khoá phải đứng yên bấy nhiêu mili giây mới được đưa vào query key.
 * Thấp hơn thì gõ nhanh vẫn sinh request thừa; cao hơn thì người dùng thấy chậm.
 *
 * Export ra để test nhường đúng khoảng này cho debounce (`nhuongChoDebounce`)
 * thay vì chép lại con số — chép lại thì sửa ở đây là test âm thầm sai nhịp.
 * KHÔNG re-export qua barrel `@/features/forum`: barrel là API công khai cho
 * feature khác, còn đây chỉ là chi tiết test cần biết.
 */
export const DO_TRE_TIM_KIEM_MS = 350;

/**
 * Lời chào theo giờ trong ngày, đúng ba mốc mà `Main.dc.html` ngụ ý
 * ("Chào buổi tối," trong bản chụp).
 *
 * Dùng giờ của THIẾT BỊ là đúng ở đây: đây là lời chào cho người đang cầm máy,
 * không phải một mốc thời gian của backend — nên cái bẫy `LocalDateTime` không
 * có offset ở mục 5 của `docs/quy-uoc-dung-giao-dien.md` không áp vào chỗ này.
 */
export function loiChao(gio: number): string {
  if (gio < 12) return 'Chào buổi sáng,';
  if (gio < 18) return 'Chào buổi chiều,';
  return 'Chào buổi tối,';
}

export function ForumFeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
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

      <View className="gap-4 px-gutter pb-3 pt-2">
        {/*
          Lời chào chỉ hiện khi đã biết người dùng là ai. Thiết kế còn có logo 40
          bên trái và chuông thông báo bên phải; logo bỏ vì repo mobile chưa có
          file ảnh nào của bộ nhận diện SkillSwap, còn chuông bỏ vì màn
          `Notifications` chưa dựng — xem mục (c) của báo cáo.
        */}
        {user ? (
          <View>
            <Text
              className="text-caption-lg text-ink-muted"
              style={{ fontFamily: fonts.regular }}
            >
              {loiChao(new Date().getHours())}
            </Text>
            <Text
              className="text-ink"
              style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 }}
            >
              {user.fullName}
            </Text>
          </View>
        ) : null}

        {/*
          Ô tìm kiếm GIỮ LẠI vì nó đang hoạt động thật (tìm bài viết qua
          `/api/forum/posts`). Thiết kế vẽ chỗ này là một nút dẫn sang màn tìm
          mentor với chữ "Tìm mentor, kỹ năng, môn học…" — đổi sang chữ đó sẽ nói
          dối về việc ô này làm gì, nên chỉ lấy DÁNG: cao 52, bo tròn, nền trắng
          viền `line`, icon kính lúp màu `accent`.
        */}
        <View
          className="flex-row items-center gap-2.5 rounded-full border border-line bg-surface px-4"
          style={{ height: controlHeight.lg }}
        >
          <Search size={20} color={colors.accent} strokeWidth={2} />
          <TextInput
            accessibilityLabel="Tìm kiếm bài viết"
            placeholder="Tìm bài viết"
            placeholderTextColor={colors.inkMuted}
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            className="min-w-0 flex-1 text-ink"
            style={{ fontFamily: fonts.medium, fontSize: 14 }}
          />
        </View>
      </View>

      <TopicChips
        topics={topics.data ?? []}
        selectedTopicId={topicId}
        onSelect={setTopicId}
      />

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-dien-dan" color={colors.accent} />
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
          // Lề hai bên 20 và gap 14 giữa các thẻ đặt ở contentContainer chứ không
          // ở `Screen`: lề ở khung ngoài sẽ cắt luôn vùng cuộn.
          contentContainerClassName="grow gap-3.5 px-gutter pb-28 pt-5"
          ListHeaderComponent={
            <View className="gap-3">
              {list.isError ? (
                <Pressable
                  testID="loi-tai-lai-nen"
                  accessibilityRole="button"
                  onPress={() => void list.refetch()}
                  className="rounded-md bg-neutral-soft px-3 py-2"
                >
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không tải được bài mới. Chạm để thử lại.
                  </Text>
                </Pressable>
              ) : null}

              {/* Tiêu đề section 18/700, đúng `<h2>` của thiết kế. */}
              {list.posts.length > 0 ? (
                <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
                  Bảng tin cộng đồng
                </Text>
              ) : null}
            </View>
          }
          onEndReachedThreshold={0.5}
          onEndReached={taiTrangKe}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator testID="dang-tai-trang-ke" color={colors.accent} />
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

      {/*
        Nút nổi 56 bo tròn, gradient, nằm cách mép phải 20 — đúng thiết kế (thiết
        kế đặt `bottom: 104` vì thanh tab 84 nằm trong cùng một khối; ở đây thanh
        tab là của react-navigation nên chỉ cần lề so với đáy vùng an toàn).

        Nút nằm NGOÀI nhánh điều kiện ở trên, không nằm trong `FlatList`: lúc feed
        rỗng, lỗi hay mất mạng mới là lúc người dùng cần chỗ để bắt đầu một bài
        viết, mà đó đúng là những lúc danh sách không được render.
      */}
      <View className="absolute bottom-6" style={{ right: spacing.gutter }}>
        <IconButton
          label="Tạo bài viết"
          variant="gradient"
          icon={<Plus size={24} color={colors.onAccent} strokeWidth={2.4} />}
          onPress={() => router.push('/forum/compose')}
          testID="nut-mo-soan-bai"
        />
      </View>
    </Screen>
  );
}
