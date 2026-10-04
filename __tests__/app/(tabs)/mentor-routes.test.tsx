import { render, screen } from '@testing-library/react-native';
import React from 'react';

/**
 * @file mentor-routes.test.tsx
 * @description Canh năm file route của thanh tab Mentor.
 *
 * Những file này nhỏ nhưng hỏng thì IM LẶNG, và test của từng màn hình KHÔNG bắt
 * được: các test đó import `MentorDashboardScreen`/`MentorBookingsScreen`/
 * `MentorMoreScreen` trực tiếp, nên nếu route vẫn là vỏ rỗng chỉ in một chữ thì
 * toàn bộ test màn hình vẫn xanh trong khi tab trên máy thật vẫn trắng. Repo này
 * đã mất một vòng vì thiếu đúng loại test này (xem
 * `__tests__/app/(tabs)/bookings-route.test.tsx`).
 *
 * Hai barrel feature bị giả để test này KHÔNG cần TanStack Query, MSW, router hay
 * keystore: nó chỉ trả lời một câu hỏi — route có nối đúng màn hình hay không.
 */
jest.mock('@/features/mentorMode', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MentorDashboardScreen: () => <Text>MÀN TỔNG QUAN MENTOR</Text>,
    MentorMoreScreen: () => <Text>MÀN THÊM CỦA MENTOR</Text>,
    MentorScheduleScreen: () => <Text>MÀN LỊCH DẠY</Text>,
    MentorWalletScreen: () => <Text>MÀN VÍ MENTOR</Text>,
  };
});

jest.mock('@/features/booking', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MentorBookingsScreen: () => <Text>MÀN BOOKING CỦA MENTOR</Text>,
    MyBookingsScreen: () => <Text>MÀN LỊCH HẸN CỦA TÔI</Text>,
  };
});

import MentorBookingsRoute from '@/app/(tabs)/mentor-bookings';
import MentorDashboardRoute from '@/app/(tabs)/mentor-dashboard';
import MentorMoreRoute from '@/app/(tabs)/mentor-more';
import MentorScheduleRoute from '@/app/(tabs)/mentor-schedule';
import MentorWalletRoute from '@/app/(tabs)/mentor-wallet';

describe('route app/(tabs)/mentor-dashboard.tsx', () => {
  it('render màn Tổng quan, KHÔNG còn là vỏ rỗng', async () => {
    await render(<MentorDashboardRoute />);

    expect(screen.getByText('MÀN TỔNG QUAN MENTOR')).toBeTruthy();
    // Vế làm test ĐỎ nếu ai đó hoàn nguyên route về một vỏ rỗng in "Tổng quan".
    expect(screen.queryByText('Tổng quan')).toBeNull();
    expect(screen.queryByText('Đang hoàn thiện')).toBeNull();
  });

  it('route chỉ nối màn hình, KHÔNG nhận tham số nào', () => {
    expect(MentorDashboardRoute).toHaveLength(0);
  });
});

describe('route app/(tabs)/mentor-bookings.tsx', () => {
  it('render màn Booking của mentor, KHÔNG còn là vỏ rỗng', async () => {
    await render(<MentorBookingsRoute />);

    expect(screen.getByText('MÀN BOOKING CỦA MENTOR')).toBeTruthy();
    expect(screen.queryByText('Lịch đặt')).toBeNull();
    expect(screen.queryByText('Đang hoàn thiện')).toBeNull();
  });

  it('nối màn của MENTOR, không phải màn Lịch hẹn của mentee', async () => {
    // Hai màn nằm trong cùng một barrel (`features/booking`) và tên chỉ khác
    // nhau một chữ. Nối lẫn thì tab Booking của mentor sẽ hiện đúng các buổi
    // người đó đã ĐẶT với mentor khác — một danh sách hợp lệ và sai hoàn toàn.
    await render(<MentorBookingsRoute />);

    expect(screen.queryByText('MÀN LỊCH HẸN CỦA TÔI')).toBeNull();
  });

  it('route chỉ nối màn hình, KHÔNG nhận tham số nào', () => {
    expect(MentorBookingsRoute).toHaveLength(0);
  });
});

describe('route app/(tabs)/mentor-more.tsx', () => {
  it('render màn Thêm, KHÔNG còn là vỏ rỗng', async () => {
    await render(<MentorMoreRoute />);

    expect(screen.getByText('MÀN THÊM CỦA MENTOR')).toBeTruthy();
    expect(screen.queryByText('Thêm')).toBeNull();
    expect(screen.queryByText('Đang hoàn thiện')).toBeNull();
  });

  it('route chỉ nối màn hình, KHÔNG nhận tham số nào', () => {
    expect(MentorMoreRoute).toHaveLength(0);
  });
});

describe('route app/(tabs)/mentor-schedule.tsx và mentor-wallet.tsx', () => {
  it('Lịch dạy nối màn thật, KHÔNG còn vỏ "Đang hoàn thiện"', async () => {
    await render(<MentorScheduleRoute />);

    expect(screen.getByText('MÀN LỊCH DẠY')).toBeTruthy();
    expect(screen.queryByText('Đang hoàn thiện')).toBeNull();
  });

  it('Ví nối màn thật (chỉ xem số dư + giao dịch)', async () => {
    await render(<MentorWalletRoute />);

    expect(screen.getByText('MÀN VÍ MENTOR')).toBeTruthy();
    expect(screen.queryByText('Đang hoàn thiện')).toBeNull();
  });

  it('hai route KHÔNG nhận tham số nào', () => {
    expect(MentorScheduleRoute).toHaveLength(0);
    expect(MentorWalletRoute).toHaveLength(0);
  });
});
