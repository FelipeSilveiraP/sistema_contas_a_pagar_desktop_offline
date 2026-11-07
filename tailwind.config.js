/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./frontend/html/**/*.html", "./frontend/ts/**/*.ts"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "on-surface": "#1c1b1b",
        background: "#fcf9f8",
        "primary-container": "#FFE600",
        "surface-container-lowest": "#ffffff",
      },
      fontFamily: {
        headline: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
