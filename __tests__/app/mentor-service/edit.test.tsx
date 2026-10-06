import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorServiceEditScreen, docGia, loiDichVu } from '@/features/mentorMode/screens/MentorServiceEditScreen';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return { useRouter: () => ({ back, replace, push, canGoBack }), __mockRouter: { back, replace, push, canGoBack } };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

const { __mockRouter } = jest.requireMock<{ __mockRouter: { back: jest.Mock } }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const RANG_BUOC = { allowedDurationMinutes: [60, 30, 45], minimumPriceScoinPerMinute: 1000, maximumPriceScoinPerMinute: 20000 };
const DICH_VU = {
  serviceId: 'msv1',
  mentorUserId: 'm1',
  title: 'Review CV 1:1',
  description: 'Góp ý CV',
  expectedOutcome: 'CV tốt hơn',
  durationMinutes: 45,
  isFree: false,
  basePriceScoin: 150000,
  publicPriceScoin: 165000,
  estimatedMentorPayoutScoin: 135000,
  isActive: true,
  maintainPostSessionChat: true,
  deliveryMode: 'ONE_TO_ONE',
  coverAssetId: null,
  coverImageUrl: null,
  version: 3,
  createdAt: '2026-08-01T09:00:00',
  updatedAt: '2026-09-01T09:00:00',
};

const server = setupServer(
  http.get(`${BASE}/api/me/mentor-services/constraints`, () => HttpResponse.json(envelope(RANG_BUOC))),
  http.get(`${BASE}/api/me/mentor-services/msv1`, () => HttpResponse.json(envelope(DICH_VU))),
);
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  __mockRouter.back.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function moMan(serviceId: string | null) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorServiceEditScreen serviceId={serviceId} />
    </QueryClientProvider>,
  );
}

describe('docGia / loiDichVu', () => {
  it('đọc giá có dấu chấm ngăn nghìn', () => {
    expect(docGia('150.000')).toBe(150000);
    expect(docGia('abc')).toBeNull();
  });

  it('giá phải nằm trong khoảng theo phút của constraints', () => {
    const chung = { tieuDe: 'A', moTa: 'B', ketQua: 'C', mienPhi: false, thoiLuong: 30, rangBuoc: RANG_BUOC };
    expect(loiDichVu({ ...chung, gia: '10.000' })).toMatch(/từ 30\.000 đến 600\.000/);
    expect(loiDichVu({ ...chung, gia: '100.000' })).toBeNull();
    expect(loiDichVu({ ...chung, gia: '', mienPhi: true })).toBeNull();
    expect(loiDichVu({ ...chung, gia: '100.000', thoiLuong: null })).toBe('Chọn thời lượng.');
  });
});

describe('MentorServiceEditScreen', () => {
  it('sửa: nạp dữ liệu, hiện thu nhập dự kiến của backend, gửi expectedVersion', async () => {
    const ghiNhan: { body: unknown } = { body: null };
    server.use(
      http.put(`${BASE}/api/me/mentor-services/msv1`, async ({ request }) => {
        ghiNhan.body = await request.json();
        return HttpResponse.json(envelope({ ...DICH_VU, version: 4 }));
      }),
    );
    await moMan('msv1');

    await waitFor(() => expect(screen.getByTestId('thu-nhap-du-kien')).toHaveTextContent('135.000 S-coins'));
    await fireEvent.changeText(screen.getByTestId('o-gia'), '200.000');
    // Giá đổi thì không đoán số mới
    expect(screen.getByTestId('thu-nhap-du-kien')).toHaveTextContent('Cập nhật sau khi lưu');

    await fireEvent.press(screen.getByTestId('nut-luu-dich-vu'));
    await waitFor(() => expect(ghiNhan.body).not.toBeNull());
    expect(ghiNhan.body).toMatchObject({ priceScoin: 200000, expectedVersion: 3, isFree: false });
    expect(ghiNhan.body).not.toHaveProperty('durationMinutes');
    await waitFor(() => expect(__mockRouter.back).toHaveBeenCalled());
  });

  it('tạo mới: thời lượng lấy từ constraints, chưa chọn thì nút khoá', async () => {
    const ghiNhan: { body: unknown } = { body: null };
    server.use(
      http.post(`${BASE}/api/me/mentor-services`, async ({ request }) => {
        ghiNhan.body = await request.json();
        return HttpResponse.json(envelope({ ...DICH_VU, serviceId: 'moi' }));
      }),
    );
    await moMan(null);

    await waitFor(() => expect(screen.getByTestId('thoi-luong-30')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('o-ten-dich-vu'), 'Mock interview');
    await fireEvent.changeText(screen.getByTestId('o-mo-ta-dich-vu'), 'Phỏng vấn thử');
    await fireEvent.changeText(screen.getByTestId('o-ket-qua'), 'Tự tin hơn');
    await fireEvent.changeText(screen.getByTestId('o-gia'), '60.000');
    expect(screen.getByTestId('nut-luu-dich-vu')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('thoi-luong-60'));
    await fireEvent.press(screen.getByTestId('nut-luu-dich-vu'));

    await waitFor(() => expect(ghiNhan.body).toMatchObject({ durationMinutes: 60, priceScoin: 60000, deliveryMode: 'ONE_TO_ONE' }));
  });
});

describe('MentorServiceEditScreen — tải thất bại', () => {
  it('tạo mới: không tải được thời lượng thì nói ra và cho thử lại, không kẹt form', async () => {
    let lan = 0;
    server.use(
      http.get(`${BASE}/api/me/mentor-services/constraints`, () => {
        lan += 1;
        return lan === 1
          ? HttpResponse.json({ timestamp: '', status: 500, code: 'SYS_9999', message: 'Lỗi', data: null }, { status: 500 })
          : HttpResponse.json(envelope(RANG_BUOC));
      }),
    );
    queryClient.setDefaultOptions({ queries: { retry: false } });
    await moMan(null);

    await waitFor(() => expect(screen.getByTestId('loi-thoi-luong')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-tai-lai-thoi-luong'));

    await waitFor(() => expect(screen.getByTestId('thoi-luong-30')).toBeTruthy());
  });

  it('sửa khi mất mạng và chưa có cache: "Không có kết nối", KHÔNG quay mãi', async () => {
    onlineManager.setOnline(false);
    try {
      await moMan('msv1');

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByTestId('dang-tai-dich-vu')).toBeNull();
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
  });
});
