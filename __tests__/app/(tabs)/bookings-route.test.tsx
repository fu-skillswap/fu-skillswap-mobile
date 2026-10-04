import { render, screen } from '@testing-library/react-native';
import React from 'react';

/**
 * @file bookings-route.test.tsx
 * @description Canh file route `app/(tabs)/bookings.tsx`.
 *
 * File này nhỏ nhưng hỏng thì IM LẶNG, và `bookings.test.tsx` không bắt được: test
 * đó import `MyBookingsScreen` trực tiếp, nên nếu route vẫn là vỏ rỗng chỉ in chữ
 * "Lịch hẹn" thì toàn bộ test màn hình vẫn xanh trong khi tab 3 trên máy thật vẫn
 * trắng. Đợt trước đã mất một vòng vì thiếu đúng loại test này (xem
 * `__tests__/app/mentor/mentor-routes.test.tsx`).
 *
 * `@/features/booking` bị giả để test này KHÔNG cần TanStack Query, MSW hay
 * router: nó chỉ trả lời một câu hỏi — route có nối đúng màn hình hay không.
 */
jest.mock('@/features/booking', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MyBookingsScreen: () => <Text>MÀN LỊCH HẸN CỦA TÔI</Text>,
  };
});

import BookingsTabRoute from '@/app/(tabs)/bookings';

describe('route app/(tabs)/bookings.tsx', () => {
  it('render màn Lịch hẹn, KHÔNG còn là vỏ rỗng', async () => {
    await render(<BookingsTabRoute />);

    expect(screen.getByText('MÀN LỊCH HẸN CỦA TÔI')).toBeTruthy();
    // Vỏ rỗng cũ in đúng chữ "Lịch hẹn" và không có gì khác; vế này là thứ làm
    // test đỏ nếu ai đó hoàn nguyên route về vỏ rỗng.
    expect(screen.queryByText('Lịch hẹn')).toBeNull();
  });

  it('route chỉ nối màn hình, KHÔNG nhận tham số nào', () => {
    // `MyBookingsScreen` tự quản bộ lọc bằng state của chính nó. Một ngày nào đó
    // thêm tham số route (ví dụ mở sẵn một tab từ thông báo) thì phải sửa cả
    // route lẫn chữ ký màn hình — test này là chỗ nhắc điều đó.
    expect(BookingsTabRoute).toHaveLength(0);
  });
});
