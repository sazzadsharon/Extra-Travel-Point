/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0284c7',
          700: '#0369a1',
        },
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bfdbfe',
          300: '#bfdbfe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#0284c7',
          700: '#0369a1',
        },
        emerald: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
        },
        amber: {
          500: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}