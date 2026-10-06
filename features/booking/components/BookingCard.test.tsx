import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { BookingCard } from '@/features/booking/components/BookingCard';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import type { BookingResponse } from '@/features/booking/types';

const vaoPhongHoc = jest.fn();
const huyLich = jest.fn();
const xemMentor = jest.fn();
const nhanTin = jest.fn();

beforeEach(() => {
  vaoPhongHoc.mockClear();
  huyLich.mockClear();
  xemMentor.mockClear();
  nhanTin.mockClear();
});

/** `render` của RNTL 14 là HÀM ASYNC — phải await, nếu không act scope rò ra. */
async function renderCard(ghiDe: Partial<BookingResponse> = {}) {
  return render(
    <BookingCard
      booking={taoBooking(ghiDe)}
      onVaoPhongHoc={vaoPhongHoc}
      onHuyLich={huyLich}
      onXemMentor={xemMentor}
      onNhanTin={nhanTin}
    />,
  );
}

describe('BookingCard', () => {
  it('có phòng chat thì hiện nút nhắn tin và mở đúng hội thoại', async () => {
    await renderCard({ bookingId: 'b9', conversationId: 'c9' });

    await fireEvent.press(screen.getByTestId('nut-nhan-tin-b9'));

    expect(nhanTin).toHaveBeenCalledWith('c9');
  });

  it('chưa có phòng chat (mentor chưa chấp nhận) thì KHÔNG có nút nhắn tin', async () => {
    await renderCard({ bookingId: 'b9', conversationId: null });

    expect(screen.queryByTestId('nut-nhan-tin-b9')).toBeNull();
  });

  it('hiện tên mentor, tên dịch vụ, nhãn trạng thái và mốc thời gian', async () => {
    await renderCard();

    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    expect(screen.getByText('Mock interview System Design')).toBeTruthy();
    expect(screen.getByText('Sắp diễn ra')).toBeTruthy();
    // Giờ in ra phải đúng MẶT ĐỒNG HỒ backend viết (20:30 +07:00), không chạy
    // theo múi giờ của máy chạy test — CI chạy UTC.
    expect(screen.getByText('20:30 – 21:30')).toBeTruthy();
  });

  it('mentorDisplayName null thì vẫn đọc được, không để khoảng trống', async () => {
    await renderCard({ mentorDisplayName: null });

    expect(screen.getByText('Mentor')).toBeTruthy();
  });

  it('serviceTitle null thì lùi về mục tiêu học tập, không hiện chuỗi rỗng', async () => {
    await renderCard({ serviceTitle: null, learningGoalTitle: 'Sửa portfolio UX' });

    expect(screen.getByText('Sửa portfolio UX')).toBeTruthy();
  });

  it('KHÔNG có mốc thời gian thì bỏ hẳn dải ngày/giờ, không in khoảng trống', async () => {
    // `selectedStartTime` là nullable thật (slot gốc bị xoá). Một dòng ngày trống
    // trông như lỗi giao diện; bỏ hẳn nó thì không nói gì sai.
    await renderCard({
      bookingId: 'b9',
      selectedStartTime: null,
      selectedEndTime: null,
    });

    expect(screen.queryByTestId('thoi-gian-b9')).toBeNull();
    expect(screen.getByTestId('the-lich-hen-b9')).toBeTruthy();
  });

  it('nút "Vào phòng học" chỉ hiện khi canJoin VÀ có meetingLink', async () => {
    const { unmount } = await renderCard({
      bookingId: 'b1',
      canJoin: true,
      meetingLink: 'https://meet.google.com/abc-defg-hij',
    });
    expect(screen.getByText('Vào phòng học')).toBeTruthy();
    await unmount();

    // `canJoin` đúng mà không có link là chuyện thật: mentor chọn
    // `meetingPlatform = OFFLINE` và chỉ ghi `location`.
    await renderCard({
      bookingId: 'b4',
      canJoin: true,
      meetingLink: null,
      location: 'Phòng 302, Alpha',
    });
    expect(screen.queryByText('Vào phòng học')).toBeNull();
    expect(screen.getByText('Phòng 302, Alpha')).toBeTruthy();
  });

  it('canJoin FALSE thì không có nút vào phòng học, dù đã có link', async () => {
    // Backend mở cửa sổ tham gia theo `BookingActionPolicy.canJoin()`. Tự suy ra
    // từ trạng thái sẽ hiện một nút mà backend chắc chắn trả 409.
    await renderCard({
      canJoin: false,
      meetingLink: 'https://meet.google.com/abc-defg-hij',
    });

    expect(screen.queryByText('Vào phòng học')).toBeNull();
  });

  it('bấm "Vào phòng học" gọi đúng booking đang bấm', async () => {
    await renderCard({
      bookingId: 'b1',
      canJoin: true,
      meetingLink: 'https://meet.google.com/abc-defg-hij',
    });

    await fireEvent.press(screen.getByTestId('nut-vao-phong-hoc-b1'));

    expect(vaoPhongHoc).toHaveBeenCalledTimes(1);
    expect(vaoPhongHoc.mock.calls[0][0].bookingId).toBe('b1');
  });

  it('nút "Hủy lịch" bám theo canCancel của backend', async () => {
    const { unmount } = await renderCard({ canCancel: true });
    expect(screen.getByText('Hủy lịch')).toBeTruthy();
    await unmount();

    await renderCard({ canCancel: false });
    expect(screen.queryByText('Hủy lịch')).toBeNull();
  });

  it('bấm "Hủy lịch" chuyển nguyên booking lên trên, không chỉ id', async () => {
    // Hộp hủy đọc `cancellationRefundPolicy` của chính booking đó để nói ra tỉ lệ
    // hoàn tiền; truyền lên mỗi id thì hộp không có gì để nói.
    await renderCard({ bookingId: 'b2', canCancel: true });

    await fireEvent.press(screen.getByTestId('nut-huy-lich-b2'));

    expect(huyLich).toHaveBeenCalledTimes(1);
    expect(huyLich.mock.calls[0][0].cancellationRefundPolicy).toBeDefined();
  });

  it('buổi đã hoàn thành có lối xem lại mentor, và dẫn đúng mentorUserId', async () => {
    await renderCard({
      bookingId: 'b6',
      mentorUserId: 'm5',
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'USER_CONFIRMED',
      canCancel: false,
    });

    await fireEvent.press(screen.getByTestId('nut-xem-mentor-b6'));

    expect(xemMentor).toHaveBeenCalledWith('m5');
  });

  it('KHÔNG dựng nút "Đánh giá buổi học" dù canSubmitFeedback đúng', async () => {
    // Màn hình chấm sao chưa tồn tại. Xoá test này khi luồng đánh giá có thật.
    await renderCard({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      canSubmitFeedback: true,
      canCancel: false,
    });

    expect(screen.queryByText(/Đánh giá/)).toBeNull();
  });

  it('KHÔNG dựng lối thanh toán nào dù canPay đúng — mục 4.1 của quy ước', async () => {
    // Bản mobile chỉ XEM và TIÊU. Một nút dẫn tới nạp tiền là thứ làm app bị gỡ
    // khỏi Google Play.
    await renderCard({
      bookingStatus: 'WAITING_PAYMENT',
      displayState: 'PAYMENT_REQUIRED',
      paymentStatus: 'PENDING',
      canPay: true,
      nextAction: 'PAY_NOW',
      canCancel: true,
    });

    expect(screen.getByText('Chờ thanh toán')).toBeTruthy();
    expect(screen.queryByText(/Thanh toán/)).toBeNull();
    expect(screen.queryByText(/Nạp/)).toBeNull();
    expect(screen.queryByText(/S-coins/)).toBeNull();
  });

  it('KHÔNG dựng lối nhắn tin nào — màn chat chưa tồn tại', async () => {
    // Xoá test này khi màn `ChatDetail` có thật.
    await renderCard({ conversationId: 'c1', canCancel: true });

    expect(screen.queryByText(/Nhắn/)).toBeNull();
    expect(screen.queryByLabelText('Nhắn tin')).toBeNull();
  });

  it('buổi vắng mặt hiện nhãn "Vắng mặt", không phải "Đã hoàn thành"', async () => {
    await renderCard({
      bookingStatus: 'COMPLETED',
      displayState: 'COMPLETED',
      completionOutcome: 'NO_SHOW_MENTOR',
      canCancel: false,
    });

    expect(screen.getByText('Vắng mặt')).toBeTruthy();
    expect(screen.queryByText('Đã hoàn thành')).toBeNull();
  });

  it('không có hành động nào thì KHÔNG dựng hàng nút rỗng', async () => {
    await renderCard({
      bookingId: 'b8',
      bookingStatus: 'REJECTED_BY_MENTOR',
      displayState: 'CANCELED_OR_EXPIRED',
      canCancel: false,
      canJoin: false,
    });

    expect(screen.getByText('Bị từ chối')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('BookingCard — việc của mentee sau buổi học', () => {
  const diemDanh = jest.fn();
  const xacNhan = jest.fn();
  const DIEM_DANH_MO = {
    mentorCheckedInAt: null,
    menteeCheckedInAt: null,
    summary: 'NONE' as const,
    currentUserCheckedIn: false,
    canCheckIn: true,
    checkInOpensAt: null,
    checkInClosesAt: null,
  };

  beforeEach(() => {
    diemDanh.mockClear();
    xacNhan.mockClear();
  });

  async function renderVoiHanhDong(ghiDe: Partial<BookingResponse>, coHandler = true) {
    return render(
      <BookingCard
        booking={taoBooking(ghiDe)}
        onVaoPhongHoc={vaoPhongHoc}
        onHuyLich={huyLich}
        onXemMentor={xemMentor}
        onDiemDanh={coHandler ? diemDanh : undefined}
        onXacNhanDaHoc={coHandler ? xacNhan : undefined}
      />,
    );
  }

  it('canConfirmByMentee bật thì có nút "Xác nhận đã học" và gọi đúng booking', async () => {
    await renderVoiHanhDong({ bookingId: 'b5', canConfirmByMentee: true });

    await fireEvent.press(screen.getByTestId('nut-xac-nhan-da-hoc-b5'));

    expect(xacNhan).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b5' }));
  });

  it('attendance.canCheckIn bật thì có nút "Điểm danh"', async () => {
    await renderVoiHanhDong({ bookingId: 'b1', attendance: DIEM_DANH_MO });

    await fireEvent.press(screen.getByTestId('nut-diem-danh-b1'));

    expect(diemDanh).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b1' }));
  });

  it('cờ của backend tắt thì KHÔNG có hai nút đó', async () => {
    await renderVoiHanhDong({ bookingId: 'b2', canConfirmByMentee: false });

    expect(screen.queryByTestId('nut-xac-nhan-da-hoc-b2')).toBeNull();
    expect(screen.queryByTestId('nut-diem-danh-b2')).toBeNull();
  });

  it('cờ bật nhưng người gọi không nối handler thì KHÔNG dựng nút chết', async () => {
    await renderVoiHanhDong(
      { bookingId: 'b5', canConfirmByMentee: true, attendance: DIEM_DANH_MO },
      false,
    );

    expect(screen.queryByTestId('nut-xac-nhan-da-hoc-b5')).toBeNull();
    expect(screen.queryByTestId('nut-diem-danh-b5')).toBeNull();
  });
});
