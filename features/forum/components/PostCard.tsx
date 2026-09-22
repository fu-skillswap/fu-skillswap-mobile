/**
 * @file PostCard.tsx
 * @description Thẻ bài viết trong danh sách. Ảnh dùng thẳng URL backend trả về,
 * không tự ghép prefix CDN.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, Text, View } from 'react-native';

import { colors } from '@/core/ui/theme';
import type { ForumPostResponse } from '@/features/forum/types';

export interface PostCardProps {
  post: ForumPostResponse;
  onPress: (postId: string) => void;
  onToggleLike?: (post: ForumPostResponse) => void;
}

export function PostCard({ post, onPress, onToggleLike }: PostCardProps) {
  const icon = (
    <Ionicons
      name={post.reactedByCurrentUser ? 'heart' : 'heart-outline'}
      size={18}
      color={post.reactedByCurrentUser ? colors.danger : colors.textMuted}
    />
  );
  const soLuotThich = <Text className="text-sm text-text-muted">{post.reactionCount}</Text>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(post.postId)}
      className="gap-2 border-b border-border-light bg-surface px-4 py-3"
    >
      <View className="flex-row items-center gap-2">
        <Text className="font-semibold text-text-main">{post.authorFullName}</Text>
        <Text className="text-xs text-text-muted">{post.forumTopic.nameVi}</Text>
      </View>

      <Text className="text-base font-bold text-text-main">{post.title}</Text>
      <Text numberOfLines={3} className="text-text-secondary">
        {post.content}
      </Text>

      {post.imageUrls.length > 0 ? (
        <Image
          source={{ uri: post.imageUrls[0] }}
          className="h-40 w-full rounded-md"
          resizeMode="cover"
        />
      ) : null}

      <View className="flex-row items-center gap-4 pt-1">
        {/*
          Không có `onToggleLike` thì đây KHÔNG phải nút: một Pressable `disabled`
          vẫn giữ role "button", nên trình đọc màn hình đọc "nút Thích" trong khi
          cú chạm rơi xuống Pressable cha và mở bài viết. Render View thường.
        */}
        {onToggleLike ? (
          <Pressable
            testID="so-luot-thich"
            accessibilityRole="button"
            accessibilityLabel={post.reactedByCurrentUser ? 'Bỏ thích' : 'Thích'}
            onPress={() => onToggleLike(post)}
            className="flex-row items-center gap-1"
          >
            {icon}
            {soLuotThich}
          </Pressable>
        ) : (
          <View testID="so-luot-thich" className="flex-row items-center gap-1">
            {icon}
            {soLuotThich}
          </View>
        )}

        <View testID="so-binh-luan" className="flex-row items-center gap-1">
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text className="text-sm text-text-muted">{post.commentCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}
