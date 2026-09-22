import { useLocalSearchParams } from 'expo-router';

import { PostDetailScreen } from '@/features/forum';

export default function PostDetailRoute() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <PostDetailScreen postId={postId} />;
}
