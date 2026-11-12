/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        surface: 'rgba(20,20,28,0.95)',
        'surface-bubble': 'rgba(40,40,50,0.95)',
        'surface-user': 'rgba(55,52,80,0.95)',
        lavender: 'rgba(176,170,255,0.85)',
        'lavender-full': 'rgb(176,170,255)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
