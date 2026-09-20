/**
 * @file theme.ts
 * @description Design token port 1:1 từ `fu-skillswap-fe-2/src/styles/globals.css`.
 * Dùng cho code cần giá trị thô (style inline, màu icon, thư viện biểu đồ);
 * phần giao diện thông thường dùng utility class NativeWind cùng tên.
 */

export const colors = {
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
} as const;

/** Bo góc, đơn vị px — tương ứng --ui-radius-* của FE web */
export const radius = { sm: 6, md: 8, lg: 12, full: 9999 } as const;

/** Chiều cao control, đơn vị px — tương ứng --ui-height-* của FE web */
export const controlHeight = { sm: 32, md: 38, lg: 44 } as const;
