import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MentorBookingCard } from '@/features/booking/components/MentorBookingCard';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import type { BookingResponse } from '@/features/booking/types';

const checkIn = jest.fn();
const moPhongHoc = jest.fn();

beforeEach(() => {
  checkIn.mockClear();
  moPhongHoc.mockClear();
});

/** `render` của RNTL 14 là HÀM ASYNC — phải await, nếu không act scope rò ra. */
async function renderCard(ghiDe: Partial<BookingResponse> = {}, dangCheckIn: string | null = null) {
  return render(
    <MentorBookingCard
      booking={taoBooking(ghiDe)}
      onCheckIn={checkIn}
      onMoPhongHoc={moPhongHoc}
      dangCheckIn={dangCheckIn}
    />,
  );
}

/** Một booking đang trong giờ học, mentor được check-in */
function dangDenGio(ghiDe: Partial<BookingResponse> = {}): Partial<BookingResponse> {
  return {
    bookingStatus: 'CONFIRMED',
    displayState: 'IN_SESSION',
    canJoin: true,
    attendance: {
      mentorCheckedInAt: null,
      menteeCheckedInAt: null,
      summary: 'NONE',
      currentUserCheckedIn: false,
      canCheckIn: true,
      checkInOpensAt: '2026-10-04T20:15:00+07:00',
      checkInClosesAt: '2026-10-04T21:45:00+07:00',
    },
    ...ghiDe,
  };
}

describe('MentorBookingCard', () => {
  it('hiện tên MENTEE chứ không phải tên mentor', async () => {
    // Lớp lỗi đắt nhất của thẻ này: hai góc nhìn dùng cùng một DTO, nên đọc
    // trượt sang `mentorDisplayName` vẫn cho một cái tên hợp lệ trên màn hình —
    // tên của CHÍNH mentor đang xem, hoặc tên một người khác hoàn toàn.
    await renderCard({
      mentorDisplayName: 'Trần Minh Quân',
      menteeDisplayName: 'Nguyễn Thu Hà',
    });

    expect(screen.getByText('Nguyễn Thu Hà')).toBeTruthy();
    expect(screen.queryByText('Trần Minh Quân')).toBeNull();
  });

  it('hiện tên dịch vụ, nhãn trạng thái và mốc thời gian', async () => {
    await renderCard();

    expect(screen.getByText('Mock interview System Design')).toBeTruthy();
    expect(screen.getByText('Sắp diễn ra')).toBeTruthy();
    // Giờ in ra phải đúng MẶT ĐỒNG HỒ backend viết (20:30 +07:00), không chạy
    // theo múi giờ của máy chạy test — CI chạy UTC.
    expect(screen.getByText('20:30 – 21:30')).toBeTruthy();
  });

  it('menteeDisplayName null thì vẫn đọc được, không để khoảng trống', async () => {
    await renderCard({ menteeDisplayName: null });

    expect(screen.getByText('Mentee')).toBeTruthy();
  });

  it('serviceTitle null thì lùi về mục tiêu học tập', async () => {
    await renderCard({ serviceTitle: null, learningGoalTitle: 'Sửa portfolio UX' });

    expect(screen.getByText('Sửa portfolio UX')).toBeTruthy();
  });

  it('hiện giá GỐC của dịch vụ kèm đơn vị S-coin', async () => {
    await renderCard({
      serviceIsFreeSnapshot: false,
      servicePriceScoinSnapshot: 150000,
      servicePriceWithSurchargeScoin: 165000,
    });

    // Giá cộng phụ phí là số mentee phải trả; in nó ở màn mentor là nói sai.
    expect(screen.getByText('150.000 S-coin')).toBeTruthy();
    expect(screen.queryByText('165.000 S-coin')).toBeNull();
  });

  it('booking không gắn service thì KHÔNG in ô giá nào', async () => {
    await renderCard({
      serviceId: null,
      serviceTitle: null,
      serviceIsFreeSnapshot: null,
      servicePriceScoinSnapshot: null,
    });

    expect(screen.queryByTestId('gia-mentor-b1')).toBeNull();
  });

  it('nhãn "Vắng mặt" THẮNG dù bookingStatus vẫn là COMPLETED', async () => {
    // `NO_SHOW_MENTOR` không có `BookingStatus` riêng. Gắn nhãn "Đã hoàn thành"
    // cho nó là nói với mentor rằng buổi học đã diễn ra.
    await renderCard({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'NO_SHOW_MENTOR',
    });

    expect(screen.getByText('Vắng mặt')).toBeTruthy();
    expect(screen.queryByText('Đã hoàn thành')).toBeNull();
  });

  it('nhãn "Đang diễn ra" đến từ displayState, không từ enum trạng thái', async () => {
    await renderCard(dangDenGio());

    expect(screen.getByText('Đang diễn ra')).toBeTruthy();
  });

  it('KHÔNG có mốc thời gian thì bỏ hẳn dải ngày/giờ', async () => {
    await renderCard({
      bookingId: 'b9',
      selectedStartTime: null,
      selectedEndTime: null,
      serviceIsFreeSnapshot: null,
      servicePriceScoinSnapshot: null,
    });

    expect(screen.queryByTestId('thoi-gian-mentor-b9')).toBeNull();
  });

  it('canCheckIn thì hiện nút Check-in và gọi đúng booking', async () => {
    await renderCard(dangDenGio());

    await fireEvent.press(screen.getByTestId('nut-check-in-b1'));

    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(checkIn.mock.calls[0]?.[0]?.bookingId).toBe('b1');
  });

  it('canCheckIn FALSE thì KHÔNG dựng nút Check-in', async () => {
    // Cờ của backend là nguồn sự thật: nó đã false ngay sau khi mentor check-in
    // và cả khi buổi chưa có session (`checkIn()` trả 409 lúc đó).
    await renderCard(
      dangDenGio({
        attendance: {
          mentorCheckedInAt: '2026-10-04T20:20:00+07:00',
          menteeCheckedInAt: null,
          summary: 'MENTOR_ONLY',
          currentUserCheckedIn: true,
          canCheckIn: false,
          checkInOpensAt: '2026-10-04T20:15:00+07:00',
          checkInClosesAt: '2026-10-04T21:45:00+07:00',
        },
      }),
    );

    expect(screen.queryByTestId('nut-check-in-b1')).toBeNull();
  });

  it('đang gửi check-in thì nút khoá lại', async () => {
    await renderCard(dangDenGio(), 'b1');

    const nut = screen.getByTestId('nut-check-in-b1');
    await fireEvent.press(nut);

    expect(checkIn).not.toHaveBeenCalled();
    expect(nut.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });

  it('canJoin + có link thì hiện nút mở phòng học', async () => {
    await renderCard(
      dangDenGio({
        meetingPlatform: 'ZOOM',
        meetingLink: 'https://zoom.us/j/123',
      }),
    );

    await fireEvent.press(screen.getByTestId('nut-mo-phong-hoc-b1'));

    expect(moPhongHoc).toHaveBeenCalledTimes(1);
  });

  it('nhãn nút KHÔNG nói cứng "Google Meet"', async () => {
    // `MeetingPlatform` có 6 giá trị; nhãn cứng nói sai với 5 trong 6.
    await renderCard(
      dangDenGio({ meetingPlatform: 'DISCORD', meetingLink: 'https://discord.gg/abc' }),
    );

    expect(screen.getByText('Mở phòng học')).toBeTruthy();
    expect(screen.queryByText('Mở Google Meet')).toBeNull();
  });

  it('canJoin mà KHÔNG có link (buổi offline) thì hiện ĐỊA ĐIỂM, không dựng nút', async () => {
    await renderCard(
      dangDenGio({
        meetingPlatform: 'OFFLINE',
        meetingLink: null,
        location: 'Thư viện FPTU HCM - tầng 2',
      }),
    );

    expect(screen.getByTestId('dia-diem-mentor-b1')).toBeTruthy();
    expect(screen.getByText('Thư viện FPTU HCM - tầng 2')).toBeTruthy();
    expect(screen.queryByTestId('nut-mo-phong-hoc-b1')).toBeNull();
  });

  it('link chỉ có khoảng trắng KHÔNG tính là có link', async () => {
    await renderCard(dangDenGio({ meetingLink: '   ' }));

    expect(screen.queryByTestId('nut-mo-phong-hoc-b1')).toBeNull();
  });

  it('KHÔNG dựng nút Xác nhận / Từ chối dù backend cho phép', async () => {
    // TEST CANH — đừng xoá. Cả hai thao tác đều cần dữ liệu mà thẻ này không có
    // chỗ nhập: `accept` đòi `meetingPlatform` (+ link hoặc địa điểm) khi mentor
    // chưa kết nối Google Calendar, `reject` đòi `rejectReason` `@NotBlank`.
    // Thêm lại hai nút ở đây mà không có chỗ nhập là dựng hai nút nhận 400.
    await renderCard({
      bookingStatus: 'REQUESTED',
      status: 'PENDING',
      displayState: 'PENDING_MENTOR_RESPONSE',
      canAccept: true,
      canReject: true,
      nextAction: 'ACCEPT_OR_REJECT',
    });

    expect(screen.getByText('Đang chờ')).toBeTruthy();
    expect(screen.queryByText('Xác nhận')).toBeNull();
    expect(screen.queryByText('Từ chối')).toBeNull();
  });

  it('KHÔNG dựng lối thanh toán nào, kể cả khi canPay đúng', async () => {
    // Mục 4.1 của quy ước: bản mobile chỉ xem và tiêu.
    await renderCard({
      bookingStatus: 'WAITING_PAYMENT',
      displayState: 'PAYMENT_REQUIRED',
      canPay: true,
      nextAction: 'PAY_NOW',
    });

    expect(screen.queryByText('Nạp')).toBeNull();
    expect(screen.queryByText('Thanh toán')).toBeNull();
    expect(screen.getByText('Chờ thanh toán')).toBeTruthy();
  });

  it('booking đã đóng thì không có nút nào', async () => {
    await renderCard({
      bookingStatus: 'CANCELED_BY_MENTEE',
      displayState: 'CANCELED_OR_EXPIRED',
      canJoin: false,
    });

    expect(screen.queryByTestId('nut-check-in-b1')).toBeNull();
    expect(screen.queryByTestId('nut-mo-phong-hoc-b1')).toBeNull();
    expect(screen.getByText('Mentee hủy')).toBeTruthy();
  });
});
