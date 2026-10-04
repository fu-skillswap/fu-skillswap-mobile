import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { dauTuan, homNayVN, isoNgay } from '@/core/time/lichTuan';
import { studioMockHandlers } from '@/features/mentorMode/mocks/studioMock';
import { MentorScheduleScreen, loiTaoSlot, trangThaiSlot } from '@/features/mentorMode/screens/MentorScheduleScreen';
import type { MentorManagedSlotResponse } from '@/features/mentorMode/types';

jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), __push: push };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
let dem = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(dem += 1)}` }));

const { __push } = jest.requireMock<{ __push: jest.Mock }>('expo-router');

/** Chạy trên mock thật của studio — cùng dữ liệu màn web preview dùng */
const server = setupServer(...studioMockHandlers);
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  __push.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  __resetApiClientForTests();
});
afterAll(() => server.close());

function moMan() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorScheduleScreen />
    </QueryClientProvider>,
  );
}

describe('trangThaiSlot / loiTaoSlot', () => {
  it('slot có booking chốt > có yêu cầu chờ > rảnh', () => {
    const s = (g: Partial<MentorManagedSlotResponse>) =>
      ({ hasLockingBooking: false, lockingBookingCount: 0, pendingBookingCount: 0, ...g }) as MentorManagedSlotResponse;
    expect(trangThaiSlot(s({ hasLockingBooking: true, pendingBookingCount: 2 }))).toBe('chot');
    expect(trangThaiSlot(s({ pendingBookingCount: 1 }))).toBe('cho');
    expect(trangThaiSlot(s({}))).toBe('ranh');
  });

  it('kiểm giờ và dịch vụ trước khi tạo slot', () => {
    const ngay = { nam: 2026, thang: 10, ngay: 6 };
    expect(loiTaoSlot({ batDau: '8h', ketThuc: '10:00', soDichVu: 1, ngay })).toMatch(/24 giờ/);
    expect(loiTaoSlot({ batDau: '10:00', ketThuc: '08:00', soDichVu: 1, ngay })).toMatch(/sau giờ bắt đầu/);
    expect(loiTaoSlot({ batDau: '08:00', ketThuc: '10:00', soDichVu: 0, ngay })).toMatch(/ít nhất một dịch vụ/);
    expect(loiTaoSlot({ batDau: '08:00', ketThuc: '10:00', soDichVu: 1, ngay })).toBeNull();
  });
});

describe('MentorScheduleScreen', () => {
  it('hiện thẻ Google Calendar và slot của ngày đã chọn', async () => {
    await moMan();
    const thuHai = isoNgay(dauTuan(homNayVN()));

    await waitFor(() => expect(screen.getByTestId('the-lich-google')).toBeTruthy());
    await fireEvent.press(screen.getByTestId(`ngay-day-${thuHai}`));
    await waitFor(() => expect(screen.getByTestId(`slot-ms-${thuHai}-sang`)).toBeTruthy());
  });

  it('phần Dịch vụ: bấm thẻ mở màn sửa, nút tạo mở màn tạo', async () => {
    await moMan();
    await fireEvent.press(screen.getByText('Dịch vụ'));

    await waitFor(() => expect(screen.getByTestId('dich-vu-msv1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('dich-vu-msv1'));
    expect(__push).toHaveBeenCalledWith('/mentor-service/msv1');

    await fireEvent.press(screen.getByTestId('nut-tao-dich-vu'));
    expect(__push).toHaveBeenCalledWith('/mentor-service/new');
  });

  it('mở bằng ?phan=dich-vu (từ menu Thêm) thì vào thẳng phần Dịch vụ', async () => {
    await render(
      <QueryClientProvider client={queryClient}>
        <MentorScheduleScreen phanYeuCau="dich-vu" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('dich-vu-msv1')).toBeTruthy());
  });

  it('màn tab đã dựng sẵn vẫn chuyển sang Dịch vụ khi tham số đổi', async () => {
    // Màn tab sống lâu: lần mở thứ hai bằng `?phan=dich-vu` chỉ đổi prop, không
    // dựng lại component, nên giá trị đầu của `useState` không đủ.
    const cay = (phan?: string) => (
      <QueryClientProvider client={queryClient}>
        <MentorScheduleScreen phanYeuCau={phan} />
      </QueryClientProvider>
    );
    const { rerender } = await render(cay());
    await waitFor(() => expect(screen.getByTestId('the-lich-google')).toBeTruthy());

    await rerender(cay('dich-vu'));

    await waitFor(() => expect(screen.getByTestId('dich-vu-msv1')).toBeTruthy());
  });

  it('giá trị lạ của ?phan bị bỏ qua, mở phần Lịch như thường', async () => {
    await render(
      <QueryClientProvider client={queryClient}>
        <MentorScheduleScreen phanYeuCau="khong-co" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('the-lich-google')).toBeTruthy());
  });
});
