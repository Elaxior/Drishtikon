/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#f6f6f4",
          dark: "#ecece8",
          100: "#f7f8fa",
          200: "#e7e9ee",
          300: "#d8dbe2",
        },
        ink: {
          DEFAULT: "#16171a",
          secondary: "#4f535d",
          muted: "#7a808c",
        },
        "bias-left": {
          DEFAULT: "#ef4e2a",
          bg: "rgba(239, 78, 42, 0.13)",
        },
        "bias-center": {
          DEFAULT: "#9ca4b2",
          bg: "rgba(156, 164, 178, 0.18)",
        },
        "bias-right": {
          DEFAULT: "#2f7ae5",
          bg: "rgba(47, 122, 229, 0.14)",
        },
        "bias-unknown": {
          DEFAULT: "#c08d1d",
          bg: "rgba(192, 141, 29, 0.14)",
        },
        gold: {
          DEFAULT: "#ff9d1f",
          dark: "#de8718",
        },
        accent: {
          DEFAULT: "#ff5a1f",
          hover: "#e84f1b",
        },
      },
      fontFamily: {
        serif: ['"Sora"', '"Manrope"', "sans-serif"],
        sans: ['"Manrope"', '"Segoe UI"', "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s ease-out forwards",
        "fade-in-scale": "fadeInScale 0.5s ease-out forwards",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      boxShadow: {
        editorial: "0 16px 40px rgba(15, 22, 34, 0.15)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
