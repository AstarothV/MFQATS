// Theme colours are CSS variables (src/styles/tailwind.css), so light and dark can swap them. color-mix lets Tailwind's
// opacity modifiers work on them (bg-primary/10, bg-muted/50); without it those classes rendered as nothing.
const themed = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: themed('background'),
        foreground: themed('foreground'),
        primary: {
          DEFAULT: themed('primary'),
          foreground: themed('primary-foreground'),
        },
        secondary: {
          DEFAULT: themed('secondary'),
          foreground: themed('secondary-foreground'),
        },
        accent: {
          DEFAULT: themed('accent'),
          foreground: themed('accent-foreground'),
        },
        muted: {
          DEFAULT: themed('muted'),
          foreground: themed('muted-foreground'),
        },
        card: {
          DEFAULT: themed('card'),
          foreground: themed('card-foreground'),
        },
        border: themed('border'),
        input: themed('input'),
        ring: themed('ring'),
        success: themed('success'),
        warning: themed('warning'),
        danger: themed('danger'),
        info: themed('info'),
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
        md: 'var(--radius)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 8px)',
        '2xl': 'calc(var(--radius) + 12px)',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease forwards',
        'slide-up': 'slideUp 250ms ease forwards',
        'pulse-subtle': 'pulseSub 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};