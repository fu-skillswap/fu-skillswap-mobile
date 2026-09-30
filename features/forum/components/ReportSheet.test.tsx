import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ApiClientError } from '@/core/api/errors';
import { ReportSheet } from '@/features/forum/components/ReportSheet';

describe('ReportSheet', () => {
  it('chọn lý do rồi gửi thì báo đúng lý do, mô tả để trống là undefined', async () => {
    // Gửi `description: ''` là gửi một mô tả rỗng lên backend chứ không phải
    // "không có mô tả"; `undefined` mới bị axios bỏ khỏi payload.
    const onSubmit = jest.fn();
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'COMMENT', targetId: 'c1' }}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    await fireEvent.press(screen.getByText('Spam, quảng cáo rác'));
    await fireEvent.press(screen.getByText('Gửi báo cáo'));

    expect(onSubmit).toHaveBeenCalledWith({
      targetType: 'COMMENT',
      targetId: 'c1',
      reasonType: 'SPAM',
      description: undefined,
    });
  });

  it('chưa chọn lý do thì không gửi được', async () => {
    // `reasonType` là trường bắt buộc của backend (forum.md §6.1): gửi thiếu nó
    // chỉ nhận về 400 mà vẫn tiêu một lượt trong hạn mức 10 báo cáo/30 phút.
    const onSubmit = jest.fn();
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'POST', targetId: 'p1' }}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    // Nút phải TỰ KHOÁ, không chỉ im lặng khi bấm: một nút bấm được mà không
    // làm gì là đúng cái bẫy "nút chết" đã ghi ở `CommentItem`.
    expect(screen.getByTestId('nut-gui-bao-cao').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    await fireEvent.press(screen.getByText('Gửi báo cáo'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mô tả chi tiết được gửi kèm, đã cắt khoảng trắng hai đầu', async () => {
    const onSubmit = jest.fn();
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'POST', targetId: 'p1' }}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    await fireEvent.press(screen.getByText('Lý do khác'));
    await fireEvent.changeText(screen.getByLabelText('Mô tả chi tiết'), '  ban nay spam  ');
    await fireEvent.press(screen.getByText('Gửi báo cáo'));

    expect(onSubmit).toHaveBeenCalledWith({
      targetType: 'POST',
      targetId: 'p1',
      reasonType: 'OTHER',
      description: 'ban nay spam',
    });
  });

  it('gửi HỎNG thì hiện nguyên văn câu của backend và KHÔNG có nút Thử lại', async () => {
    // Hạn mức 10 báo cáo/30 phút. Bày nút "Thử lại" ở đây là mời người dùng vào
    // một vòng lặp chắc chắn hỏng tiếp, và mỗi lần vẫn tính vào hạn mức — đúng
    // luật mà `core/ui/ErrorView.tsx` áp cho hành động không nên thử lại.
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'COMMENT', targetId: 'c1' }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        error={
          new ApiClientError(429, 'TOO_MANY_REQUESTS', 'Ban da bao cao qua nhieu lan', null, 120)
        }
      />,
    );

    expect(screen.getByTestId('loi-gui-bao-cao')).toBeTruthy();
    expect(screen.getByText('Ban da bao cao qua nhieu lan')).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
  });

  it('gửi xong thì nói rõ đã gửi, không đóng im lặng như chưa có gì xảy ra', async () => {
    // Đóng hộp mà không nói gì thì người dùng không biết báo cáo đã đi hay chưa
    // và sẽ báo cáo lại lần nữa, đốt thêm hạn mức.
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'COMMENT', targetId: 'c1' }}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        daGui
      />,
    );

    expect(screen.getByTestId('da-gui-bao-cao')).toBeTruthy();
    // Form biến mất: còn đó thì người dùng bấm gửi lần nữa.
    expect(screen.queryByText('Gửi báo cáo')).toBeNull();
  });

  it('nút back cứng của Android đóng được hộp báo cáo', async () => {
    // RNTL 14 đã bỏ `UNSAFE_getByType`, nên lấy `Modal` bằng testID của chính nó
    // rồi gọi thẳng handler mà Android nối vào nút back cứng. Thiếu nó là kẹt
    // trong một hộp không có đường thoát.
    const onClose = jest.fn();
    await render(
      <ReportSheet
        visible
        target={{ targetType: 'COMMENT', targetId: 'c1' }}
        onClose={onClose}
        onSubmit={jest.fn()}
      />,
    );

    const hop = screen.getByTestId('hop-thoai-bao-cao');
    (hop.props.onRequestClose as () => void)();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
