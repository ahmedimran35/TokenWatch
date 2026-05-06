/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0d0d0d',
        card: '#161616',
        border: '#2a2a2a',
        accent: '#f59e0b',
        success: '#10b981',
        danger: '#ef4444',
        primary: '#f5f5f5',
        secondary: '#9ca3af',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}