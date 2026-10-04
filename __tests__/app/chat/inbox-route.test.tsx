import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

/**
 * Route `app/chat/index.tsx`: hộp thư NGOÀI thanh tab, lối duy nhất để chế độ
 * Mentor (thanh tab không có mục Tin nhắn) trả lời mentee. Test canh hai điều:
 * route nối đúng màn hình, và nút quay lại không thành no-op khi stack rỗng.
 */
jest.mock('@/features/chat', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MessagesScreen: ({ onBack }: { onBack?: () => void }) => (
      <Pressable testID="nut-quay-lai" onPress={onBack}>
        <Text>MÀN HỘP THƯ</Text>
      </Pressable>
    ),
  };
});

let mockCoTheLui = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCoTheLui }),
}));

import ChatInboxRoute from '@/app/chat/index';

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
});

describe('route app/chat/index.tsx', () => {
  it('nối màn hộp thư', async () => {
    await render(<ChatInboxRoute />);

    expect(screen.getByText('MÀN HỘP THƯ')).toBeTruthy();
  });

  it('quay lại theo stack khi có thể', async () => {
    mockCoTheLui = true;
    await render(<ChatInboxRoute />);

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('mở từ deep link (stack rỗng) thì về thanh tab thay vì đứng yên', async () => {
    mockCoTheLui = false;
    await render(<ChatInboxRoute />);

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
