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

describe('vỏ rỗng của hai tab chưa dựng', () => {
  it('Lịch dạy nói thẳng là đang hoàn thiện', async () => {
    await render(<MentorScheduleRoute />);

    expect(screen.getByTestId('vo-rong-lich-day')).toBeTruthy();
    expect(screen.getByText('Lịch dạy')).toBeTruthy();
    expect(screen.getByText('Đang hoàn thiện')).toBeTruthy();
  });

  it('Lịch dạy KHÔNG có nút nào — không dựng nút chết', async () => {
    // TEST CANH. Màn thật cần `GET /api/mentor/availability-slots`, các template
    // khả dụng và luồng kết nối Google Calendar; không có cái nào thuộc đợt này.
    const { root } = await render(<MentorScheduleRoute />);

    expect(root).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('Ví nói thẳng là đang hoàn thiện và chỉ sang nơi xem được số dư', async () => {
    await render(<MentorWalletRoute />);

    expect(screen.getByTestId('vo-rong-vi-mentor')).toBeTruthy();
    expect(screen.getByText('Đang hoàn thiện')).toBeTruthy();
    expect(screen.getByText('Số dư khả dụng của bạn đang hiện ở tab Tổng quan.')).toBeTruthy();
  });

  it('Ví KHÔNG có nút nào — không nạp (bị cấm) và không rút (chưa được phép)', async () => {
    // TEST CANH, hai lý do khác nhau:
    // - Nạp tiền bị cấm thẳng ở mục 4.1 của quy ước (bản mobile là
    //   consumption-only, và chính lối nạp là thứ làm app bị gỡ khỏi Play).
    // - Rút tiền (payout) là luồng khác, KHÔNG nằm trong lệnh cấm đó, nhưng phải
    //   hỏi chủ sản phẩm trước — câu trả lời chưa có, nên màn này không tự quyết.
    await render(<MentorWalletRoute />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('Nạp')).toBeNull();
    expect(screen.queryByText('Thêm S-coins')).toBeNull();
    expect(screen.queryByText('Yêu cầu rút')).toBeNull();
    expect(screen.queryByText('Rút tiền')).toBeNull();
  });

  it('hai vỏ rỗng KHÔNG nhận tham số nào', () => {
    expect(MentorScheduleRoute).toHaveLength(0);
    expect(MentorWalletRoute).toHaveLength(0);
  });
});
