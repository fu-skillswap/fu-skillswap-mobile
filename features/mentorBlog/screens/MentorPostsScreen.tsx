/**
 * @file MentorPostsScreen.tsx
 * @description "Bài viết của tôi" của mentor, theo `MentorPosts.dc.html` và theo
 * bản web (`views/mentor/posts`): bản web dùng BLOG (`/api/me/blog/posts`), nên
 * màn này cũng vậy, không dùng diễn đàn.
 *
 * - Dòng phụ "X đã đăng · Y bản nháp" như web.
 * - Thẻ bài: nhãn trạng thái, phạm vi xem, tiêu đề, mô tả ngắn, ngày sửa.
 * - Như web, CHỈ bản nháp mở sửa được; bài đã đăng chỉ còn "Xoá khỏi danh sách"
 *   (lưu trữ). Bài đã lưu trữ không hiện.
 * - Nút "Tạo bài đăng" mở màn soạn (`/mentor-posts/new`). Thiết kế vẽ khung soạn
 *   là một tấm trượt; ở đây là một màn riêng vì nội dung bài dài và phải gõ trên
 *   bàn phím — một tấm trượt bị bàn phím che gần hết.
 *
 * Thiết kế có số "lượt thích / bình luận" dưới mỗi thẻ — DTO blog của mentor
 * không có hai số đó, nên không vẽ.
 */

import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { dinhDangNgay } from '@/core/time/localDateTime';
import { Button } from '@/core/ui/Button';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, radius, shadows, spacing } from '@/core/ui/theme';
import { nhanPhamVi } from '@/features/mentorBlog/baiViet';
import { useArchiveBlogPost, useMyBlogPosts } from '@/features/mentorBlog/hooks/useMentorBlog';
import type { MentorBlogPostDetailResponse } from '@/features/mentorBlog/types';

export function MentorPostsScreen() {
  const router = useRouter();
  const query = useMyBlogPosts();
  const luuTru = useArchiveBlogPost();
  const [dangXoa, setDangXoa] = useState<MentorBlogPostDetailResponse | null>(null);

  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: query.data !== undefined,
  });

  const roiMan = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mentor-more'));
  const taoMoi = () => router.push('/mentor-posts/new');

  const dongXoa = () => {
    if (!luuTru.isPending) {
      luuTru.reset();
      setDangXoa(null);
    }
  };

  return (
    <Screen testID="man-hinh-bai-viet-mentor">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader
          title="Bài viết của tôi"
          subtitle={query.data ? `${query.dem.daDang} đã đăng · ${query.dem.banNhap} bản nháp` : undefined}
          onBack={roiMan}
        />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bai-viet" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState title="Không có kết nối" description="Bài viết sẽ tải khi có mạng trở lại." />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-bai-viet"
          data={query.baiViet}
          keyExtractor={(b) => b.id}
          contentContainerClassName="grow gap-3.5 px-gutter pb-28"
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          renderItem={({ item }) => (
            <TheBaiViet
              bai={item}
              onSua={item.status === 'DRAFT' ? () => router.push(`/mentor-posts/${item.id}`) : undefined}
              onXoa={() => setDangXoa(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Bạn chưa có bài viết nào."
              description="Chia sẻ kinh nghiệm, kiến thức hoặc góc nhìn của bạn với mentee."
              actionLabel="Tạo bài viết đầu tiên"
              onAction={taoMoi}
            />
          }
        />
      )}

      {trangThai === 'co-noi-dung' && query.baiViet.length > 0 ? (
        <View className="absolute" style={{ right: spacing.gutter, bottom: 36 }}>
          <Button label="Tạo bài đăng" icon={<Plus size={20} color={colors.onAccent} strokeWidth={2.4} />} onPress={taoMoi} size="lg" testID="nut-tao-bai-viet" />
        </View>
      ) : null}

      {dangXoa ? (
        <Modal testID="hop-thoai-xoa-bai" visible transparent animationType="slide" onRequestClose={dongXoa}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="gap-3 rounded-t-lg bg-surface p-4 pb-8">
              <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
                Xóa bài viết khỏi danh sách?
              </Text>
              <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
                Bài viết sẽ được chuyển vào lưu trữ theo chính sách hiện tại của hệ thống.
              </Text>
              {luuTru.error ? (
                <Text testID="loi-xoa-bai" className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                  {toUserMessage(luuTru.error).description}
                </Text>
              ) : null}
              <Button
                label="Xóa khỏi danh sách"
                variant="danger"
                busy={luuTru.isPending}
                onPress={() => luuTru.mutate(dangXoa, { onSuccess: () => setDangXoa(null) })}
                testID="nut-xac-nhan-xoa-bai"
              />
              <Button label="Hủy" variant="secondary" onPress={dongXoa} testID="nut-huy-xoa-bai" />
            </View>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

function TheBaiViet({
  bai,
  onSua,
  onXoa,
}: {
  bai: MentorBlogPostDetailResponse;
  onSua?: () => void;
  onXoa: () => void;
}) {
  const daDang = bai.status === 'PUBLISHED';
  const ngay = dinhDangNgay(daDang ? (bai.publishedAt ?? bai.updatedAt) : bai.updatedAt);

  const noiDung = (
    <>
      <View className="flex-row items-center gap-2">
        <StatusBadge label={daDang ? 'Đã đăng' : 'Bản nháp'} tone={daDang ? 'success' : 'accent'} />
        <Text numberOfLines={1} className="min-w-0 flex-1 text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
          {nhanPhamVi(bai.visibility)}
          {ngay ? ` · ${ngay}` : ''}
        </Text>
      </View>
      <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
        {bai.title}
      </Text>
      {bai.excerpt ? (
        <Text numberOfLines={3} className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
          {bai.excerpt}
        </Text>
      ) : null}
    </>
  );

  return (
    <View
      testID={`bai-viet-${bai.id}`}
      className="gap-2.5 border border-line bg-surface"
      style={[{ borderRadius: radius.lg, padding: spacing.card }, shadows.card]}
    >
      {onSua ? (
        <Pressable accessibilityRole="button" accessibilityHint="Mở để chỉnh sửa bản nháp" onPress={onSua} className="gap-2.5" testID={`mo-bai-${bai.id}`}>
          {noiDung}
        </Pressable>
      ) : (
        <View className="gap-2.5">{noiDung}</View>
      )}
      <View className="flex-row justify-end gap-2 border-t border-line pt-2">
        {onSua ? (
          <Pressable accessibilityRole="button" onPress={onSua} className="justify-center px-2" style={{ minHeight: spacing.touch }} testID={`sua-bai-${bai.id}`}>
            <Text className="text-caption-lg text-accent" style={{ fontFamily: fonts.semibold }}>
              Chỉnh sửa
            </Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onXoa} className="justify-center px-2" style={{ minHeight: spacing.touch }} testID={`xoa-bai-${bai.id}`}>
          <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.semibold }}>
            Xóa khỏi danh sách
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
