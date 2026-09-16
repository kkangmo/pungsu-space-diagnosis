/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FBF8F3",
          100: "#F5EFE6",
          200: "#EBE2D5",
        },
        ink: {
          900: "#22201C",
          700: "#4A463F",
          500: "#757067",
        },
        accent: {
          600: "#7C5B3A",
          500: "#9A7450",
          300: "#C9AE8D",
        },
        good: "#5C7F5F",
        normal: "#B08A4A",
        caution: "#A8574A",
      },
    },
  },
  plugins: [],
};
