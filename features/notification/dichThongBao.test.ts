import {
  bieuTuongThongBao,
  cheDoChoThongBao,
  dichThongBao,
  phiaNhanThongBaoBooking,
  nhomThongBao,
  noiDungThongBao,
  tongThongBao,
} from '@/features/notification/dichThongBao';
import type { NotificationResponse } from '@/features/notification/types';

function tb(ghiDe: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    notificationId: 'n',
    type: 'BOOKING_ACCEPTED',
    title: 'Tiêu đề',
    message: 'Nội dung',
    relatedEntityType: 'BOOKING',
    relatedEntityId: 'b1',
    deepLink: '/bookings/b1',
    actionType: 'VIEW_BOOKING',
    read: false,
    readAt: null,
    createdAt: '2026-10-04T13:00:00Z',
    unreadCount: null,
    realtimeEventKind: null,
    ...ghiDe,
  };
}

describe('dichThongBao — bấm vào đi đâu', () => {
  it('hội thoại mở khung chat của app, không dùng deepLink của web', () => {
    expect(dichThongBao(tb({ relatedEntityType: 'CONVERSATION', relatedEntityId: 'c9', deepLink: '/chat/c9' }), 'MENTEE')).toBe(
      '/chat/c9',
    );
  });

  it('bài diễn đàn đi theo route của app (/forum/<id>), KHÔNG theo /forum/posts/<id> của web', () => {
    expect(
      dichThongBao(tb({ type: 'FORUM_POST_COMMENTED', relatedEntityType: 'FORUM_POST', relatedEntityId: 'p1', deepLink: '/forum/posts/p1' }), null),
    ).toBe('/forum/p1');
  });

  it('bài đã bị ẩn thì không dẫn đi đâu — mở ra chỉ gặp 404', () => {
    expect(dichThongBao(tb({ type: 'FORUM_POST_HIDDEN', relatedEntityType: 'FORUM_POST', relatedEntityId: 'p1' }), null)).toBeNull();
  });

  it('booking gửi cho CẢ HAI phía: theo chế độ đang xem', () => {
    const doiLich = tb({ type: 'BOOKING_RESCHEDULE_REQUESTED' });
    expect(dichThongBao(doiLich, 'MENTOR')).toBe('/mentor-booking/b1');
    expect(dichThongBao(doiLich, 'MENTEE')).toBe('/(tabs)/bookings');
    expect(dichThongBao(doiLich, null)).toBe('/(tabs)/bookings');
  });

  it('booking chỉ gửi cho mentee (BOOKING_ACCEPTED) về tab Lịch hẹn DÙ đang ở chế độ Mentor', () => {
    expect(dichThongBao(tb(), 'MENTOR')).toBe('/(tabs)/bookings');
    expect(cheDoChoThongBao(tb(), 'MENTOR')).toBe('MENTEE');
  });

  it('yêu cầu đặt lịch mới (chỉ gửi mentor) mở màn xử lý DÙ đang ở chế độ Mentee', () => {
    const yeuCau = tb({ type: 'BOOKING_REQUEST_CREATED' });
    expect(dichThongBao(yeuCau, 'MENTEE')).toBe('/mentor-booking/b1');
    expect(cheDoChoThongBao(yeuCau, 'MENTEE')).toBe('MENTOR');
  });

  it('phía suy từ type mà tài khoản KHÔNG có thì dùng chế độ đang xem', () => {
    const yeuCau = tb({ type: 'BOOKING_REQUEST_CREATED' });
    expect(dichThongBao(yeuCau, 'MENTEE', ['MENTEE'])).toBe('/(tabs)/bookings');
  });

  it('bảng phía nhận khớp nơi backend phát thông báo', () => {
    expect(phiaNhanThongBaoBooking('BOOKING_PAYMENT_CONFIRMED')).toBe('MENTOR');
    expect(phiaNhanThongBaoBooking('BOOKING_CANCELLED_BY_MENTEE')).toBe('MENTOR');
    expect(phiaNhanThongBaoBooking('BOOKING_CANCELLED_BY_MENTOR')).toBe('MENTEE');
    expect(phiaNhanThongBaoBooking('MEETING_LINK_UPDATED')).toBe('MENTEE');
    expect(phiaNhanThongBaoBooking('SESSION_COMPLETED')).toBeNull();
    expect(phiaNhanThongBaoBooking('BOOKING_REMINDER')).toBeNull();
  });

  it('loại thực thể app không có màn (blog, xác minh mentor) thì không bấm được', () => {
    expect(dichThongBao(tb({ relatedEntityType: 'BLOG_POST', relatedEntityId: 'x' }), 'MENTEE')).toBeNull();
    expect(dichThongBao(tb({ relatedEntityType: 'MENTOR_VERIFICATION', relatedEntityId: null }), 'MENTOR')).toBeNull();
  });

  it('thiếu relatedEntityId thì không đoán', () => {
    expect(dichThongBao(tb({ relatedEntityId: null }), 'MENTOR')).toBeNull();
  });
});

describe('tông màu và biểu tượng', () => {
  it('bốn tông khác nhau cho bốn nhóm loại', () => {
    expect(tongThongBao('BOOKING_ACCEPTED')).toBe('thanh-cong');
    expect(tongThongBao('BOOKING_REMINDER')).toBe('chu-y');
    expect(tongThongBao('BOOKING_CANCELLED_BY_MENTOR')).toBe('trung-tinh');
    expect(tongThongBao('CHAT_UNREAD')).toBe('thuong');
  });

  it('loại backend mới mà app chưa biết rơi về dáng mặc định, không vỡ', () => {
    expect(tongThongBao('LOAI_MOI_TINH')).toBe('thuong');
    expect(bieuTuongThongBao('LOAI_MOI_TINH')).toBe('chuong');
  });

  it('nhắc giờ là đồng hồ, sự cố booking không lẫn vào biểu tượng lịch', () => {
    expect(bieuTuongThongBao('BOOKING_REMINDER')).toBe('dong-ho');
    expect(bieuTuongThongBao('BOOKING_ISSUE_REPORTED')).toBe('su-co');
    expect(bieuTuongThongBao('BOOKING_ACCEPTED')).toBe('lich');
  });
});

describe('noiDungThongBao', () => {
  it('có cả tiêu đề lẫn nội dung thì in cả hai', () => {
    expect(noiDungThongBao(tb())).toEqual({ tieuDe: 'Tiêu đề', moTa: 'Nội dung' });
  });

  it('tiêu đề trùng nội dung thì chỉ in một lần', () => {
    expect(noiDungThongBao(tb({ title: 'Giống', message: 'Giống' }))).toEqual({ tieuDe: null, moTa: 'Giống' });
  });

  it('thiếu nội dung thì lấy tiêu đề làm câu chính', () => {
    expect(noiDungThongBao(tb({ message: null }))).toEqual({ tieuDe: null, moTa: 'Tiêu đề' });
  });
});

describe('nhomThongBao', () => {
  // 2026-10-04 22:30 giờ Việt Nam
  const BAY_GIO = Date.parse('2026-10-04T15:30:00Z');

  it('"hôm nay" theo ngày lịch giờ Việt Nam, không theo giờ UTC', () => {
    // 00:30 ngày 04/10 giờ VN — ngày UTC vẫn là 03/10, nhưng với người dùng là hôm nay.
    const sang = tb({ notificationId: 'a', createdAt: '2026-10-03T17:30:00Z' });
    // 23:30 ngày 03/10 giờ VN — trong vòng 24 giờ nhưng là HÔM QUA.
    const homQua = tb({ notificationId: 'b', createdAt: '2026-10-03T16:30:00Z' });

    const nhom = nhomThongBao([sang, homQua], BAY_GIO);

    expect(nhom).toEqual([
      { title: 'HÔM NAY', data: [sang] },
      { title: 'TRƯỚC ĐÓ', data: [homQua] },
    ]);
  });

  it('bỏ nhóm rỗng, và mốc không đọc được rơi vào "TRƯỚC ĐÓ"', () => {
    const hong = tb({ notificationId: 'c', createdAt: null });

    expect(nhomThongBao([hong], BAY_GIO)).toEqual([{ title: 'TRƯỚC ĐÓ', data: [hong] }]);
    expect(nhomThongBao([], BAY_GIO)).toEqual([]);
  });
});
