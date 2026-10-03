import { render, screen } from '@testing-library/react-native';

import { MentorServiceCard } from '@/features/mentor/components/MentorServiceCard';
import type { MentorServiceResponse } from '@/features/mentor/types';

function dichVu(overrides: Partial<MentorServiceResponse> = {}): MentorServiceResponse {
  return {
    serviceId: 'sv1',
    mentorUserId: 'm1',
    title: 'Review CV 1:1',
    description: 'Soi từng dòng CV, chỉnh lại phần kinh nghiệm theo hướng kết quả.',
    expectedOutcome: 'Một bản CV sửa xong.',
    durationMinutes: 45,
    isFree: false,
    priceScoin: 150_000,
    isActive: true,
    maintainPostSessionChat: true,
    deliveryMode: 'ONE_TO_ONE',
    coverImageUrl: null,
    version: 1,
    // `LocalDateTime` không có offset.
    createdAt: '2026-04-01T09:00:00',
    updatedAt: '2026-08-11T15:20:00',
    ...overrides,
  };
}

describe('MentorServiceCard', () => {
  it('hiện tên, thời lượng, mô tả và giá phân cách bằng dấu chấm', async () => {
    await render(<MentorServiceCard service={dichVu()} />);

    expect(screen.getByText('Review CV 1:1')).toBeTruthy();
    expect(screen.getByText('45 phút · 1:1')).toBeTruthy();
    expect(screen.getByText(/Soi từng dòng CV/)).toBeTruthy();
    expect(screen.getByTestId('gia-sv1').props.children).toBe('150.000');
    expect(screen.getByText('S-COINS')).toBeTruthy();
  });

  it('dịch vụ miễn phí hiện "Miễn phí" và KHÔNG hiện nhãn S-COINS', async () => {
    // "0 S-COINS" cho một buổi miễn phí khiến người dùng tưởng giá đang tính sai.
    await render(<MentorServiceCard service={dichVu({ isFree: true, priceScoin: null })} />);

    expect(screen.getByTestId('gia-sv1').props.children).toBe('Miễn phí');
    expect(screen.queryByText('S-COINS')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('dịch vụ chưa báo giá nói thẳng là chưa có giá, không in ra "null"', async () => {
    // `priceScoin` khai `nullable = true` trong `MentorServiceResponse.java`, nên
    // đây là trạng thái THẬT chứ không phải dữ liệu rác.
    await render(<MentorServiceCard service={dichVu({ isFree: false, priceScoin: null })} />);

    expect(screen.getByTestId('gia-sv1').props.children).toBe('Chưa có giá');
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('chỉ nói "Giữ chat sau buổi học" khi dịch vụ BẬT nó', async () => {
    const { unmount } = await render(<MentorServiceCard service={dichVu()} />);
    expect(screen.getByText('Giữ chat sau buổi học')).toBeTruthy();
    await unmount();

    await render(<MentorServiceCard service={dichVu({ maintainPostSessionChat: false })} />);

    expect(screen.queryByText('Giữ chat sau buổi học')).toBeNull();
  });

  it('thẻ KHÔNG bấm được và KHÔNG có nút đặt lịch — màn Booking chưa dựng', async () => {
    // Một ô bấm được mà không đi đâu là nút chết. Và `Pressable disabled` vẫn giữ
    // role "button", nên trình đọc màn hình sẽ đọc "nút" cho một thứ không làm gì
    // — vì vậy thẻ này là `View` thuần, không phải Pressable bị tắt.
    await render(<MentorServiceCard service={dichVu()} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Đặt lịch/)).toBeNull();
  });
});
