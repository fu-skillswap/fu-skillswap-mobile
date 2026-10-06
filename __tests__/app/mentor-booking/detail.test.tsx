import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { Linking } from 'react-native';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorBookingDetailScreen } from '@/features/booking';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import { loiXacNhan } from '@/features/booking/screens/MentorBookingDetailScreen';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, replace, push, canGoBack }),
    __mockRouter: { back, replace, push, canGoBack },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
let demKhoa = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(demKhoa += 1)}` }));

let daNoiLichHienTai = false;

function datLich(daNoiLich: boolean) {
  daNoiLichHienTai = daNoiLich;
}

function envelope(data: unknown) {
  return { timestamp: '', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const DANG_CHO = taoBooking({
  bookingId: 'mb2',
  menteeDisplayName: 'Lê Ngọc Anh',
  serviceTitle: 'Review CV 1:1',
  learningGoalTitle: 'Sửa CV để apply intern',
  bookingStatus: 'REQUESTED',
  status: 'PENDING',
  displayState: 'PENDING_MENTOR_RESPONSE',
  canAccept: true,
  canReject: true,
});

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  datLich(false);
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

async function moMan() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorBookingDetailScreen bookingId="mb2" daNoiLich={daNoiLichHienTai} />
    </QueryClientProvider>,
  );
}

describe('loiXacNhan — đúng các luật 400 của acceptBooking()', () => {
  it('chưa nối Calendar: bắt chọn nền tảng, link với nền tảng online, địa điểm với Trực tiếp', () => {
    expect(loiXacNhan({ daNoiLich: false, nenTang: null, link: '', diaDiem: '' })).toBe('Chọn hình thức phòng học.');
    expect(loiXacNhan({ daNoiLich: false, nenTang: 'ZOOM', link: '  ', diaDiem: '' })).toBe('Dán link phòng học.');
    expect(loiXacNhan({ daNoiLich: false, nenTang: 'OFFLINE', link: '', diaDiem: '' })).toBe('Nhập địa điểm gặp.');
    expect(loiXacNhan({ daNoiLich: false, nenTang: 'OFFLINE', link: '', diaDiem: 'Thư viện' })).toBeNull();
    expect(loiXacNhan({ daNoiLich: false, nenTang: 'ZOOM', link: 'https://zoom.us/j/1', diaDiem: '' })).toBeNull();
  });

  it('đã nối Calendar: Google Meet không cần link, nền tảng khác vẫn cần', () => {
    expect(loiXacNhan({ daNoiLich: true, nenTang: 'GOOGLE_MEET', link: '', diaDiem: '' })).toBeNull();
    expect(loiXacNhan({ daNoiLich: true, nenTang: 'ZOOM', link: '', diaDiem: '' })).toBe('Dán link phòng học.');
  });
});

describe('MentorBookingDetailScreen', () => {
  it('xác nhận gửi đúng nền tảng + link kèm Idempotency-Key', async () => {
    const ghiNhan: { body: unknown; khoa: string | null } = { body: null, khoa: null };
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))),
      http.post(`${BASE}/api/mentor/bookings/mb2/accept`, async ({ request }) => {
        ghiNhan.body = await request.json();
        ghiNhan.khoa = request.headers.get('Idempotency-Key');
        return HttpResponse.json(envelope({ ...DANG_CHO, canAccept: false, canReject: false, bookingStatus: 'WAITING_PAYMENT' }));
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-xac-nhan-lich')).toBeTruthy());
    // Chưa chọn nền tảng thì nút khoá — chốt luật 400 ngay ở nút.
    expect(screen.getByTestId('nut-xac-nhan-lich')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('nen-tang-ZOOM'));
    await fireEvent.changeText(screen.getByTestId('o-link'), ' https://zoom.us/j/123 ');
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-lich'));

    await waitFor(() => expect(ghiNhan.body).not.toBeNull());
    expect(ghiNhan.body).toEqual({ meetingPlatform: 'ZOOM', meetingLink: 'https://zoom.us/j/123', location: null });
    expect(ghiNhan.khoa).toMatch(/^khoa-/);
  });

  it('mentor đã nối Google Calendar thì xác nhận được ngay với Google Meet, không cần link', async () => {
    datLich(true);
    server.use(http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))));

    await moMan();

    await waitFor(() => expect(screen.getByTestId('nut-xac-nhan-lich')).toBeTruthy());
    expect(screen.getByTestId('nut-xac-nhan-lich')).not.toBeDisabled();
    expect(screen.getByTestId('goi-y-hinh-thuc')).toHaveTextContent(/tạo tự động/);
  });

  it('từ chối mở hộp nhập lý do, lý do trống thì không gửi', async () => {
    const ghiNhan: { body: unknown } = { body: null };
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))),
      http.post(`${BASE}/api/mentor/bookings/mb2/reject`, async ({ request }) => {
        ghiNhan.body = await request.json();
        return HttpResponse.json(envelope({ ...DANG_CHO, canAccept: false, canReject: false, rejectReason: 'Bận' }));
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-tu-choi')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-tu-choi'));

    expect(screen.getByTestId('nut-gui-tu-choi')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('o-ly-do-tu-choi'), '  Khung giờ này mình bận  ');
    await fireEvent.press(screen.getByTestId('nut-gui-tu-choi'));

    await waitFor(() => expect(ghiNhan.body).toEqual({ rejectReason: 'Khung giờ này mình bận' }));
  });

  it('booking đã xử lý thì KHÔNG còn nút xác nhận / từ chối', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () =>
        HttpResponse.json(envelope({ ...DANG_CHO, canAccept: false, canReject: false, bookingStatus: 'CONFIRMED' })),
      ),
    );

    await moMan();

    await waitFor(() => expect(screen.getByText('Lê Ngọc Anh')).toBeTruthy());
    expect(screen.queryByTestId('nut-xac-nhan-lich')).toBeNull();
    expect(screen.queryByTestId('nut-tu-choi')).toBeNull();
  });

  it('lỗi check-in được in ra, không bị nuốt', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () =>
        HttpResponse.json(
          envelope({
            ...DANG_CHO,
            canAccept: false,
            canReject: false,
            bookingStatus: 'CONFIRMED',
            attendance: { ...DANG_CHO.attendance, canCheckIn: true },
          }),
        ),
      ),
      http.post(`${BASE}/api/me/bookings/mb2/check-in`, () =>
        HttpResponse.json(
          { timestamp: '', status: 409, code: 'RESOURCE_CONFLICT', message: 'Booking chưa có session để check-in', data: null },
          { status: 409 },
        ),
      ),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-check-in')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-check-in'));

    await waitFor(() => expect(screen.getByTestId('loi-xu-ly-lich')).toBeTruthy());
  });

  it('lỗi từ chối in TRONG hộp thoại đang mở, mở lại thì lỗi cũ đã xoá', async () => {
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))),
      http.post(`${BASE}/api/mentor/bookings/mb2/reject`, () =>
        HttpResponse.json(
          { timestamp: '', status: 409, code: 'BOOKING_INVALID_STATUS', message: 'Booking không còn ở trạng thái PENDING', data: null },
          { status: 409 },
        ),
      ),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-tu-choi')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-tu-choi'));
    await fireEvent.changeText(screen.getByTestId('o-ly-do-tu-choi'), 'Bận');
    await fireEvent.press(screen.getByTestId('nut-gui-tu-choi'));

    await waitFor(() => expect(within(screen.getByTestId('hop-thoai-tu-choi')).getByTestId('loi-tu-choi')).toBeTruthy());
    expect(screen.queryByTestId('loi-xu-ly-lich')).toBeNull();

    await fireEvent.press(within(screen.getByTestId('hop-thoai-tu-choi')).getByText('Quay lại'));
    await fireEvent.press(screen.getByTestId('nut-tu-choi'));
    expect(screen.queryByTestId('loi-tu-choi')).toBeNull();
  });

  it('"Hoàn tất buổi học" hỏi lại rồi gửi POST /complete kèm Idempotency-Key', async () => {
    const ghiNhan: { khoa: string | null; goi: number } = { khoa: null, goi: 0 };
    const choHoanTat = {
      ...DANG_CHO,
      canAccept: false,
      canReject: false,
      bookingStatus: 'AWAITING_MENTOR_COMPLETION',
      canCompleteByMentor: true,
    };
    // GET trả trạng thái HIỆN TẠI như backend: sau khi hoàn tất, lần tải lại cũng
    // phải thấy booking đã sang chờ mentee.
    let hienTai: typeof choHoanTat = choHoanTat;
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(hienTai))),
      http.post(`${BASE}/api/mentor/bookings/mb2/complete`, ({ request }) => {
        ghiNhan.goi += 1;
        ghiNhan.khoa = request.headers.get('Idempotency-Key');
        hienTai = { ...choHoanTat, canCompleteByMentor: false, bookingStatus: 'AWAITING_MENTEE_CONFIRMATION' };
        return HttpResponse.json(envelope(hienTai));
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-hoan-tat')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-hoan-tat'));
    // Chưa gửi gì cho tới khi xác nhận trong hộp thoại.
    expect(ghiNhan.goi).toBe(0);
    await fireEvent.press(screen.getByTestId('nut-gui-hoan-tat'));

    await waitFor(() => expect(ghiNhan.goi).toBe(1));
    expect(ghiNhan.khoa).toMatch(/^khoa-/);
    await waitFor(() => expect(screen.queryByTestId('nut-hoan-tat')).toBeNull());
  });

  it('mentor huỷ buổi đã xác nhận: bắt buộc lý do, gửi POST /api/mentor/bookings/{id}/cancel', async () => {
    const ghiNhan: { body: unknown } = { body: null };
    const daXacNhan = { ...DANG_CHO, canAccept: false, canReject: false, bookingStatus: 'CONFIRMED', canCancel: true };
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(daXacNhan))),
      http.post(`${BASE}/api/mentor/bookings/mb2/cancel`, async ({ request }) => {
        ghiNhan.body = await request.json();
        return HttpResponse.json(envelope({ ...daXacNhan, canCancel: false, bookingStatus: 'CANCELED_BY_MENTOR' }));
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-huy-buoi')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-huy-buoi'));
    expect(screen.getByTestId('nut-gui-huy-buoi')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), ' Mình ốm ');
    await fireEvent.press(screen.getByTestId('nut-gui-huy-buoi'));

    await waitFor(() => expect(ghiNhan.body).toEqual({ cancelReason: 'Mình ốm' }));
  });

  it('mở link phòng học hỏng thì báo lỗi, không im lặng', async () => {
    const moLink = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('không mở được'));
    server.use(
      http.get(`${BASE}/api/me/bookings/mb2`, () =>
        HttpResponse.json(
          envelope({
            ...DANG_CHO,
            canAccept: false,
            canReject: false,
            bookingStatus: 'CONFIRMED',
            meetingPlatform: 'ZOOM',
            meetingLink: 'zoommtg://hong',
          }),
        ),
      ),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-mo-phong-hoc')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-mo-phong-hoc'));

    await waitFor(() => expect(screen.getByTestId('loi-mo-phong-hoc')).toBeTruthy());
    moLink.mockRestore();
  });

  it('trạng thái Calendar về SAU khi màn đã vẽ: vẫn chọn sẵn Google Meet', async () => {
    server.use(http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))));

    const { rerender } = await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-xac-nhan-lich')).toBeDisabled());

    await rerender(
      <QueryClientProvider client={queryClient}>
        <MentorBookingDetailScreen bookingId="mb2" daNoiLich />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('nut-xac-nhan-lich')).not.toBeDisabled());
    expect(screen.getByTestId('goi-y-hinh-thuc')).toHaveTextContent(/tạo tự động/);
  });

  it('mất mạng và chưa có cache: báo không có kết nối, KHÔNG quay mãi', async () => {
    onlineManager.setOnline(false);
    try {
      server.use(http.get(`${BASE}/api/me/bookings/mb2`, () => HttpResponse.json(envelope(DANG_CHO))));

      await moMan();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByTestId('dang-tai-chi-tiet')).toBeNull();
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
  });
});
