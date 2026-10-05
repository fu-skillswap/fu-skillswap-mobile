/**
 * @file theme.ts
 * @description Design token của SkillSwap Mobile ở dạng GIÁ TRỊ THÔ, port 1:1 từ
 * `mobile-design-handoff/tokens.json`.
 *
 * Dùng cho chỗ không viết được utility class: màu icon truyền qua prop, style
 * inline, `tintColor`, `screenOptions` của expo-router, thư viện biểu đồ.
 * Giao diện thông thường dùng class NativeWind **cùng tên** trong
 * `tailwind.config.js` — hai nơi phải khớp, `theme.test.ts` canh việc đó.
 *
 * Bộ token CŨ (ported từ `fu-skillswap-fe-2`, primary #0095f6, slate…) đã bị
 * thay hẳn: thiết kế mobile là một hệ riêng, không phải FE web thu nhỏ.
 */

export const colors = {
  // --- Màu thương hiệu ---
  primaryBlue: '#2F6BFF',
  brandBlue: '#119CF7',
  skyBlue: '#56D1FF',
  navy: '#0F2D6B',
  lightBlue: '#EBF3FF',
  white: '#FFFFFF',

  // --- Màu ngữ nghĩa ---
  surfacePage: '#F4F7FD',
  surface: '#FFFFFF',
  surfaceTint: '#EBF3FF',
  brandDeep: '#0F2D6B',

  /** Tiêu đề và chữ nhấn */
  ink: '#0F2D6B',
  /** Nội dung */
  inkBody: '#3D4F75',
  /** Chú thích */
  inkMuted: '#5A6A8C',
  /** Chữ phụ trên nền navy — chỉ dùng trên `brandDeep` */
  inkOnDeep: '#B8C7E6',

  /** Viền 1px và divider */
  line: '#DCE6FA',
  accent: '#2F6BFF',
  /** Đầu tối của gradient nút chính */
  accentStrong: '#1A47D6',
  onAccent: '#FFFFFF',

  success: '#22C55E',
  successInk: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningInk: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B42318',
  /**
   * Nền cho khối lỗi. KHÔNG có trong `tokens.json` — do tôi chọn, chủ sản phẩm
   * uỷ quyền ngày 05/10/2026.
   *
   * Thiết kế có cặp `success`/`success-soft` và `warning`/`warning-soft` nhưng
   * bỏ trống bạn của `danger`. Chọn theo đúng quy luật của hai cặp kia (một
   * tint rất nhạt cùng tông) và đo tương phản thật:
   *
   *   #15803D trên #DCFCE7 = 4,57:1   (success, có sẵn)
   *   #B45309 trên #FEF3C7 = 4,51:1   (warning, có sẵn)
   *   #B42318 trên #FEE4E2 = 5,45:1   (danger, chọn ở đây)
   *
   * Hai cặp có sẵn nằm SÁT ngưỡng AA 4,5:1, nên bản này cố ý lấy dư biên để
   * không trượt chuẩn khi ai đó chỉnh nhẹ màu chữ. Nếu bên thiết kế bổ sung
   * token thật vào `tokens.json` thì thay giá trị ở đây cho khớp.
   */
  dangerSoft: '#FEE4E2',
  neutralSoft: '#EEF2FA',
} as const;

/** Hai điểm dừng của gradient nút chính, theo thứ tự 0% → 100% */
export const gradientButton = ['#1A47D6', '#2F6BFF'] as const;

/**
 * Bóng đổ. React Native không nhận chuỗi CSS, nên đây là bản dịch sang prop RN.
 * `shadowColor`/`shadowOpacity` cho iOS, `elevation` cho Android.
 */
export const shadows = {
  /** `0 8px 32px rgba(15,45,107,0.06)` — card trắng trên nền trang */
  card: {
    shadowColor: '#0F2D6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 3,
  },
  /** `0 8px 20px rgba(47,107,255,0.30)` — nút chính */
  button: {
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
} as const;

/** Bo góc, đơn vị px */
export const radius = { sm: 8, md: 16, lg: 24, input: 12, full: 9999 } as const;

/** Chiều cao control, đơn vị px */
export const controlHeight = {
  /** Ô nhập */
  input: 48,
  /** Nút phụ, nút tròn trên header */
  md: 44,
  /** Nút chính */
  lg: 52,
  /** Thanh tab dưới cùng */
  tabBar: 84,
} as const;

/** Khoảng cách, đơn vị px */
export const spacing = {
  /** Lề hai bên màn hình */
  gutter: 20,
  /** Padding trong card */
  card: 16,
  /** Vùng chạm tối thiểu */
  touch: 44,
} as const;

/**
 * Tên font đã nạp trong `app/_layout.tsx`.
 *
 * React Native trên Android KHÔNG suy ra được nét đậm từ `fontWeight` với font
 * tuỳ biến — phải chỉ đúng tên file của từng nét, nếu không mọi thứ đều ra nét
 * thường. Vì vậy dùng `fonts.bold` chứ đừng dùng `fontWeight: '700'`.
 */
export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
} as const;
