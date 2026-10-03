/**
 * @file PostCard.tsx
 * @description Thẻ bài viết trong danh sách, theo mẫu `<article>` của
 * `Main.dc.html`: card bo 24 nền trắng, viền `line`, bóng `shadows.card`,
 * padding 16, gap 12 — hàng tác giả, nội dung, nhãn chủ đề, rồi thanh hành động
 * có viền trên.
 *
 * Ảnh dùng thẳng URL backend trả về, không tự ghép prefix CDN.
 *
 * Thiết kế KHÔNG vẽ tiêu đề bài viết (bài mẫu chỉ có đoạn nội dung), nhưng
 * `ForumPostResponse.title` là trường BẮT BUỘC của backend và là thứ người dùng
 * gõ vào ở màn soạn bài — bỏ nó đi là xoá một tính năng đang chạy. Nên tiêu đề
 * vẫn ở đây, 15/700 ngay trên nội dung.
 */

import { Heart, MessageCircle } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/core/ui/Avatar';
import { Chip } from '@/core/ui/Chip';
import { colors, fonts, shadows, spacing } from '@/core/ui/theme';
import type { ForumPostResponse } from '@/features/forum/types';

export interface PostCardProps {
  post: ForumPostResponse;
  onPress: (postId: string) => void;
  onToggleLike?: (post: ForumPostResponse) => void;
}

export function PostCard({ post, onPress, onToggleLike }: PostCardProps) {
  const daThich = post.reactedByCurrentUser;
  const icon = (
    <Heart
      size={20}
      color={daThich ? colors.accent : colors.inkMuted}
      // Thiết kế tô ĐẶC trái tim khi đã thích, chỉ còn nét khi chưa.
      fill={daThich ? colors.accent : 'transparent'}
      strokeWidth={2}
    />
  );
  const soLuotThich = (
    <Text
      className={`text-caption-lg ${daThich ? 'text-accent' : 'text-ink-muted'}`}
      style={{ fontFamily: fonts.semibold }}
    >
      {post.reactionCount}
    </Text>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(post.postId)}
      className="gap-3 rounded-lg border border-line bg-surface"
      style={[{ padding: spacing.card }, shadows.card]}
    >
      <View className="flex-row items-center gap-2.5">
        <Avatar name={post.authorFullName} size={40} />
        {/*
          Thiết kế có thêm dòng mốc thời gian tương đối ("3 giờ trước") dưới tên
          tác giả. Dòng đó CHƯA dựng: mọi trường thời gian của BE là
          `LocalDateTime` không có offset, nên `new Date(post.createdAt)` đọc
          thành giờ của máy và chỉ đúng ngẫu nhiên ở UTC+7 — xem mục 5 của
          `docs/quy-uoc-dung-giao-dien.md`. Làm đúng cần một hàm đọc mốc thời
          gian kèm test riêng, không phải việc của đợt sửa UI này. Xem mục (c)
          của báo cáo.
        */}
        <View className="min-w-0 flex-1">
          <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
            {post.authorFullName}
          </Text>
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
          {post.title}
        </Text>
        <Text
          numberOfLines={3}
          className="text-ink-body"
          style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 }}
        >
          {post.content}
        </Text>
      </View>

      {post.imageUrls.length > 0 ? (
        <Image
          source={{ uri: post.imageUrls[0] }}
          className="h-40 w-full rounded-md"
          resizeMode="cover"
        />
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Chip label={post.forumTopic.nameVi} variant="tag" />
      </View>

      {/* Thanh hành động: viền trên 1px `line`, các ô cao 44 theo thiết kế. */}
      <View className="-mb-1 flex-row items-center gap-1 border-t border-line pt-1">
        {/*
          Không có `onToggleLike` thì đây KHÔNG phải nút: một Pressable `disabled`
          vẫn giữ role "button", nên trình đọc màn hình đọc "nút Thích" trong khi
          cú chạm rơi xuống Pressable cha và mở bài viết. Render View thường.
        */}
        {onToggleLike ? (
          <Pressable
            testID="so-luot-thich"
            accessibilityRole="button"
            accessibilityLabel={daThich ? 'Bỏ thích' : 'Thích'}
            onPress={() => onToggleLike(post)}
            className="h-control-md flex-row items-center gap-1.5 px-2.5"
          >
            {icon}
            {soLuotThich}
          </Pressable>
        ) : (
          <View
            testID="so-luot-thich"
            className="h-control-md flex-row items-center gap-1.5 px-2.5"
          >
            {icon}
            {soLuotThich}
          </View>
        )}

        <View testID="so-binh-luan" className="h-control-md flex-row items-center gap-1.5 px-2.5">
          <MessageCircle size={20} color={colors.inkMuted} strokeWidth={2} />
          <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.semibold }}>
            {post.commentCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
