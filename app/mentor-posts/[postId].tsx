import { useLocalSearchParams } from 'expo-router';

import { MentorPostEditScreen } from '@/features/mentorBlog';

/** `/mentor-posts/new` là soạn bài mới; mọi id khác là sửa bản nháp đó */
export default function MentorPostEditRoute() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const id = typeof postId === 'string' ? postId : '';
  return <MentorPostEditScreen postId={id === 'new' ? null : id} />;
}
