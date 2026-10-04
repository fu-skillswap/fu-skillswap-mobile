import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { MentorStatTile } from '@/features/mentorMode/components/MentorStatTile';

describe('MentorStatTile', () => {
  it('hiện nhãn, giá trị và đơn vị trên cùng một dòng', async () => {
    await render(
      <MentorStatTile
        label="Số dư khả dụng"
        giaTri="1.215.000"
        donVi="S-coin"
        icon={<Text>icon</Text>}
        testID="o-so-du"
      />,
    );

    expect(screen.getByText('Số dư khả dụng')).toBeTruthy();
    // Đơn vị là `<Text>` lồng, nên RNTL gộp chữ của cả cây lại.
    expect(screen.getByTestId('o-so-du-gia-tri')).toHaveTextContent('1.215.000 S-coin');
  });

  it('không có đơn vị thì không in gì thêm sau con số', async () => {
    await render(
      <MentorStatTile
        label="Buổi đã hoàn thành"
        giaTri="18"
        icon={<Text>icon</Text>}
        testID="o-buoi"
      />,
    );

    expect(screen.getByTestId('o-buoi-gia-tri')).toHaveTextContent('18');
  });

  it('nhận giá trị là CHỮ, không chỉ con số', async () => {
    // Ô này không được tự quyết "null thì in 0": quyết định đó là của tầng
    // nghiệp vụ, và một ô tự in "0" cho `null` là cách chắc chắn để nói sai về
    // điểm đánh giá của một mentor chưa có lượt nào.
    await render(
      <MentorStatTile
        label="Đánh giá"
        giaTri="Chưa có đánh giá"
        icon={<Text>icon</Text>}
        testID="o-danh-gia"
      />,
    );

    expect(screen.getByTestId('o-danh-gia-gia-tri')).toHaveTextContent('Chưa có đánh giá');
  });

  it('KHÔNG dùng fontWeight — nét chữ phải là tên file font', async () => {
    // Trên Android với font tuỳ biến, `fontWeight` không có tác dụng và chữ lặng
    // lẽ rơi về nét thường (mục 1 của quy ước). Lỗi đó không lộ ra trong CI.
    await render(
      <MentorStatTile
        label="Đánh giá"
        giaTri="4.8"
        donVi="/ 87 lượt"
        icon={<Text>i</Text>}
        testID="o-danh-gia"
      />,
    );

    const soLieu = screen.getByTestId('o-danh-gia-gia-tri');
    const style = Array.isArray(soLieu.props.style)
      ? Object.assign({}, ...soLieu.props.style.filter(Boolean))
      : soLieu.props.style;

    expect(style.fontFamily).toBe('Montserrat_800ExtraBold');
    expect(style.fontWeight).toBeUndefined();
  });
});
