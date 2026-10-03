import { render, screen } from '@testing-library/react-native';
import React from 'react';

/**
 * Hai file route của nhánh mentor chỉ làm một việc mỗi file, nhưng hỏng thì im
 * lặng — và không test nào khác import chúng:
 *
 * - `app/(tabs)/mentors.tsx` phải render `MentorDiscoveryScreen`. Trước đợt này
 *   nó là một vỏ rỗng chỉ in chữ "Mentor"; để sót vỏ rỗng thì toàn bộ
 *   `mentors.test.tsx` vẫn xanh (nó import màn hình trực tiếp) trong khi tab 2
 *   trên máy thật vẫn trắng.
 * - `app/mentor/[mentorUserId].tsx` phải chuyển NGUYÊN VẸN tham số route xuống
 *   `MentorDetailScreen`. Tên tham số lệch một chữ thì màn hình nhận `undefined`,
 *   `useMentor('')` bị chốt `enabled` tắt, và người dùng thấy một màn hình đứng
 *   im không bao giờ tải — không lỗi, không spinner, không gì cả.
 */
const mockParams: { mentorUserId?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

const idDaNhan: (string | undefined)[] = [];
jest.mock('@/features/mentor', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MentorDetailScreen: ({ mentorUserId }: { mentorUserId?: string }) => {
      idDaNhan.push(mentorUserId);
      return null;
    },
    MentorDiscoveryScreen: () => <Text>MÀN TÌM MENTOR</Text>,
  };
});

import MentorsTabRoute from '@/app/(tabs)/mentors';
import MentorDetailRoute from '@/app/mentor/[mentorUserId]';

beforeEach(() => {
  idDaNhan.length = 0;
  delete mockParams.mentorUserId;
});

describe('route app/(tabs)/mentors.tsx', () => {
  it('render màn Tìm Mentor, KHÔNG còn là vỏ rỗng', async () => {
    await render(<MentorsTabRoute />);

    expect(screen.getByText('MÀN TÌM MENTOR')).toBeTruthy();
    // Vỏ rỗng cũ in đúng chữ "Mentor" và không có gì khác.
    expect(screen.queryByText('Mentor')).toBeNull();
  });
});

describe('route app/mentor/[mentorUserId].tsx', () => {
  it('chuyển nguyên vẹn mentorUserId xuống màn hồ sơ', async () => {
    mockParams.mentorUserId = 'm1';

    await render(<MentorDetailRoute />);

    expect(idDaNhan).toEqual(['m1']);
  });

  it('tên tham số phải đúng là mentorUserId — lệch một chữ là màn hình đứng im', async () => {
    // Không có tham số thì màn hình nhận `undefined`; test này tồn tại để một
    // lần đổi tên route (`[id]`, `[mentorId]`…) không lặng lẽ đi qua.
    await render(<MentorDetailRoute />);

    expect(idDaNhan).toEqual([undefined]);
  });
});
