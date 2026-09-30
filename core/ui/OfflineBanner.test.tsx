import { render, screen } from '@testing-library/react-native';

import { OfflineBanner } from '@/core/ui/OfflineBanner';

jest.mock('@/core/net/onlineStatus', () => ({
  useIsOffline: jest.fn(),
}));

const { useIsOffline } = jest.requireMock('@/core/net/onlineStatus');

describe('OfflineBanner', () => {
  it('đang mất mạng thì hiện banner', async () => {
    useIsOffline.mockReturnValue(true);

    await render(<OfflineBanner />);

    expect(screen.getByText('Không có kết nối')).toBeTruthy();
  });

  it('có mạng thì không render gì', async () => {
    useIsOffline.mockReturnValue(false);

    await render(<OfflineBanner />);

    expect(screen.queryByText('Không có kết nối')).toBeNull();
  });
});
