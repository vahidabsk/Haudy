/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "hsl(215 75% 22%)",
        signal: "hsl(0 75% 48%)",
        reserve: "hsl(38 70% 88%)",
        canvas: "hsl(210 20% 98%)"
      }
    }
  },
  plugins: []
};
