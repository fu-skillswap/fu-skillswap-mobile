import { render, screen } from '@testing-library/react-native';

import { SupportLevelBadges } from '@/features/mentor/components/SupportLevelBadges';

describe('SupportLevelBadges', () => {
  it('hiện cả ba mức hỗ trợ kèm nhãn tiếng Việt và thang /4', async () => {
    await render(<SupportLevelBadges foundation={4} outputReview={3} direction={2} />);

    expect(screen.getByText('Nền tảng 4/4')).toBeTruthy();
    expect(screen.getByText('Review bài 3/4')).toBeTruthy();
    expect(screen.getByText('Định hướng 2/4')).toBeTruthy();
  });

  it('mức nào null thì BỎ HẲN, không hiện 0/4', async () => {
    // Mentor chưa khai mức hỗ trợ khác hẳn mentor khai mức thấp nhất. Hiện "0/4"
    // cho cái chưa khai là bịa ra một thông tin backend không nói — và lại là
    // thông tin xấu cho mentor đó.
    await render(<SupportLevelBadges foundation={4} outputReview={null} direction={null} />);

    expect(screen.getByText('Nền tảng 4/4')).toBeTruthy();
    expect(screen.queryByText(/Review bài/)).toBeNull();
    expect(screen.queryByText(/Định hướng/)).toBeNull();
    expect(screen.queryByText(/0\/4/)).toBeNull();
  });

  it('mức 1 (thấp nhất đã khai) vẫn hiện — không bị lẫn với chưa khai', async () => {
    // Lọc theo tính truthy thay vì `!= null` sẽ ăn mất mức 1 nếu ai đó đổi thang
    // về 0-based, và quan trọng hơn: nó biến "khai mức thấp" thành "chưa khai".
    await render(<SupportLevelBadges foundation={1} outputReview={1} direction={1} />);

    expect(screen.getAllByText(/1\/4/)).toHaveLength(3);
  });

  it('cả ba đều null thì KHÔNG render gì', async () => {
    // Một View rỗng vẫn ăn khoảng cách `gap` của khối cha và để lại một lỗ trong
    // thẻ mentor mà không ai hiểu vì sao có.
    await render(
      <SupportLevelBadges
        testID="muc-ho-tro"
        foundation={null}
        outputReview={null}
        direction={null}
      />,
    );

    expect(screen.queryByTestId('muc-ho-tro')).toBeNull();
  });
});
