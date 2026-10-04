import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/forum';

export default function PostDetailRoute() {
  // Kiểu tham số lấy từ chính route path, để typed-routes sinh ra nó thay vì
  // mình tự khai `{ postId: string }` — một lời khai như vậy không được kiểm gì
  // cả, và sẽ âm thầm sai nếu route đổi thành catch-all `[...postId]`.
  const { postId } = useLocalSearchParams<'/forum/[postId]'>();
  return <PostDetailScreen postId={postId} />;
}
