import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import {
  MentorWalletScreen,
  nhanGiaoDich,
  soTienGiaoDich,
  tongGiaoDich,
} from '@/features/mentorMode/screens/MentorWalletScreen';
import { taoGiaoDichVi, taoViMentor } from '@/features/mentorMode/mocks/mentorModeFixture';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

function envelope(data: unknown) {
  return { timestamp: '', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

describe('tongGiaoDich', () => {
  it('chiều tiền quyết định tông, HOLD luôn là đang giữ', () => {
    expect(tongGiaoDich(taoGiaoDichVi({ balanceEffectScoin: 90 }))).toBe('vao');
    expect(tongGiaoDich(taoGiaoDichVi({ balanceEffectScoin: -10, entryType: 'COMMISSION' }))).toBe('ra');
    expect(tongGiaoDich(taoGiaoDichVi({ balanceEffectScoin: -200, entryType: 'HOLD' }))).toBe('giu');
  });

  it('PAID_OUT là tiền RA dù ảnh hưởng số dư bằng 0, số tiền lấy từ amountScoin', () => {
    // `SettlementService.finalizePayout()` ghi `balanceEffectScoin(0)`.
    const daRut = taoGiaoDichVi({ entryType: 'PAID_OUT', sourceType: 'PAYOUT_REQUEST', amountScoin: 200000, balanceEffectScoin: 0 });
    expect(tongGiaoDich(daRut)).toBe('ra');
    expect(soTienGiaoDich(daRut)).toBe(200000);
    expect(nhanGiaoDich(daRut)).toBe('Đã rút về ngân hàng');
  });

  it('RELEASE là thu nhập, nhãn theo nguồn — KHÔNG phải "Hoàn giữ"', () => {
    expect(nhanGiaoDich(taoGiaoDichVi({ entryType: 'RELEASE', sourceType: 'BOOKING' }))).toBe('Thu nhập buổi học');
    expect(nhanGiaoDich(taoGiaoDichVi({ entryType: 'RELEASE', sourceType: 'COURSE_ENROLLMENT' }))).toBe('Thu nhập khoá học');
    expect(tongGiaoDich(taoGiaoDichVi({ entryType: 'RELEASE' }))).toBe('vao');
  });

  it('VOID (huỷ yêu cầu rút) trả tiền về số dư', () => {
    const huy = taoGiaoDichVi({ entryType: 'VOID', sourceType: 'PAYOUT_REQUEST', amountScoin: 5000, balanceEffectScoin: 5000 });
    expect(tongGiaoDich(huy)).toBe('vao');
    expect(soTienGiaoDich(huy)).toBe(5000);
  });
});

describe('MentorWalletScreen — chỉ xem', () => {
  it('hiện số dư và giao dịch của backend', async () => {
    server.use(http.get(`${BASE}/api/me/mentor-wallet`, () => HttpResponse.json(envelope(taoViMentor()))));
    await render(
      <QueryClientProvider client={queryClient}>
        <MentorWalletScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('so-du-kha-dung')).toHaveTextContent(/1\.215\.000/));
    expect(screen.getByTestId('giao-dich-tx-1')).toBeTruthy();
    expect(screen.getByTestId('giao-dich-tx-3')).toBeTruthy();
    // Dòng rút tiền hiện số tiền thật kèm dấu trừ, không phải "+ 0".
    expect(screen.getByTestId('giao-dich-tx-2')).toHaveTextContent(/Đã rút về ngân hàng/);
    expect(screen.getByTestId('giao-dich-tx-2')).toHaveTextContent(/− 200\.000/);
    expect(screen.getByTestId('giao-dich-tx-1')).toHaveTextContent(/Thu nhập buổi học/);
  });

  it('KHÔNG có nút nạp hay rút — quyết định chủ sản phẩm', async () => {
    server.use(http.get(`${BASE}/api/me/mentor-wallet`, () => HttpResponse.json(envelope(taoViMentor()))));
    await render(
      <QueryClientProvider client={queryClient}>
        <MentorWalletScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('so-du-kha-dung')).toBeTruthy());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('Rút tiền')).toBeNull();
    expect(screen.queryByText('Nạp')).toBeNull();
  });
});
