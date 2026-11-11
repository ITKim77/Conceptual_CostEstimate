/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SSOT Data Rules
        'ssot-input': {
          DEFAULT: '#EF4444', // Red (단일 위치 입력)
          light: '#FEE2E2',
          border: '#DC2626'
        },
        'ssot-calc': {
          DEFAULT: '#3B82F6', // Blue (연산/인용 파생)
          light: '#DBEAFE',
          border: '#2563EB'
        },
        'ssot-const': {
          DEFAULT: '#111827', // Black/Dark (상수/가정)
          light: '#F3F4F6'
        }
      }
    },
  },
  plugins: [],
}
