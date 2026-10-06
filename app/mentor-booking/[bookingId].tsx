import { useLocalSearchParams } from 'expo-router';

import { MentorBookingDetailScreen } from '@/features/booking';
import { useGoogleCalendarStatus } from '@/features/mentorMode';

/**
 * Chi tiết lịch đặt phía mentor.
 *
 * `daNoiLich` đọc từ trạng thái Google Calendar SỐNG (`connected &&
 * !needsReconnect`, giống tab Lịch dạy), không từ `user.googleCalendarConnected`
 * của phiên — giá trị đó chỉ làm mới lúc đăng nhập, trong khi backend kiểm kết
 * nối sống lúc chấp nhận (`BookingDecisionService.acceptBooking`). Kết nối đã hết
 * hạn mà màn tưởng còn thì mentor để trống link và nhận 400.
 */
export default function MentorBookingDetailRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const lichGoogle = useGoogleCalendarStatus();
  const daNoiLich = lichGoogle.data?.connected === true && lichGoogle.data.needsReconnect !== true;
  return (
    <MentorBookingDetailScreen
      bookingId={typeof bookingId === 'string' ? bookingId : ''}
      daNoiLich={daNoiLich}
    />
  );
}
