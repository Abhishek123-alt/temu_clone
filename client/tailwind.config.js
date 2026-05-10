/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#fb7701', // Temu Orange
          dark: '#e06a01',
        },
        secondary: '#333333',
        background: '#f6f6f6',
      },
    },
  },
  plugins: [],
}
