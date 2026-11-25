/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#101D38',
          800: '#172746',
          700: '#1D3557',
        },
        blue: {
          300: '#C5E4FF',
          400: '#8FCBFF',
          500: '#5DA9E9',
        },
        border: '#304968',
        'text-primary': '#F4F8FF',
        'text-secondary': '#A9BED8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
