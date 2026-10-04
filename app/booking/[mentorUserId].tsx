import { useLocalSearchParams } from 'expo-router';

import { BookingSlotScreen } from '@/features/booking';

/**
 * Bước 2/3 của đặt lịch. `serviceId` là tham số query TUỲ CHỌN — hồ sơ mentor
 * truyền dịch vụ người dùng vừa bấm; thiếu thì màn tự chọn dịch vụ đầu tiên.
 */
export default function BookingSlotRoute() {
  const { mentorUserId, serviceId } = useLocalSearchParams<{
    mentorUserId: string;
    serviceId?: string;
  }>();
  return (
    <BookingSlotScreen
      mentorUserId={typeof mentorUserId === 'string' ? mentorUserId : ''}
      serviceId={typeof serviceId === 'string' && serviceId.length > 0 ? serviceId : undefined}
    />
  );
}
