/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./frontend/html/**/*.html", "./frontend/ts/**/*.ts"],
  darkMode: "class",
  theme: {
    extend: {
      // letras ~12% maiores em todas as telas (pedido do usuario, 2026-11-18; igual ao Garantias)
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.875rem" }],
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }],
      },
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
