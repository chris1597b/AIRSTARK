/** @type {import('tailwindcss').Config} */
export default {
  // Misma cobertura que el Play CDN: todo el HTML + todo el código fuente.
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
