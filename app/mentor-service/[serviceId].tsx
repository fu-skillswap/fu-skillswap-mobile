import { useLocalSearchParams } from 'expo-router';

import { MentorServiceEditScreen } from '@/features/mentorMode';

/** `/mentor-service/new` là tạo mới; mọi id khác là sửa dịch vụ đó */
export default function MentorServiceRoute() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const id = typeof serviceId === 'string' ? serviceId : '';
  return <MentorServiceEditScreen serviceId={id === 'new' ? null : id} />;
}
