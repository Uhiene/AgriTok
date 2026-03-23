/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          dark: '#0D2B1E',
          mid: '#1A5C38',
        },
        accent: {
          green: '#52C97C',
        },
        gold: '#F5C842',
        cream: '#F6F2E8',
        text: {
          dark: '#0D2B1E',
          muted: '#5A7A62',
        },
      },
      borderRadius: {
        card: '12px',
        modal: '20px',
        pill: '30px',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 16px rgba(13,43,30,0.08)',
        'card-hover': '0 4px 24px rgba(13,43,30,0.14)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-animate'),
  ],
}
