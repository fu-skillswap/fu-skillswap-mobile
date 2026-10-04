import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { ChuongThongBao, NotificationsScreen } from '@/features/notification';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

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

let mockCheDo: 'MENTEE' | 'MENTOR' = 'MENTEE';
jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: () => ({ cheDo: mockCheDo, cheDoKhaDung: [mockCheDo], chuyenCheDo: jest.fn() }),
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock; canGoBack: jest.Mock };
}>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function tb(id: string, ghiDe: Record<string, unknown> = {}) {
  return {
    notificationId: id,
    type: 'BOOKING_ACCEPTED',
    title: `Tiêu đề ${id}`,
    message: `Nội dung ${id}`,
    relatedEntityType: 'BOOKING',
    relatedEntityId: `b-${id}`,
    deepLink: `/bookings/b-${id}`,
    actionType: 'VIEW_BOOKING',
    read: false,
    readAt: null,
    // "Bây giờ" — luôn rơi vào nhóm HÔM NAY, kể cả khi test chạy sát nửa đêm.
    createdAt: new Date().toISOString(),
    unreadCount: null,
    realtimeEventKind: null,
    ...ghiDe,
  };
}

const CU = '2026-09-01T03:00:00Z';

function danhSach(items: unknown[]) {
  return http.get(`${BASE}/api/me/notifications`, () =>
    HttpResponse.json(envelope({ items, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 })),
  );
}

const server = setupServer();
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockCheDo = 'MENTEE';
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
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
      <NotificationsScreen thamDoMs={false} />
    </QueryClientProvider>,
  );
}

describe('NotificationsScreen', () => {
  it('chia hai nhóm HÔM NAY / TRƯỚC ĐÓ, chấm xanh chỉ ở dòng chưa đọc', async () => {
    server.use(danhSach([tb('n1'), tb('n2', { read: true, createdAt: CU })]));

    await moMan();

    await waitFor(() => expect(screen.getByText('Nội dung n1')).toBeTruthy());
    expect(screen.getByText('HÔM NAY')).toBeTruthy();
    expect(screen.getByText('TRƯỚC ĐÓ')).toBeTruthy();
    expect(screen.getByTestId('chua-doc-n1')).toBeTruthy();
    expect(screen.queryByTestId('chua-doc-n2')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('chạm dòng chưa đọc: gọi PATCH đã đọc, mở đúng route của APP, chấm biến mất', async () => {
    const daGoi: string[] = [];
    server.use(
      danhSach([tb('n1', { type: 'CHAT_UNREAD', relatedEntityType: 'CONVERSATION', relatedEntityId: 'c1', deepLink: '/chat/c1' })]),
      http.patch(`${BASE}/api/me/notifications/:id/read`, ({ params }) => {
        daGoi.push(String(params.id));
        return HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK' });
      }),
      http.get(`${BASE}/api/me/notifications/unread-count`, () => HttpResponse.json(envelope({ unreadCount: 0 }))),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('thong-bao-n1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('thong-bao-n1'));

    expect(mockRouter.push).toHaveBeenCalledWith('/chat/c1');
    await waitFor(() => expect(daGoi).toEqual(['n1']));
    await waitFor(() => expect(screen.queryByTestId('chua-doc-n1')).toBeNull());
    await donHangDoiDanhSach();
  });

  it('chạm dòng đã đọc thì chỉ điều hướng, không gọi lại PATCH', async () => {
    // Đếm thật số lần gọi: một request không có handler chỉ làm MSW in lỗi ra
    // console chứ KHÔNG làm test đỏ, nên không thể dựa vào `onUnhandledRequest`.
    let soLanPatch = 0;
    server.use(
      danhSach([tb('n1', { read: true, type: 'FORUM_POST_COMMENTED', relatedEntityType: 'FORUM_POST', relatedEntityId: 'p1' })]),
      http.patch(`${BASE}/api/me/notifications/:id/read`, () => {
        soLanPatch += 1;
        return HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK' });
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('thong-bao-n1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('thong-bao-n1'));

    expect(mockRouter.push).toHaveBeenCalledWith('/forum/p1');
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    expect(soLanPatch).toBe(0);
    await donHangDoiDanhSach();
  });

  it('dòng đã đọc mà app không có màn đích thì KHÔNG phải nút', async () => {
    server.use(
      danhSach([
        tb('n1', { read: true, type: 'MENTOR_VERIFICATION_APPROVED', relatedEntityType: 'MENTOR_VERIFICATION', relatedEntityId: null }),
      ]),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('thong-bao-n1')).toBeTruthy());

    expect(screen.getByTestId('thong-bao-n1').props.accessibilityRole).toBeUndefined();
    await donHangDoiDanhSach();
  });

  it('booking ở chế độ Mentor mở màn chi tiết booking của mentor', async () => {
    mockCheDo = 'MENTOR';
    server.use(danhSach([tb('n1', { read: true, type: 'BOOKING_REQUEST_CREATED' })]));

    await moMan();
    await waitFor(() => expect(screen.getByTestId('thong-bao-n1')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('thong-bao-n1'));

    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-booking/b-n1');
    await donHangDoiDanhSach();
  });

  it('"Đọc tất cả" gọi read-all, xoá mọi chấm rồi tự ẩn', async () => {
    let goiDocHet = 0;
    server.use(
      danhSach([tb('n1'), tb('n2', { createdAt: CU })]),
      http.patch(`${BASE}/api/me/notifications/read-all`, () => {
        goiDocHet += 1;
        return HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK' });
      }),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-doc-tat-ca')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-doc-tat-ca'));

    await waitFor(() => expect(screen.queryByTestId('nut-doc-tat-ca')).toBeNull());
    expect(goiDocHet).toBe(1);
    expect(screen.queryByTestId('chua-doc-n1')).toBeNull();
    expect(screen.queryByTestId('chua-doc-n2')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('không có dòng chưa đọc thì không có nút "Đọc tất cả"', async () => {
    server.use(danhSach([tb('n1', { read: true })]));

    await moMan();
    await waitFor(() => expect(screen.getByTestId('thong-bao-n1')).toBeTruthy());

    expect(screen.queryByTestId('nut-doc-tat-ca')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('danh sách rỗng thì nói rõ thông báo đến từ đâu', async () => {
    server.use(danhSach([]));

    await moMan();

    await waitFor(() => expect(screen.getByText('Chưa có thông báo nào')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('nút quay lại rời màn', async () => {
    server.use(danhSach([]));

    await moMan();
    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockRouter.back).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Chưa có thông báo nào')).toBeTruthy());
    await donHangDoiDanhSach();
  });
});

describe('ChuongThongBao', () => {
  async function moChuong() {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChuongThongBao thamDoMs={false} />
      </QueryClientProvider>,
    );
  }

  it('có thông báo chưa đọc thì hiện chấm cam và đọc số trong nhãn trợ năng', async () => {
    server.use(http.get(`${BASE}/api/me/notifications/unread-count`, () => HttpResponse.json(envelope({ unreadCount: 3 }))));

    await moChuong();

    await waitFor(() => expect(screen.getByTestId('cham-thong-bao-moi')).toBeTruthy());
    expect(screen.getByLabelText('Thông báo, 3 chưa đọc')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('không có thông báo chưa đọc thì không có chấm', async () => {
    server.use(http.get(`${BASE}/api/me/notifications/unread-count`, () => HttpResponse.json(envelope({ unreadCount: 0 }))));

    await moChuong();

    await waitFor(() => expect(queryClient.getQueryState(['notification', 'unread-count'])?.status).toBe('success'));
    expect(screen.queryByTestId('cham-thong-bao-moi')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('lỗi khi đếm thì im lặng — không có chấm nào để nói sai', async () => {
    server.use(
      http.get(`${BASE}/api/me/notifications/unread-count`, () =>
        HttpResponse.json({ timestamp: 't', status: 500, code: 'SYS_5000', message: 'Lỗi', data: null }, { status: 500 }),
      ),
    );

    await moChuong();

    await waitFor(() => expect(queryClient.getQueryState(['notification', 'unread-count'])?.status).toBe('error'), {
      timeout: 10_000,
    });
    expect(screen.queryByTestId('cham-thong-bao-moi')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('chạm chuông mở màn Thông báo', async () => {
    server.use(http.get(`${BASE}/api/me/notifications/unread-count`, () => HttpResponse.json(envelope({ unreadCount: 0 }))));

    await moChuong();
    await fireEvent.press(screen.getByTestId('nut-thong-bao'));

    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
    await waitFor(() => expect(queryClient.getQueryState(['notification', 'unread-count'])?.status).toBe('success'));
    await donHangDoiDanhSach();
  });
});
