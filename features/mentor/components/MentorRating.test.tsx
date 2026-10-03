import { render, screen } from '@testing-library/react-native';

import { MentorRating } from '@/features/mentor/components/MentorRating';
import type { MentorReputation } from '@/features/mentor/types';

function uyTin(overrides: Partial<MentorReputation> = {}): MentorReputation {
  return {
    ratingState: 'RATED',
    ratingAverage: 4.75,
    reviewCount: 12,
    completedSessions: 30,
    ...overrides,
  };
}

describe('MentorRating', () => {
  it('mentor ĐÃ có đánh giá thì hiện điểm một chữ số thập phân và số lượt', async () => {
    await render(<MentorRating reputation={uyTin()} testID="diem" />);

    expect(screen.getByTestId('diem-diem').props.children).toBe('4.8');
    expect(screen.getByText('(12 đánh giá)')).toBeTruthy();
  });

  it('CHƯA có đánh giá thì hiện "Chưa có đánh giá" và KHÔNG có con số nào', async () => {
    // Luật quan trọng nhất của nhánh mentor: một mentor mới hiện 5 sao là bịa ra
    // uy tín, và người xem không có cách nào biết đó là số bịa.
    await render(
      <MentorRating
        reputation={uyTin({ ratingState: 'NO_REVIEWS', ratingAverage: null, reviewCount: 0 })}
        testID="diem"
      />,
    );

    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
    // testID của con số phải VẮNG hẳn: ngôi sao nằm cùng nhánh với nó, nên vắng
    // con số cũng là vắng ngôi sao.
    expect(screen.queryByTestId('diem-diem')).toBeNull();
    expect(screen.queryByText('5.0')).toBeNull();
    expect(screen.queryByText('0.0')).toBeNull();
    expect(screen.queryByText(/đánh giá\)/)).toBeNull();
  });

  it('payload dị dạng (RATED mà điểm null) KHÔNG cho ra "NaN" trên màn hình', async () => {
    // Chỉ kiểm `ratingState` mà bỏ qua giá trị sẽ gọi `null.toFixed(1)` hoặc in
    // ra "NaN" — một màn hình hỏng vì một payload backend không nên trả.
    await render(
      <MentorRating reputation={uyTin({ ratingState: 'RATED', ratingAverage: null })} testID="diem" />,
    );

    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('điểm 0 là điểm HỢP LỆ và vẫn được hiện', async () => {
    // Kiểm theo tính truthy thay vì `!= null` sẽ che mất điểm 0 — đúng thứ người
    // dùng cần thấy nhất trước khi trả tiền cho một buổi học.
    await render(
      <MentorRating reputation={uyTin({ ratingAverage: 0, reviewCount: 3 })} testID="diem" />,
    );

    expect(screen.getByTestId('diem-diem').props.children).toBe('0.0');
    expect(screen.queryByText('Chưa có đánh giá')).toBeNull();
  });
});
