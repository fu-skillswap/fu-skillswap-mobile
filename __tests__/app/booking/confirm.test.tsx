import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { KOKO_HAPPY } from '@/core/ui/brand';
import { BookingConfirmScreen } from '@/features/booking';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';

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
/**
 * `expo-crypto` thật cần native module: trong Jest `randomUUID()` không trả gì và
 * axios lặng lẽ bỏ header `Idempotency-Key` — đúng cái lỗi test này phải bắt.
 */
let demKhoa = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `khoa-${(demKhoa += 1)}`,
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock; canGoBack: jest.Mock };
}>('expo-router');

function envelope(data: unknown, status = 200) {
  return { timestamp: '2026-10-05T00:00:00Z', status, code: 'SUCCESS', message: 'OK', data };
}

const START_AT = '2026-10-06T12:00:00Z';

/** Báo giá đúng hình dạng `BookingQuoteResponse`, mốc thời gian CÓ offset */
function baoGia(overrides: { estimatedPayableScoin?: number; priceScoin?: number; campaignDiscountScoin?: number } = {}) {
  return {
    slotId: 's1',
    serviceId: 'sv1',
    serviceTitle: 'Review CV 1:1',
    durationMinutes: 45,
    scheduledStartAt: '2026-10-06T19:00:00+07:00',
    scheduledEndAt: '2026-10-06T19:45:00+07:00',
    pendingExpireAt: '2026-10-06T07:00:00+07:00',
    paymentWindowMinutes: 240,
    paymentPreparationBufferMinutes: 120,
    pricing: {
      pricingVersion: 'v1',
      calculatedAt: '2026-10-05T07:00:00+07:00',
      serviceId: 'sv1',
      priceScoin: overrides.priceScoin ?? 150_000,
      priceBeforeCampaignScoin: 165_000,
      campaignDiscountScoin: overrides.campaignDiscountScoin ?? 0,
      estimatedPayableScoin: overrides.estimatedPayableScoin ?? 165_000,
      campaignName: null,
      isEstimate: true,
      disclaimer: 'Giá đã gồm phụ phí nền tảng.',
    },
    cancellationRefundPolicy: {
      earlyMenteeCancellationDeadlineMinutes: 120,
      earlyMenteeRefundPercent: 100,
      lateMenteeRefundPercent: 50,
      lateMentorSharePercent: 40,
      latePlatformSharePercent: 10,
      mentorCancellationRefundPercent: 100,
      mentorNoShowRefundPercent: 100,
    },
    isEstimate: true,
    disclaimer: null,
  };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

// Hồ sơ mentor 404 cũng không sao: tên mentor chỉ là phần trang trí của thẻ tóm tắt.
const hoSoKhongCo = http.get(`${BASE}/api/mentors/m1`, () =>
  HttpResponse.json({ ...envelope(null, 404), code: 'SYS_0003' }, { status: 404 }),
);

async function renderScreen(startAt = START_AT) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingConfirmScreen mentorUserId="m1" slotId="s1" serviceId="sv1" startAt={startAt} />
    </QueryClientProvider>,
  );
}

describe('BookingConfirmScreen', () => {
  it('hiện báo giá của backend nguyên văn, KHÔNG tự trừ số dư', async () => {
    server.use(
      hoSoKhongCo,
      http.post(`${BASE}/api/bookings/quote`, () => HttpResponse.json(envelope(baoGia()))),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('so-phai-tra')).toBeTruthy());
    expect(screen.getByTestId('so-phai-tra')).toHaveTextContent('165.000 S-coins');
    expect(screen.getByText('Giá đã gồm phụ phí nền tảng.')).toBeTruthy();
    expect(screen.getByTestId('ghi-chu-thanh-toan')).toHaveTextContent(/Chưa trừ S-coins/);
    // Không có chữ nào mời nạp tiền — bản Android là consumption-only.
    expect(screen.queryByText(/Nạp/)).toBeNull();
  });

  it('gửi khi chưa viết mục tiêu thì báo lỗi và KHÔNG gọi API tạo booking', async () => {
    const taoBookingSpy = jest.fn();
    server.use(
      hoSoKhongCo,
      http.post(`${BASE}/api/bookings/quote`, () => HttpResponse.json(envelope(baoGia()))),
      http.post(`${BASE}/api/bookings`, () => {
        taoBookingSpy();
        return HttpResponse.json(envelope(taoBooking()));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-gui-dat-lich')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-gui-dat-lich'));

    expect(screen.getByText('Hãy viết ngắn gọn bạn muốn mentor giúp gì.')).toBeTruthy();
    expect(taoBookingSpy).not.toHaveBeenCalled();
  });

  it('gửi đúng payload kèm Idempotency-Key, rồi đổi sang màn "Đã gửi"', async () => {
    let body: unknown = null;
    let khoa: string | null = null;
    server.use(
      hoSoKhongCo,
      http.post(`${BASE}/api/bookings/quote`, () => HttpResponse.json(envelope(baoGia()))),
      http.post(`${BASE}/api/bookings`, async ({ request }) => {
        body = await request.json();
        khoa = request.headers.get('Idempotency-Key');
        return HttpResponse.json(
          envelope(
            taoBooking({
              bookingId: 'b-moi',
              bookingStatus: 'REQUESTED',
              serviceTitle: 'Review CV 1:1',
              selectedStartTime: '2026-10-06T19:00:00+07:00',
              selectedEndTime: '2026-10-06T19:45:00+07:00',
            }),
            201,
          ),
          { status: 201 },
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('o-muc-tieu')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('o-muc-tieu'), '  Sửa CV intern Backend  ');
    await fireEvent.press(screen.getByTestId('nut-gui-dat-lich'));

    await waitFor(() => expect(screen.getByTestId('man-hinh-da-gui-dat-lich')).toBeTruthy());
    /*
      Trạng thái THÀNH CÔNG dùng Koko VUI, đúng vai mà `core/ui/brand.ts` giao
      cho tư thế đó. Ảnh trang trí nên bị ẩn khỏi trình đọc màn hình — chữ "Đã
      gửi yêu cầu" ngay cạnh đã nói hết.
    */
    expect(
      screen.getByTestId('minh-hoa-dat-lich-thanh-cong', { includeHiddenElements: true }).props
        .source,
    ).toBe(KOKO_HAPPY);
    // `startAt` đi NGUYÊN từ bước 2; tiêu đề đã cắt khoảng trắng; mô tả trống
    // thì không gửi trường đó.
    expect(body).toEqual({
      slotId: 's1',
      serviceId: 'sv1',
      startAt: START_AT,
      learningGoalTitle: 'Sửa CV intern Backend',
    });
    expect(khoa).toMatch(/^[A-Za-z0-9._~-]{1,100}$/);

    await fireEvent.press(screen.getByTestId('nut-xem-lich-hen'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/bookings');
  });

  it('dịch vụ miễn phí thì nói "Miễn phí" và không nhắc thanh toán', async () => {
    server.use(
      hoSoKhongCo,
      http.post(`${BASE}/api/bookings/quote`, () =>
        HttpResponse.json(envelope(baoGia({ estimatedPayableScoin: 0, priceScoin: 0 }))),
      ),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('so-phai-tra')).toHaveTextContent('Miễn phí'));
    expect(screen.getByTestId('ghi-chu-thanh-toan')).toHaveTextContent(/xác nhận ngay/);
  });

  it('báo giá 409 (khung vừa bị đặt) thì mời chọn giờ khác, không tự thử lại', async () => {
    const soLanGoi = jest.fn();
    server.use(
      hoSoKhongCo,
      http.post(`${BASE}/api/bookings/quote`, () => {
        soLanGoi();
        return HttpResponse.json(
          { timestamp: '', status: 409, code: 'BOOK_4091', message: 'Khung giờ vừa thay đổi', data: null },
          { status: 409 },
        );
      }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Khung giờ không còn trống')).toBeTruthy());
    expect(soLanGoi).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Chọn giờ khác'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('thiếu tham số khung giờ thì KHÔNG gọi báo giá', async () => {
    server.use(hoSoKhongCo);

    await renderScreen('');

    expect(screen.getByText('Thiếu thông tin khung giờ')).toBeTruthy();
  });
});
