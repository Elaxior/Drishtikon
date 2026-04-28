/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#faf7f2",
          dark: "#f3ede3",
          100: "#f8f4ed",
          200: "#eee8de",
          300: "#e8e0d4",
        },
        ink: {
          DEFAULT: "#1a1a1a",
          secondary: "#6b6560",
          muted: "#9c9590",
        },
        "bias-left": {
          DEFAULT: "#d97056",
          bg: "rgba(217, 112, 86, 0.12)",
        },
        "bias-center": {
          DEFAULT: "#a8a29e",
          bg: "rgba(168, 162, 158, 0.12)",
        },
        "bias-right": {
          DEFAULT: "#6b7ec2",
          bg: "rgba(107, 126, 194, 0.12)",
        },
        "bias-unknown": {
          DEFAULT: "#c4a35a",
          bg: "rgba(196, 163, 90, 0.12)",
        },
        gold: {
          DEFAULT: "#d4a853",
          dark: "#b8922f",
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', "Georgia", "serif"],
        sans: ['"Inter"', '"Segoe UI"', "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.4s ease-out forwards",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
