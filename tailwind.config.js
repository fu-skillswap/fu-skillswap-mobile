/**
 * Design token của SkillSwap Mobile, port 1:1 từ `mobile-design-handoff/tokens.json`.
 *
 * Tên class giữ đúng tên token trong thiết kế (`ink`, `ink-body`, `line`,
 * `surface-page`, `accent`…) để đọc file `.dc.html` và viết class không phải
 * dịch qua lại. Giá trị thô cho style inline nằm ở `core/ui/theme.ts` — hai nơi
 * phải khớp nhau, `core/ui/theme.test.ts` canh việc đó.
 *
 * Chưa làm theme tối: `tokens.json` có cột `dark` nhưng app chưa có cơ chế đổi
 * theme, và dựng sẵn một nửa sẽ để lại hai bảng màu không ai kiểm. Khi làm thì
 * lấy cột `dark` trong `tokens.json`.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './core/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // --- Màu thương hiệu ---
        'primary-blue': '#2F6BFF',
        'brand-blue': '#119CF7',
        'sky-blue': '#56D1FF',
        navy: '#0F2D6B',
        'light-blue': '#EBF3FF',
        // Khai lại dù Tailwind có sẵn: `core/ui/theme.test.ts` đòi mọi token
        // trong `theme.ts` phải nối sang đây, không có ngoại lệ ngầm.
        white: '#FFFFFF',

        // --- Màu ngữ nghĩa (tên dùng trong thiết kế) ---
        'surface-page': '#F4F7FD',
        surface: '#FFFFFF',
        'surface-tint': '#EBF3FF',
        'brand-deep': '#0F2D6B',

        ink: '#0F2D6B',
        'ink-body': '#3D4F75',
        'ink-muted': '#5A6A8C',
        /** Chữ phụ trên nền navy — chỉ dùng trên `brand-deep` */
        'ink-on-deep': '#B8C7E6',

        line: '#DCE6FA',
        accent: '#2F6BFF',
        'accent-strong': '#1A47D6',
        'on-accent': '#FFFFFF',

        success: '#22C55E',
        'success-ink': '#15803D',
        'success-soft': '#DCFCE7',
        warning: '#F59E0B',
        'warning-ink': '#B45309',
        'warning-soft': '#FEF3C7',
        danger: '#B42318',
        /** Nền khối lỗi — không có trong `tokens.json`, xem JSDoc ở `core/ui/theme.ts` */
        'danger-soft': '#FEE4E2',
        'neutral-soft': '#EEF2FA',
      },
      fontFamily: {
        // Khớp tên đã nạp trong `app/_layout.tsx`.
        sans: ['Montserrat_400Regular'],
        medium: ['Montserrat_500Medium'],
        semibold: ['Montserrat_600SemiBold'],
        bold: ['Montserrat_700Bold'],
        extrabold: ['Montserrat_800ExtraBold'],
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
        lg: '24px',
        /** Ô nhập — thiết kế dùng 12, không nằm trong thang radius chung */
        input: '12px',
        full: '9999px',
      },
      spacing: {
        /** Lề hai bên màn hình */
        gutter: '20px',
      },
      height: {
        /** Ô nhập */
        'control-input': '48px',
        /** Nút phụ, chip cao */
        'control-md': '44px',
        /** Nút chính */
        'control-lg': '52px',
        /** Thanh tab dưới cùng */
        tabbar: '84px',
      },
      minHeight: {
        /** Vùng chạm tối thiểu theo guideline */
        touch: '44px',
      },
      fontSize: {
        // Thang chữ của màn hình mobile (mục 2 của HANDOFF.md).
        'tab-label': ['11px', '14px'],
        caption: ['12px', '16px'],
        'caption-lg': ['13px', '19px'],
        body: ['14px', '22px'],
        'body-lg': ['15px', '22px'],
        'section-title': ['18px', '24px'],
        'screen-title-sub': ['18px', '24px'],
        'screen-title': ['26px', '34px'],
      },
    },
  },
  plugins: [],
};
