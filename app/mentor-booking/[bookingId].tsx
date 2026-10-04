import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/core/auth/AuthProvider';
import { MentorBookingDetailScreen } from '@/features/booking';

export default function MentorBookingDetailRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user } = useAuth();
  return (
    <MentorBookingDetailScreen
      bookingId={typeof bookingId === 'string' ? bookingId : ''}
      daNoiLich={user?.googleCalendarConnected === true}
    />
  );
}
