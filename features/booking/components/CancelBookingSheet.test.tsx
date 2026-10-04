import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ApiClientError } from '@/core/api/errors';
import { CancelBookingSheet } from '@/features/booking/components/CancelBookingSheet';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import type { BookingResponse } from '@/features/booking/types';

const dong = jest.fn();
const gui = jest.fn();

beforeEach(() => {
  dong.mockClear();
  gui.mockClear();
});

async function renderSheet(
  options: { booking?: BookingResponse | null; busy?: boolean; error?: unknown } = {},
) {
  return render(
    <CancelBookingSheet
      booking={options.booking === undefined ? taoBooking() : options.booking}
      onClose={dong}
      onSubmit={gui}
      busy={options.busy}
      error={options.error}
    />,
  );
}

describe('CancelBookingSheet', () => {
  it('booking null thì không dựng gì cả', async () => {
    await renderSheet({ booking: null });

    expect(screen.queryByTestId('hop-thoai-huy-lich')).toBeNull();
  });

  it('nói ra TỈ LỆ HOÀN TIỀN thật của booking đó, không nói chung chung', async () => {
    // Hủy sớm và hủy muộn hoàn khác nhau, và người dùng chỉ biết được điều đó
    // TRƯỚC khi bấm. Hai con số lấy từ `cancellationRefundPolicy` đi kèm booking.
    await renderSheet();

    expect(screen.getByText(/120 phút/)).toBeTruthy();
    expect(screen.getByText(/100%/)).toBeTruthy();
    expect(screen.getByText(/50%/)).toBeTruthy();
  });

  it('nút xác nhận BỊ CHẶN khi lý do trống — cancelReason là @NotBlank', async () => {
    // Gửi lý do trống chỉ nhận 400 mà vẫn tiêu một lượt trong hạn mức 3 lần/giờ.
    await renderSheet();

    const nut = screen.getByTestId('nut-xac-nhan-huy');
    expect(nut.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(nut);
    expect(gui).not.toHaveBeenCalled();
  });

  it('lý do chỉ có khoảng trắng cũng bị coi là trống', async () => {
    await renderSheet();

    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), '    ');

    expect(screen.getByTestId('nut-xac-nhan-huy').props.accessibilityState.disabled).toBe(true);
  });

  it('gửi lý do đã CẮT khoảng trắng hai đầu', async () => {
    await renderSheet();

    await fireEvent.changeText(
      screen.getByTestId('o-ly-do-huy'),
      '  Em có lịch thi đột xuất.  ',
    );
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-huy'));

    expect(gui).toHaveBeenCalledWith('Em có lịch thi đột xuất.');
  });

  it('lý do dài quá 1000 ký tự bị chặn kèm lời giải thích', async () => {
    // `@Size(max = 1000)` của backend. Để người dùng bấm rồi nhận 400 là tiêu
    // một lượt trong hạn mức mà không ai hiểu vì sao.
    await renderSheet();

    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), 'a'.repeat(1001));

    expect(screen.getByText(/không được vượt quá 1000 ký tự/)).toBeTruthy();
    expect(screen.getByTestId('nut-xac-nhan-huy').props.accessibilityState.disabled).toBe(true);
  });

  it('mở hộp cho booking KHÁC thì xoá lý do của lần trước', async () => {
    /*
      Gửi lý do "Em có lịch thi" của buổi A sang buổi B là ghi một câu sai vào
      audit log của backend, và mentor của buổi B đọc được câu đó.
    */
    const { rerender } = await renderSheet({ booking: taoBooking({ bookingId: 'bA' }) });
    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), 'Lý do của buổi A');
    expect(screen.getByTestId('nut-xac-nhan-huy').props.accessibilityState.disabled).toBe(false);

    await rerender(
      <CancelBookingSheet
        booking={taoBooking({ bookingId: 'bB' })}
        onClose={dong}
        onSubmit={gui}
      />,
    );

    expect(screen.getByTestId('o-ly-do-huy').props.value).toBe('');
    expect(screen.getByTestId('nut-xac-nhan-huy').props.accessibilityState.disabled).toBe(true);
  });

  it('đang gửi thì nút xác nhận không nhận thêm lần bấm nào', async () => {
    await renderSheet({ busy: true });

    await fireEvent.changeText(screen.getByTestId('o-ly-do-huy'), 'Em xin hủy');
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-huy'));

    expect(gui).not.toHaveBeenCalled();
  });

  it('hiện lỗi của backend NGUYÊN VĂN và KHÔNG có nút thử lại', async () => {
    // Backend chặn 3 yêu cầu hủy / 1 giờ, nên bấm lại vừa hỏng tiếp vừa tiêu một
    // lượt. Khối lỗi phải đứng yên.
    await renderSheet({
      error: new ApiClientError(
        429,
        'SYS_0429',
        'Bạn đang gửi yêu cầu hủy hoặc hoàn tiền quá nhanh, vui lòng thử lại sau',
        null,
        3600,
      ),
    });

    expect(screen.getByTestId('loi-huy-lich')).toBeTruthy();
    expect(screen.getByText(/3600 giây/)).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
  });

  it('bấm "Giữ lịch" thì đóng hộp, không gửi gì', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId('nut-dong-huy-lich'));

    expect(dong).toHaveBeenCalledTimes(1);
    expect(gui).not.toHaveBeenCalled();
  });

  it('nút back cứng của Android cũng đóng được hộp', async () => {
    // Thiếu `onRequestClose` thì người dùng bị kẹt trong một hộp không có đường
    // thoát bằng cử chỉ quen thuộc của hệ điều hành.
    await renderSheet();

    const modal = screen.getByTestId('hop-thoai-huy-lich');
    await fireEvent(modal, 'requestClose');

    expect(dong).toHaveBeenCalledTimes(1);
  });
});
