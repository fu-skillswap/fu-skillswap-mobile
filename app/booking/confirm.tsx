import { useLocalSearchParams } from 'expo-router';

import { BookingConfirmScreen } from '@/features/booking';

/** Lấy một tham số dạng chuỗi; mảng (tham số lặp) hoặc thiếu thì về chuỗi rỗng */
function mot(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Bước 3/3 của đặt lịch. Bốn tham số do bước 2 chuyền sang qua query;
 * `startAt` là NGUYÊN `candidate.startAt` của backend, không dựng lại ở đây.
 */
export default function BookingConfirmRoute() {
  const params = useLocalSearchParams<{
    mentorUserId: string;
    slotId: string;
    serviceId: string;
    startAt: string;
  }>();
  return (
    <BookingConfirmScreen
      mentorUserId={mot(params.mentorUserId)}
      slotId={mot(params.slotId)}
      serviceId={mot(params.serviceId)}
      startAt={mot(params.startAt)}
    />
  );
}
