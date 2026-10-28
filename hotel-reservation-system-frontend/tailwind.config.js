/** @type {import('tailwindcss').Config} */
// Los valores viven en src/index.css como variables CSS; aquí solo se exponen a
// Tailwind para que las utilidades (bg-brand-600, shadow-card, ease-out…) sean
// la única manera de usarlos.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        ink: {
          25: 'rgb(var(--ink-25) / <alpha-value>)',
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        success: { 50: 'rgb(var(--success-50) / <alpha-value>)', 200: 'rgb(var(--success-200) / <alpha-value>)', 600: 'rgb(var(--success-600) / <alpha-value>)', 700: 'rgb(var(--success-700) / <alpha-value>)' },
        danger: { 50: 'rgb(var(--danger-50) / <alpha-value>)', 200: 'rgb(var(--danger-200) / <alpha-value>)', 600: 'rgb(var(--danger-600) / <alpha-value>)', 700: 'rgb(var(--danger-700) / <alpha-value>)' },
        warning: { 50: 'rgb(var(--warning-50) / <alpha-value>)', 200: 'rgb(var(--warning-200) / <alpha-value>)', 700: 'rgb(var(--warning-700) / <alpha-value>)' },
        info: { 50: 'rgb(var(--info-50) / <alpha-value>)', 200: 'rgb(var(--info-200) / <alpha-value>)', 700: 'rgb(var(--info-700) / <alpha-value>)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display-sm': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md': ['2.75rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },
      maxWidth: { page: '80rem' },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        // Sombras en capas: una de contacto y una difusa, como la luz real.
        card: '0 1px 2px rgb(27 25 23 / 0.04), 0 1px 3px rgb(27 25 23 / 0.06)',
        lift: '0 2px 4px rgb(27 25 23 / 0.04), 0 12px 24px -8px rgb(27 25 23 / 0.14)',
        popover: '0 4px 8px rgb(27 25 23 / 0.06), 0 24px 48px -12px rgb(27 25 23 / 0.22)',
        header: '0 1px 0 rgb(27 25 23 / 0.06)',
      },
      transitionTimingFunction: {
        'out-strong': 'var(--ease-out)',
        'in-out-strong': 'var(--ease-in-out)',
        drawer: 'var(--ease-drawer)',
      },
      transitionDuration: { 160: '160ms', 220: '220ms' },
      keyframes: {
        'enter-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'panel-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        shimmer: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(100%)' } },
      },
      animation: {
        'enter-up': 'enter-up 340ms var(--ease-out) backwards',
        'fade-in': 'fade-in 200ms var(--ease-out) backwards',
        'panel-in': 'panel-in 220ms var(--ease-out) backwards',
        'sheet-in': 'sheet-in 320ms var(--ease-drawer) backwards',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
