import { render, screen } from '@testing-library/react-native';
import React from 'react';

/**
 * @file route.test.tsx
 * @description Route `app/mentor-booking/[bookingId].tsx` phải lấy cờ "đã nối
 * Google Calendar" từ trạng thái SỐNG (`GET /api/me/google-calendar/status`),
 * không từ `user.googleCalendarConnected` của phiên — backend kiểm kết nối sống
 * lúc chấp nhận (`BookingDecisionService.acceptBooking`).
 */
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ bookingId: 'mb2' }) }));

let mockTrangThaiLich: { connected: boolean; needsReconnect: boolean } | undefined;
jest.mock('@/features/mentorMode', () => ({
  useGoogleCalendarStatus: () => ({ data: mockTrangThaiLich }),
}));
jest.mock('@/features/booking', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MentorBookingDetailScreen: ({ bookingId, daNoiLich }: { bookingId: string; daNoiLich: boolean }) => (
      <Text>{`CHI TIẾT ${bookingId} · lịch=${String(daNoiLich)}`}</Text>
    ),
  };
});
// Phiên (đã cũ) vẫn nói "đã nối" — route KHÔNG được tin nó.
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { googleCalendarConnected: true } }),
}));

import MentorBookingDetailRoute from '@/app/mentor-booking/[bookingId]';

describe('route app/mentor-booking/[bookingId].tsx', () => {
  it('kết nối cần nối lại thì coi như CHƯA nối, dù phiên nói đã nối', async () => {
    mockTrangThaiLich = { connected: true, needsReconnect: true };
    await render(<MentorBookingDetailRoute />);
    expect(screen.getByText('CHI TIẾT mb2 · lịch=false')).toBeTruthy();
  });

  it('chưa tải xong trạng thái thì chưa coi là đã nối', async () => {
    mockTrangThaiLich = undefined;
    await render(<MentorBookingDetailRoute />);
    expect(screen.getByText('CHI TIẾT mb2 · lịch=false')).toBeTruthy();
  });

  it('kết nối còn dùng được thì đã nối', async () => {
    mockTrangThaiLich = { connected: true, needsReconnect: false };
    await render(<MentorBookingDetailRoute />);
    expect(screen.getByText('CHI TIẾT mb2 · lịch=true')).toBeTruthy();
  });
});
