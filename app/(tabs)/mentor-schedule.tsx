import { useLocalSearchParams } from 'expo-router';

import { MentorScheduleScreen } from '@/features/mentorMode';

export default function MentorScheduleRoute() {
  const { phan } = useLocalSearchParams<{ phan?: string }>();
  return <MentorScheduleScreen phanYeuCau={typeof phan === 'string' ? phan : undefined} />;
}
