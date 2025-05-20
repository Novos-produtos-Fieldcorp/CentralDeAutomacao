/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--background)',
          light: 'var(--background-light)',
          lighter: 'var(--background-lighter)'
        },
        card: {
          DEFAULT: 'var(--card)',
          hover: 'var(--card-hover)',
          border: 'var(--card-border)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)'
        },
        primary: {
          DEFAULT: '#0066FF',
          dark: '#0052CC',
          light: '#3385FF',
          lighter: '#66A3FF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem'
      },
      boxShadow: {
        card: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)'
      }
    },
  },
  plugins: [],
};
