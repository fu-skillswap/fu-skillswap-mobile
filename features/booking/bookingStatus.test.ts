/**
 * @file bookingStatus.test.ts
 * @description Kiểm việc quy một booking về một nhãn trạng thái.
 *
 * Hai thứ test này tồn tại để canh: (1) tám nhãn trong `HANDOFF.md` mục 4 đều
 * phải ra được từ dữ liệu THẬT của backend, và (2) hai nhãn không đến từ
 * `bookingStatus` ("Đang diễn ra", "Vắng mặt") không được âm thầm biến thành
 * nhãn khác khi ai đó đơn giản hoá bảng map.
 */

import { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
import type { NguonNhanTrangThai } from '@/features/booking/bookingStatus';
import type { BookingLifecycleStatus } from '@/features/booking/types';

function booking(ghiDe: Partial<NguonNhanTrangThai> = {}): NguonNhanTrangThai {
  return {
    bookingStatus: 'REQUESTED',
    displayState: 'PENDING_MENTOR_RESPONSE',
    completionOutcome: null,
    ...ghiDe,
  };
}

describe('nhanTrangThaiBooking', () => {
  it('phủ ĐỦ 10 giá trị của BookingLifecycleStatus, mỗi giá trị một nhãn không rỗng', () => {
    // Danh sách viết tay để một giá trị enum mới của backend phải được thêm vào
    // đây một cách có ý thức, chứ không lặng lẽ đi qua.
    const moiTrangThai: BookingLifecycleStatus[] = [
      'REQUESTED',
      'WAITING_PAYMENT',
      'CONFIRMED',
      'REJECTED_BY_MENTOR',
      'CANCELED_BY_MENTEE',
      'CANCELED_BY_MENTOR',
      'REQUEST_EXPIRED',
      'PAYMENT_EXPIRED',
      'UNDER_REVIEW',
      'COMPLETED',
    ];

    const nhan = moiTrangThai.map(
      (bookingStatus) => nhanTrangThaiBooking(booking({ bookingStatus })).label,
    );

    expect(nhan.every((label) => label.length > 0)).toBe(true);
    // Hai trạng thái khác nhau mà cùng một nhãn thì người dùng không phân biệt
    // được chúng — riêng hai nhánh quá hạn phải nói rõ quá hạn gì.
    expect(new Set(nhan).size).toBe(moiTrangThai.length);
  });

  it('giữ ĐÚNG nhãn của HANDOFF mục 4 cho sáu trạng thái có trong enum', () => {
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'REQUESTED' })).label).toBe('Đang chờ');
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'COMPLETED' })).label).toBe(
      'Đã hoàn thành',
    );
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'REJECTED_BY_MENTOR' })).label).toBe(
      'Bị từ chối',
    );
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'REQUEST_EXPIRED' })).label).toBe(
      'Quá hạn',
    );
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'CANCELED_BY_MENTEE' })).label).toBe(
      'Mentee hủy',
    );
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'CANCELED_BY_MENTOR' })).label).toBe(
      'Mentor hủy',
    );
  });

  it('"Đang diễn ra" đến từ displayState, KHÔNG từ bookingStatus', () => {
    // Cả hai booking dưới đây có cùng `bookingStatus = CONFIRMED`. Một bản map
    // chỉ đọc `bookingStatus` sẽ gắn cùng một nhãn cho cả hai, và nhãn nền
    // `accent` duy nhất của thiết kế sẽ không bao giờ xuất hiện.
    const dangHoc = booking({ bookingStatus: 'CONFIRMED', displayState: 'IN_SESSION' });
    const sapHoc = booking({ bookingStatus: 'CONFIRMED', displayState: 'UPCOMING' });

    expect(nhanTrangThaiBooking(dangHoc)).toEqual({ label: 'Đang diễn ra', tone: 'accent' });
    expect(nhanTrangThaiBooking(sapHoc).label).toBe('Sắp diễn ra');
  });

  it('CONFIRMED đã qua giờ học thì là "Chờ xác nhận", không phải "Sắp diễn ra"', () => {
    const quaGio = booking({
      bookingStatus: 'CONFIRMED',
      displayState: 'WAITING_CONFIRMATION',
    });

    expect(nhanTrangThaiBooking(quaGio).label).toBe('Chờ xác nhận');
  });

  it('"Vắng mặt" đến từ completionOutcome và THẮNG nhãn của bookingStatus', () => {
    // Buổi vắng mặt vẫn đóng với `bookingStatus = COMPLETED`. Gắn "Đã hoàn thành"
    // cho nó là nói rằng buổi học đã diễn ra, trong khi tiền đã được hoàn.
    const mentorVang = booking({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'NO_SHOW_MENTOR',
    });
    const menteeVang = booking({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'NO_SHOW_MENTEE',
    });

    expect(nhanTrangThaiBooking(mentorVang).label).toBe('Vắng mặt');
    expect(nhanTrangThaiBooking(menteeVang).label).toBe('Vắng mặt');
  });

  it('completionOutcome bình thường KHÔNG che nhãn trạng thái', () => {
    // Chỉ hai giá trị NO_SHOW_* mới đổi nhãn; `AUTO_CLOSED` hay `USER_CONFIRMED`
    // vẫn là một buổi đã hoàn thành.
    const tuDong = booking({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'AUTO_CLOSED',
    });

    expect(nhanTrangThaiBooking(tuDong).label).toBe('Đã hoàn thành');
  });

  it('tone bám theo nhóm nghĩa, để màu không nói ngược nội dung', () => {
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'REQUESTED' })).tone).toBe('warning');
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'COMPLETED' })).tone).toBe('success');
    expect(nhanTrangThaiBooking(booking({ bookingStatus: 'CANCELED_BY_MENTOR' })).tone).toBe(
      'neutral',
    );
  });
});
