import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '@/core/ui/TextField';

describe('TextField', () => {
  it('gõ vào ô thì gọi onChangeText', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField
        label="Mã số sinh viên"
        value=""
        onChangeText={onChangeText}
        testID="o-nhap"
      />,
    );

    await fireEvent.changeText(screen.getByTestId('o-nhap'), 'SE192621');

    expect(onChangeText).toHaveBeenCalledWith('SE192621');
  });

  it('nhãn nối được với ô nhập cho trình đọc màn hình', async () => {
    await render(
      <TextField label="Tên dịch vụ" value="Review CV 1:1" onChangeText={jest.fn()} />,
    );

    expect(screen.getByLabelText('Tên dịch vụ').props.value).toBe('Review CV 1:1');
  });

  it('có prop lỗi thì hiện lời nhắn và khai ô là sai', async () => {
    await render(
      <TextField
        label="Mã số sinh viên"
        value=""
        onChangeText={jest.fn()}
        error="Mã số sinh viên không đúng định dạng"
        testID="o-nhap"
      />,
    );

    expect(screen.getByText('Mã số sinh viên không đúng định dạng')).toBeTruthy();
    expect(screen.getByTestId('o-nhap').props['aria-invalid']).toBe(true);
  });

  it('không có lỗi thì không dựng chỗ trống cho lời nhắn', async () => {
    await render(
      <TextField label="Mã số sinh viên" value="" onChangeText={jest.fn()} testID="o-nhap" />,
    );

    expect(screen.getByTestId('o-nhap').props['aria-invalid']).toBeUndefined();
  });

  it('lỗi thắng trạng thái focus: ô vừa báo sai không trông như ô hợp lệ', async () => {
    await render(
      <TextField
        label="Giá công khai"
        value="150.000"
        onChangeText={jest.fn()}
        error="Giá phải lớn hơn 0"
        testID="o-nhap"
      />,
    );

    await fireEvent(screen.getByTestId('o-nhap'), 'focus');

    const className = String(screen.getByTestId('o-nhap').props.className);
    expect(className).toContain('border-danger');
    expect(className).not.toContain('border-accent');
  });

  it('bấm vào rồi rời khỏi ô thì đổi viền focus rồi trả về viền thường', async () => {
    await render(
      <TextField label="Tên hiển thị" value="" onChangeText={jest.fn()} testID="o-nhap" />,
    );

    await fireEvent(screen.getByTestId('o-nhap'), 'focus');
    expect(String(screen.getByTestId('o-nhap').props.className)).toContain('border-accent');

    await fireEvent(screen.getByTestId('o-nhap'), 'blur');
    expect(String(screen.getByTestId('o-nhap').props.className)).toContain('border-line');
  });

  it('hiện chú thích "(không bắt buộc)" cạnh nhãn', async () => {
    await render(
      <TextField
        label="Giới thiệu"
        hint="(không bắt buộc)"
        value=""
        onChangeText={jest.fn()}
        multiline
      />,
    );

    expect(screen.getByText('(không bắt buộc)')).toBeTruthy();
  });
});
