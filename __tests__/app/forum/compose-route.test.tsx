import { render } from '@testing-library/react-native';
import React from 'react';

/**
 * Route `app/forum/compose.tsx` chỉ làm một việc: đọc `postId` từ tham số và
 * đưa xuống `ComposeScreen`. Việc đó nhỏ nhưng hỏng thì im lặng: tên tham số
 * lệch một chữ là chế độ SỬA âm thầm rơi về chế độ TẠO MỚI, người dùng bấm "Lưu
 * thay đổi" và thực ra đăng một bài mới trùng nội dung — mà backend chặn trùng
 * trong 15 phút bằng 429, nên họ còn không hiểu vì sao hỏng.
 *
 * Không test nào khác import `app/forum/`, nên nếu đây không canh thì không ai canh.
 */
const mockParams: { postId?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
}));

const postIdDaNhan: (string | undefined)[] = [];
jest.mock('@/features/forum', () => ({
  ComposeScreen: ({ postId }: { postId?: string }) => {
    postIdDaNhan.push(postId);
    return null;
  },
}));

import ComposeRoute from '@/app/forum/compose';

beforeEach(() => {
  postIdDaNhan.length = 0;
  delete mockParams.postId;
});

describe('route app/forum/compose.tsx', () => {
  it('mở kèm postId thì chuyển nguyên vẹn xuống màn hình', async () => {
    mockParams.postId = 'p1';

    await render(<ComposeRoute />);

    expect(postIdDaNhan).toEqual(['p1']);
  });

  it('mở không kèm tham số thì là chế độ tạo mới, KHÔNG phải chuỗi rỗng', async () => {
    // `''` và `undefined` không giống nhau: `ComposeScreen` phân biệt hai chế độ
    // bằng chính giá trị này.
    await render(<ComposeRoute />);

    expect(postIdDaNhan).toEqual([undefined]);
  });
});
