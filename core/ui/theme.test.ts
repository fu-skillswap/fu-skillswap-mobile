/**
 * @file theme.test.ts
 * @description Kiểm tra design token trong `core/ui/theme.ts`:
 * (A) giá trị token khớp 1:1 với `mobile-design-handoff/tokens.json` — kiểm đủ
 * mọi entry của `colors`, `radius`, `controlHeight`, không bỏ sót;
 * (B) từng key gắn đúng vào đúng token NativeWind tương ứng trong
 * `tailwind.config.js`, qua một ánh xạ TƯỜNG MINH: một key bị đổi tên, gán nhầm
 * giá trị, hay bỏ sót đều làm test này đỏ.
 *
 * Bất biến quan trọng nhất ở đây là phép so `Object.keys(...)`: thêm token vào
 * `theme.ts` mà quên nối sang `tailwind.config.js` sẽ làm test đỏ. Hai nguồn
 * token lệch nhau là cách êm ái nhất để giao diện trôi khỏi thiết kế.
 */

import { colors, controlHeight, radius } from '@/core/ui/theme';

/** Phần `theme.extend` của tailwind.config.js mà test này cần đọc. */
interface TailwindThemeExtend {
  colors: Record<string, string>;
  borderRadius: Record<string, string>;
  height: Record<string, string>;
}

interface TailwindConfigModule {
  theme: { extend: TailwindThemeExtend };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires -- cần require để đọc config CommonJS ngay trong lúc test chạy
const tailwindConfig = require('../../tailwind.config.js') as TailwindConfigModule;
const tailwindColors = tailwindConfig.theme.extend.colors;
const tailwindRadius = tailwindConfig.theme.extend.borderRadius;
const tailwindHeight = tailwindConfig.theme.extend.height;

describe('design token', () => {
  it('giữ đúng giá trị của mobile-design-handoff/tokens.json', () => {
    expect(colors).toEqual({
      primaryBlue: '#2F6BFF',
      brandBlue: '#119CF7',
      skyBlue: '#56D1FF',
      navy: '#0F2D6B',
      lightBlue: '#EBF3FF',
      white: '#FFFFFF',

      surfacePage: '#F4F7FD',
      surface: '#FFFFFF',
      surfaceTint: '#EBF3FF',
      brandDeep: '#0F2D6B',

      ink: '#0F2D6B',
      inkBody: '#3D4F75',
      inkMuted: '#5A6A8C',
      inkOnDeep: '#B8C7E6',

      line: '#DCE6FA',
      accent: '#2F6BFF',
      accentStrong: '#1A47D6',
      onAccent: '#FFFFFF',

      success: '#22C55E',
      successInk: '#15803D',
      successSoft: '#DCFCE7',
      warning: '#F59E0B',
      warningInk: '#B45309',
      warningSoft: '#FEF3C7',
      danger: '#B42318',
      dangerSoft: '#FEE4E2',
      neutralSoft: '#EEF2FA',
    });
    expect(radius).toEqual({ sm: 8, md: 16, lg: 24, input: 12, full: 9999 });
    expect(controlHeight).toEqual({ input: 48, md: 44, lg: 52, tabBar: 84 });
  });

  it('mỗi key màu trong theme.ts gắn đúng vào đúng token tailwind tương ứng', () => {
    const expectedFromTailwind: Record<keyof typeof colors, string | undefined> = {
      primaryBlue: tailwindColors['primary-blue'],
      brandBlue: tailwindColors['brand-blue'],
      skyBlue: tailwindColors['sky-blue'],
      navy: tailwindColors.navy,
      lightBlue: tailwindColors['light-blue'],
      white: tailwindColors.white,
      surfacePage: tailwindColors['surface-page'],
      surface: tailwindColors.surface,
      surfaceTint: tailwindColors['surface-tint'],
      brandDeep: tailwindColors['brand-deep'],
      ink: tailwindColors.ink,
      inkBody: tailwindColors['ink-body'],
      inkMuted: tailwindColors['ink-muted'],
      inkOnDeep: tailwindColors['ink-on-deep'],
      line: tailwindColors.line,
      accent: tailwindColors.accent,
      accentStrong: tailwindColors['accent-strong'],
      onAccent: tailwindColors['on-accent'],
      success: tailwindColors.success,
      successInk: tailwindColors['success-ink'],
      successSoft: tailwindColors['success-soft'],
      warning: tailwindColors.warning,
      warningInk: tailwindColors['warning-ink'],
      warningSoft: tailwindColors['warning-soft'],
      danger: tailwindColors.danger,
      dangerSoft: tailwindColors['danger-soft'],
      neutralSoft: tailwindColors['neutral-soft'],
    };

    // Ánh xạ phải bao phủ ĐỦ mọi key của `colors` — thêm token mới vào theme.ts
    // mà quên nối dây sang tailwind.config.js phải làm test này đỏ.
    expect(Object.keys(expectedFromTailwind).sort()).toEqual(Object.keys(colors).sort());

    for (const key of Object.keys(colors) as Array<keyof typeof colors>) {
      expect(expectedFromTailwind[key]).toBe(colors[key]);
    }
  });

  it('mỗi key radius và controlHeight gắn đúng đơn vị px trong tailwind', () => {
    const expectedRadiusFromTailwind: Record<keyof typeof radius, string | undefined> = {
      sm: tailwindRadius.sm,
      md: tailwindRadius.md,
      lg: tailwindRadius.lg,
      input: tailwindRadius.input,
      full: tailwindRadius.full,
    };

    expect(Object.keys(expectedRadiusFromTailwind).sort()).toEqual(Object.keys(radius).sort());

    for (const key of Object.keys(radius) as Array<keyof typeof radius>) {
      expect(expectedRadiusFromTailwind[key]).toBe(`${radius[key]}px`);
    }

    const expectedHeightFromTailwind: Record<keyof typeof controlHeight, string | undefined> = {
      input: tailwindHeight['control-input'],
      md: tailwindHeight['control-md'],
      lg: tailwindHeight['control-lg'],
      tabBar: tailwindHeight.tabbar,
    };

    expect(Object.keys(expectedHeightFromTailwind).sort()).toEqual(
      Object.keys(controlHeight).sort(),
    );

    for (const key of Object.keys(controlHeight) as Array<keyof typeof controlHeight>) {
      expect(expectedHeightFromTailwind[key]).toBe(`${controlHeight[key]}px`);
    }
  });
});
