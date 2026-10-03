import { useLocalSearchParams } from 'expo-router';

import { MentorDetailScreen } from '@/features/mentor';

export default function MentorDetailRoute() {
  // Kiểu tham số lấy từ chính route path, để typed-routes sinh ra nó thay vì
  // mình tự khai `{ mentorUserId: string }` — một lời khai như vậy không được
  // kiểm gì cả, và sẽ âm thầm sai nếu route đổi thành catch-all.
  const { mentorUserId } = useLocalSearchParams<'/mentor/[mentorUserId]'>();
  return <MentorDetailScreen mentorUserId={mentorUserId} />;
}
