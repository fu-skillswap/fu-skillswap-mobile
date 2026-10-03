import { render, screen } from '@testing-library/react-native';

import { MentorReviewItem } from '@/features/mentor/components/MentorReviewItem';
import type { MentorReviewResponse } from '@/features/mentor/types';

function danhGia(overrides: Partial<MentorReviewResponse> = {}): MentorReviewResponse {
  return {
    reviewId: 'rv1',
    reviewerUserId: 'u1',
    reviewerDisplayName: 'Ngô Bảo Châu',
    reviewerAvatarUrl: null,
    rating: 5,
    comment: 'Anh chỉ rất sát, buổi học xong là mình sửa được ngay.',
    // `LocalDateTime` KHÔNG offset — đúng như backend lên dây.
    createdAt: '2026-09-28T14:05:00',
    ...overrides,
  };
}

describe('MentorReviewItem', () => {
  it('hiện tên người đánh giá, ngày, số sao và nhận xét', async () => {
    await render(<MentorReviewItem review={danhGia()} />);

    expect(screen.getByText('Ngô Bảo Châu')).toBeTruthy();
    expect(screen.getByText('28/09/2026')).toBeTruthy();
    expect(screen.getByText('5/5')).toBeTruthy();
    expect(screen.getByText(/Anh chỉ rất sát/)).toBeTruthy();
  });

  it('số sao của MỘT đánh giá luôn hiện — không đi qua luật "chưa có đánh giá"', async () => {
    // `reputation.ratingAverage` của cả mentor phải qua `moTaDiemDanhGia()`, còn
    // `rating` ở đây là điểm một người đã chấm: nếu item này đang render thì đánh
    // giá đó tồn tại, và che nó đi là làm mất chính dữ liệu người dùng cần đọc.
    await render(<MentorReviewItem review={danhGia({ rating: 1 })} />);

    expect(screen.getByText('1/5')).toBeTruthy();
    expect(screen.getByLabelText('1 trên 5 sao')).toBeTruthy();
  });

  it('không có nhận xét thì bỏ hẳn khối chữ, vẫn hiện người và số sao', async () => {
    // Chỉ chấm sao mà không viết gì là chuyện thường; một khối chữ rỗng trông
    // như nhận xét không tải được.
    await render(<MentorReviewItem review={danhGia({ comment: null })} />);

    expect(screen.getByText('Ngô Bảo Châu')).toBeTruthy();
    expect(screen.getByText('5/5')).toBeTruthy();
    expect(screen.queryByText(/Anh chỉ rất sát/)).toBeNull();
  });

  it('mốc thời gian có offset (Instant) thì BỎ dòng ngày, không in ngày sai', async () => {
    // Nếu backend đổi trường này sang `Instant`, `dinhDangNgay()` trả `null` và
    // dòng ngày biến mất — thà thiếu một dòng còn hơn in ra một ngày lệch múi giờ
    // mà người đọc không có cách nào biết là sai.
    await render(<MentorReviewItem review={danhGia({ createdAt: '2026-09-28T14:05:00Z' })} />);

    expect(screen.getByText('Ngô Bảo Châu')).toBeTruthy();
    expect(screen.queryByText('28/09/2026')).toBeNull();
    expect(screen.queryByText(/Invalid|NaN/)).toBeNull();
  });

  it('ngày KHÔNG lệch khi mốc sát nửa đêm', async () => {
    // `new Date('2026-09-28T23:30:00')` đọc thành giờ địa phương, nên ở múi giờ
    // âm nó ra 29/09: cùng một dữ liệu backend, hai ngày trên hai điện thoại.
    await render(<MentorReviewItem review={danhGia({ createdAt: '2026-09-28T23:30:00' })} />);

    expect(screen.getByText('28/09/2026')).toBeTruthy();
    expect(screen.queryByText('29/09/2026')).toBeNull();
  });
});
