/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#0a0002',
          surface: '#140004',
          elevated: '#24000b',
          accent: '#d40021',
          cyan: '#ff1a3c',
          text: '#f8f8f2',
          subtext: '#fecdd3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
  plugins: [],
}
