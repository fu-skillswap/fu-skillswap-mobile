import { fireEvent, render, screen } from '@testing-library/react-native';

import { MentorCard } from '@/features/mentor/components/MentorCard';
import type { MentorDiscoveryCardResponse } from '@/features/mentor/types';

function mentor(
  overrides: Partial<MentorDiscoveryCardResponse> = {},
): MentorDiscoveryCardResponse {
  return {
    identity: {
      mentorUserId: 'm1',
      displayName: 'Trần Minh Quân',
      avatarUrl: null,
      headline: 'Backend engineer, 2 năm Spring Boot',
      isVerified: true,
      // `LocalDateTime` không có offset — đúng như backend lên dây.
      verifiedAt: '2026-05-01T09:00:00',
    },
    mentoring: {
      expertiseDescription: 'Spring Boot, SQL, kiến trúc service',
      foundationSupportLevel: 4,
      outputReviewSupportLevel: 3,
      directionSupportLevel: 2,
    },
    evidence: {
      campusId: 'c1',
      campusName: 'FPT University Hà Nội',
      programId: 'p1',
      programName: 'Công nghệ thông tin',
      specializationId: 's1',
      specializationName: 'Kỹ thuật phần mềm',
      subjectHighlights: [
        {
          id: 'sh1',
          subjectCode: 'PRJ301',
          subjectName: 'Java Web Application Development',
          scoreValue: 9.2,
          displayOrder: 1,
        },
      ],
      featuredProjects: [],
      achievements: [],
    },
    reputation: {
      ratingState: 'RATED',
      ratingAverage: 4.6,
      reviewCount: 12,
      completedSessions: 30,
    },
    availability: { isAvailable: true },
    match: { score: 95.5 },
    ...overrides,
  };
}

describe('MentorCard', () => {
  it('hiện tên, headline, mã môn nổi bật và số buổi đã dạy', async () => {
    await render(<MentorCard mentor={mentor()} onPress={jest.fn()} />);

    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    expect(screen.getByText('Backend engineer, 2 năm Spring Boot')).toBeTruthy();
    expect(screen.getByText('PRJ301')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('mentor đã có đánh giá thì hiện điểm và số lượt', async () => {
    await render(<MentorCard mentor={mentor()} onPress={jest.fn()} />);

    expect(screen.getByTestId('diem-danh-gia-diem').props.children).toBe('4.6');
    expect(screen.getByText('(12 đánh giá)')).toBeTruthy();
  });

  it('CHƯA có đánh giá thì hiện "Chưa có đánh giá", KHÔNG hiện số sao nào', async () => {
    // Luật của `mentor-discovery.md` §2 và là chỗ dễ nói dối người dùng nhất:
    // mentor mới hiện 5 sao là bịa ra uy tín.
    await render(
      <MentorCard
        mentor={mentor({
          reputation: {
            ratingState: 'NO_REVIEWS',
            ratingAverage: null,
            reviewCount: 0,
            completedSessions: 0,
          },
        })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
    expect(screen.queryByTestId('diem-danh-gia-diem')).toBeNull();
    expect(screen.queryByText('5.0')).toBeNull();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('render ĐỦ khi match.score là null — thẻ không được phụ thuộc điểm khớp', async () => {
    // §2: `score` có thể null, nhất là khi sort khác `relevance`. Thẻ phải hiện
    // nguyên vẹn, không chỉ là "không nổ".
    await render(<MentorCard mentor={mentor({ match: { score: null } })} onPress={jest.fn()} />);

    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    expect(screen.getByText('PRJ301')).toBeTruthy();
    expect(screen.getByTestId('diem-danh-gia-diem')).toBeTruthy();
    expect(screen.getByTestId('tinh-trang-nhan-hoc')).toBeTruthy();
  });

  it('headline null thì tụt về mô tả chuyên môn, KHÔNG để dòng trống', async () => {
    await render(
      <MentorCard
        mentor={mentor({
          identity: { ...mentor().identity, headline: null },
        })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Spring Boot, SQL, kiến trúc service')).toBeTruthy();
  });

  it('không có môn nổi bật thì tụt về ba mức hỗ trợ, hàng nhãn không rỗng', async () => {
    await render(
      <MentorCard
        mentor={mentor({
          evidence: { ...mentor().evidence, subjectHighlights: [] },
        })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('mon-noi-bat')).toBeNull();
    expect(screen.getByText('Nền tảng 4/4')).toBeTruthy();
  });

  it('mentor tạm không nhận học viên thì nhãn nói đúng điều đó', async () => {
    // Mời người dùng vào một mentor đang khoá nhận booking là dẫn họ tới một ngõ
    // cụt ở bước sau.
    await render(
      <MentorCard mentor={mentor({ availability: { isAvailable: false } })} onPress={jest.fn()} />,
    );

    expect(screen.getByText('Tạm không nhận')).toBeTruthy();
    expect(screen.queryByText('Đang nhận học viên')).toBeNull();
  });

  it('mentor chưa xác minh thì KHÔNG có dấu xác minh', async () => {
    await render(
      <MentorCard
        mentor={mentor({ identity: { ...mentor().identity, isVerified: false, verifiedAt: null } })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('dau-xac-minh')).toBeNull();
    expect(screen.queryByLabelText('Đã xác minh')).toBeNull();
  });

  it('có lý do gợi ý thì hiện tối đa hai lý do, không có thì bỏ hẳn khối', async () => {
    const { unmount } = await render(
      <MentorCard
        mentor={mentor()}
        onPress={jest.fn()}
        matchReasons={['Cùng chuyên ngành Kỹ thuật phần mềm', 'Được đánh giá tốt', 'Lý do thứ ba']}
      />,
    );

    expect(screen.getByText('Cùng chuyên ngành Kỹ thuật phần mềm')).toBeTruthy();
    expect(screen.getByText('Được đánh giá tốt')).toBeTruthy();
    // Thiết kế không có chỗ cho một đoạn văn trong thẻ.
    expect(screen.queryByText('Lý do thứ ba')).toBeNull();
    await unmount();

    await render(<MentorCard mentor={mentor()} onPress={jest.fn()} />);

    expect(screen.queryByTestId('ly-do-goi-y')).toBeNull();
  });

  it('bấm vào thẻ thì báo đúng mentorUserId đọc từ identity', async () => {
    // `mentorUserId` phẳng bị `@JsonIgnore` nên KHÔNG có trong JSON; đọc trượt ra
    // `undefined` mà không lỗi kiểu nào chặn, và điều hướng sẽ đi tới
    // `/mentor/undefined`.
    const onPress = jest.fn();
    await render(<MentorCard mentor={mentor()} onPress={onPress} />);

    await fireEvent.press(screen.getByLabelText('Xem hồ sơ Trần Minh Quân'));

    expect(onPress).toHaveBeenCalledWith('m1');
  });

  it('KHÔNG có nút "Đặt lịch" nào trên thẻ ở giai đoạn này', async () => {
    // Màn `Booking` chưa dựng. Thiết kế có nút gradient "Đặt lịch" ở chân thẻ;
    // dựng nó bây giờ là dựng một nút chết. Xoá test này khi luồng đặt lịch có
    // thật.
    await render(<MentorCard mentor={mentor()} onPress={jest.fn()} />);

    expect(screen.queryByText(/Đặt lịch/)).toBeNull();
  });

  it('KHÔNG hiện giá nào trên thẻ — card DTO không có giá để mà hiện', async () => {
    // Thiết kế vẽ "Từ 150.000 S-coins" ở chân thẻ, nhưng đó là dữ liệu mẫu:
    // `MentorDiscoveryCardResponse` không trả dịch vụ hay giá. Bịa một con số ở
    // đây là nói sai về tiền.
    await render(<MentorCard mentor={mentor()} onPress={jest.fn()} />);

    expect(screen.queryByText(/S-coins/i)).toBeNull();
    expect(screen.queryByText(/^Từ$/)).toBeNull();
  });
});
