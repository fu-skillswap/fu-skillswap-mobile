import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors, controlHeight, radius } from '@/core/ui/theme';

describe('design token', () => {
  it('giữ đúng giá trị token của FE web (styles/globals.css)', () => {
    expect(colors.primary).toBe('#0095f6');
    expect(colors.primaryHover).toBe('#0088e2');
    expect(colors.primaryLight).toBe('#eff6ff');
    expect(colors.primaryBorder).toBe('#93c5fd');
    expect(colors.textMain).toBe('#0f172a');
    expect(colors.textSecondary).toBe('#475569');
    expect(colors.textMuted).toBe('#64748b');
    expect(colors.borderColor).toBe('#e2e8f0');
    expect(colors.surface).toBe('#ffffff');
    expect(colors.bg).toBe('#f8fafc');
    expect(colors.success).toBe('#10b981');
    expect(colors.warning).toBe('#f59e0b');
    expect(colors.danger).toBe('#ef4444');
    expect(radius).toEqual({ sm: 6, md: 8, lg: 12, full: 9999 });
    expect(controlHeight).toEqual({ sm: 32, md: 38, lg: 44 });
  });

  it('tailwind.config.js khai báo đủ mọi màu trong theme.ts', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'tailwind.config.js'), 'utf8');

    for (const hex of Object.values(colors)) {
      expect(config).toContain(hex);
    }
  });
});
