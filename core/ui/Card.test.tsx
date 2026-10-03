import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '@/core/ui/Card';

describe('Card', () => {
  it('dựng nội dung con', async () => {
    await render(
      <Card>
        <Text>Mentor nổi bật</Text>
      </Card>,
    );

    expect(screen.getByText('Mentor nổi bật')).toBeTruthy();
  });

  it('mặc định có padding 16 theo thiết kế', async () => {
    await render(
      <Card testID="the">
        <Text>Nội dung</Text>
      </Card>,
    );

    const style = screen.getByTestId('the').props.style as { padding?: number }[];
    const padding = (Array.isArray(style) ? style : [style]).reduce<number | undefined>(
      (p, lop) => lop?.padding ?? p,
      undefined,
    );

    expect(padding).toBe(16);
  });

  it('flush thì bỏ padding để ListRow chạm sát mép', async () => {
    await render(
      <Card flush testID="the">
        <Text>Nội dung</Text>
      </Card>,
    );

    const style = screen.getByTestId('the').props.style as { padding?: number }[];
    const padding = (Array.isArray(style) ? style : [style]).reduce<number | undefined>(
      (p, lop) => lop?.padding ?? p,
      undefined,
    );

    expect(padding).toBeUndefined();
    expect(String(screen.getByTestId('the').props.className)).toContain('overflow-hidden');
  });

  it('elevated chỉ thêm bóng cho card trắng, không thêm cho nền navy', async () => {
    const { unmount } = await render(
      <Card elevated testID="the">
        <Text>Nội dung</Text>
      </Card>,
    );
    const coBong = (screen.getByTestId('the').props.style as { shadowOpacity?: number }[]).some(
      (lop) => lop?.shadowOpacity !== undefined,
    );
    expect(coBong).toBe(true);
    await unmount();

    await render(
      <Card elevated tone="navy" testID="the">
        <Text>Nội dung</Text>
      </Card>,
    );
    const bongNavy = (screen.getByTestId('the').props.style as { shadowOpacity?: number }[]).some(
      (lop) => lop?.shadowOpacity !== undefined,
    );
    expect(bongNavy).toBe(false);
  });

  it('mỗi tone cho một lớp nền khác nhau', async () => {
    const lop: string[] = [];
    for (const tone of ['surface', 'navy', 'tint'] as const) {
      const { unmount } = await render(
        <Card tone={tone} testID="the">
          <Text>Nội dung</Text>
        </Card>,
      );
      lop.push(String(screen.getByTestId('the').props.className));
      await unmount();
    }

    expect(new Set(lop).size).toBe(3);
  });
});
