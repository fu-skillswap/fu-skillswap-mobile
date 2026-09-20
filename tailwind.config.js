/** @type {import('tailwindcss').Config} */
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
        primary: {
          DEFAULT: '#0095f6',
          hover: '#0088e2',
          light: '#eff6ff',
          border: '#93c5fd',
        },
        'text-main': '#0f172a',
        'text-secondary': '#475569',
        'text-muted': '#64748b',
        'text-disabled': '#94a3b8',
        'text-subtle': '#8e8e8e',
        'border-color': '#e2e8f0',
        'border-strong': '#cbd5e1',
        'border-light': '#f1f5f9',
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
        },
        bg: '#f8fafc',
        success: {
          DEFAULT: '#10b981',
          soft: '#ecfdf5',
        },
        warning: {
          DEFAULT: '#f59e0b',
          soft: '#fffbeb',
        },
        danger: {
          DEFAULT: '#ef4444',
          soft: '#fef2f2',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
      },
      height: {
        'control-sm': '32px',
        'control-md': '38px',
        'control-lg': '44px',
      },
    },
  },
  plugins: [],
};
