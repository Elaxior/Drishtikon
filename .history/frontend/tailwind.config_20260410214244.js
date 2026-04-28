/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#f7f7f4",
          dark: "#efeee9",
          100: "#f5f4ef",
          200: "#eceae3",
          300: "#dfddd5",
        },
        ink: {
          DEFAULT: "#131313",
          secondary: "#565656",
          muted: "#828282",
        },
        "bias-left": {
          DEFAULT: "#df5c3f",
          bg: "rgba(223, 92, 63, 0.14)",
        },
        "bias-center": {
          DEFAULT: "#979189",
          bg: "rgba(151, 145, 137, 0.14)",
        },
        "bias-right": {
          DEFAULT: "#4f78c8",
          bg: "rgba(79, 120, 200, 0.14)",
        },
        "bias-unknown": {
          DEFAULT: "#c58b27",
          bg: "rgba(197, 139, 39, 0.14)",
        },
        gold: {
          DEFAULT: "#ff824c",
          dark: "#e05d2c",
        },
      },
      fontFamily: {
        serif: ['"Syne"', '"Segoe UI"', "sans-serif"],
        sans: ['"Manrope"', '"Segoe UI"', "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s ease-out forwards",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
