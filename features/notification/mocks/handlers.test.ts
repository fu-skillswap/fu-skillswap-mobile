/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của nhánh thông báo bằng REPO THẬT, để fixture
 * sai hình dạng DTO lộ ra ngay ở đây thay vì trên máy.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { dichThongBao, nhanThoiGianThongBao, nhomThongBao } from '@/features/notification/dichThongBao';
import { __resetNotificationMockForTests, notificationMockHandlers } from '@/features/notification/mocks/handlers';
import { notificationRepo } from '@/features/notification/notificationRepo';

const server = setupServer(...notificationMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  __resetApiClientForTests();
  __resetNotificationMockForTests();
});
afterAll(() => server.close());

describe('handler mock của nhánh thông báo', () => {
  it('danh sách là CursorPageResponse, mốc thời gian là Instant đọc được', async () => {
    const trang = await notificationRepo.getNotifications();

    expect(trang.items.length).toBeGreaterThan(0);
    expect(typeof trang.hasNext).toBe('boolean');
    for (const n of trang.items) {
      expect(typeof n.read).toBe('boolean');
      expect(nhanThoiGianThongBao(n)).not.toBeNull();
    }
  });

  it('có đủ hai nhóm của thiết kế và cả dòng bấm được lẫn dòng không có đích', async () => {
    const trang = await notificationRepo.getNotifications();

    expect(nhomThongBao(trang.items).map((n) => n.title)).toEqual(['HÔM NAY', 'TRƯỚC ĐÓ']);
    expect(trang.items.some((n) => dichThongBao(n, 'MENTEE') !== null)).toBe(true);
    expect(trang.items.some((n) => dichThongBao(n, 'MENTEE') === null)).toBe(true);
  });

  it('số chưa đọc khớp danh sách, và đánh dấu một dòng làm nó giảm đúng 1', async () => {
    const trang = await notificationRepo.getNotifications();
    const truoc = await notificationRepo.getUnreadCount();
    expect(truoc.unreadCount).toBe(trang.items.filter((n) => !n.read).length);

    const chuaDoc = trang.items.find((n) => !n.read);
    await notificationRepo.markRead(chuaDoc?.notificationId ?? '');

    expect((await notificationRepo.getUnreadCount()).unreadCount).toBe(truoc.unreadCount - 1);
  });

  it('đọc tất cả đưa số chưa đọc về 0', async () => {
    await notificationRepo.markAllRead();

    expect((await notificationRepo.getUnreadCount()).unreadCount).toBe(0);
    const trang = await notificationRepo.getNotifications();
    expect(trang.items.every((n) => n.read)).toBe(true);
  });

  it('đánh dấu một id không tồn tại bị từ chối 404', async () => {
    await expect(notificationRepo.markRead('khong-co')).rejects.toBeInstanceOf(ApiClientError);
  });
});
