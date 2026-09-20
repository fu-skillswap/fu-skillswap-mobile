/**
 * @file theme.test.ts
 * @description Kiểm tra design token trong `core/ui/theme.ts`:
 * (A) giá trị token khớp 1:1 với FE web (`styles/globals.css`) — kiểm tra
 * đủ mọi entry của `colors`, `radius`, `controlHeight`, không bỏ sót;
 * (B) từng key của `tailwind.config.js` gắn đúng vào đúng token NativeWind
 * tương ứng — qua một ánh xạ tường minh, để một key bị đổi tên, bị gán
 * nhầm giá trị, hoặc bị bỏ sót đều làm test này fail.
 */

import { colors, controlHeight, radius } from '@/core/ui/theme';

/** Phần `theme.extend` của tailwind.config.js mà test này cần đọc. */
interface TailwindThemeExtend {
  colors: {
    primary: { DEFAULT: string; hover: string; light: string; border: string };
    'text-main': string;
    'text-secondary': string;
    'text-muted': string;
    'text-disabled': string;
    'text-subtle': string;
    'border-color': string;
    'border-strong': string;
    'border-light': string;
    surface: { DEFAULT: string; subtle: string };
    bg: string;
    success: { DEFAULT: string; soft: string };
    warning: { DEFAULT: string; soft: string };
    danger: { DEFAULT: string; soft: string };
  };
  borderRadius: { sm: string; md: string; lg: string; full: string };
  height: { 'control-sm': string; 'control-md': string; 'control-lg': string };
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
  it('giữ đúng giá trị token của FE web (styles/globals.css)', () => {
    expect(colors).toEqual({
      primary: '#0095f6',
      primaryHover: '#0088e2',
      primaryLight: '#eff6ff',
      primaryBorder: '#93c5fd',

      textMain: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      textDisabled: '#94a3b8',
      textSubtle: '#8e8e8e',

      borderColor: '#e2e8f0',
      borderStrong: '#cbd5e1',
      borderLight: '#f1f5f9',

      surface: '#ffffff',
      surfaceSubtle: '#f8fafc',
      bg: '#f8fafc',

      success: '#10b981',
      successSoft: '#ecfdf5',
      warning: '#f59e0b',
      warningSoft: '#fffbeb',
      danger: '#ef4444',
      dangerSoft: '#fef2f2',
    });
    expect(radius).toEqual({ sm: 6, md: 8, lg: 12, full: 9999 });
    expect(controlHeight).toEqual({ sm: 32, md: 38, lg: 44 });
  });

  it('mỗi key trong tailwind.config.js gắn đúng vào đúng token màu tương ứng', () => {
    // Ánh xạ tường minh key theme.ts -> đường dẫn màu trong tailwind.config.js.
    // Nếu key trong tailwind.config.js bị đổi tên, bị gán nhầm giá trị, hoặc bị
    // xoá thì việc đọc thuộc tính dưới đây sẽ ra `undefined`, khiến assertion fail.
    const expectedFromTailwind: Record<keyof typeof colors, string | undefined> = {
      primary: tailwindColors.primary.DEFAULT,
      primaryHover: tailwindColors.primary.hover,
      primaryLight: tailwindColors.primary.light,
      primaryBorder: tailwindColors.primary.border,
      textMain: tailwindColors['text-main'],
      textSecondary: tailwindColors['text-secondary'],
      textMuted: tailwindColors['text-muted'],
      textDisabled: tailwindColors['text-disabled'],
      textSubtle: tailwindColors['text-subtle'],
      borderColor: tailwindColors['border-color'],
      borderStrong: tailwindColors['border-strong'],
      borderLight: tailwindColors['border-light'],
      surface: tailwindColors.surface.DEFAULT,
      surfaceSubtle: tailwindColors.surface.subtle,
      bg: tailwindColors.bg,
      success: tailwindColors.success.DEFAULT,
      successSoft: tailwindColors.success.soft,
      warning: tailwindColors.warning.DEFAULT,
      warningSoft: tailwindColors.warning.soft,
      danger: tailwindColors.danger.DEFAULT,
      dangerSoft: tailwindColors.danger.soft,
    };

    // Ánh xạ phải bao phủ đủ mọi key của `colors` — thêm token mới vào theme.ts
    // mà quên nối dây sang tailwind.config.js phải làm test này fail.
    expect(Object.keys(expectedFromTailwind).sort()).toEqual(Object.keys(colors).sort());

    for (const key of Object.keys(colors) as Array<keyof typeof colors>) {
      expect(expectedFromTailwind[key]).toBe(colors[key]);
    }
  });

  it('mỗi key trong tailwind.config.js gắn đúng đơn vị px cho radius và controlHeight', () => {
    const expectedRadiusFromTailwind: Record<keyof typeof radius, string | undefined> = {
      sm: tailwindRadius.sm,
      md: tailwindRadius.md,
      lg: tailwindRadius.lg,
      full: tailwindRadius.full,
    };

    expect(Object.keys(expectedRadiusFromTailwind).sort()).toEqual(Object.keys(radius).sort());

    for (const key of Object.keys(radius) as Array<keyof typeof radius>) {
      expect(expectedRadiusFromTailwind[key]).toBe(`${radius[key]}px`);
    }

    const expectedControlHeightFromTailwind: Record<keyof typeof controlHeight, string | undefined> = {
      sm: tailwindHeight['control-sm'],
      md: tailwindHeight['control-md'],
      lg: tailwindHeight['control-lg'],
    };

    expect(Object.keys(expectedControlHeightFromTailwind).sort()).toEqual(
      Object.keys(controlHeight).sort(),
    );

    for (const key of Object.keys(controlHeight) as Array<keyof typeof controlHeight>) {
      expect(expectedControlHeightFromTailwind[key]).toBe(`${controlHeight[key]}px`);
    }
  });
});
