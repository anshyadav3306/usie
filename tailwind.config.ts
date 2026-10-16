import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f6f2ff",
          100: "#ece4ff",
          200: "#d9ccff",
          300: "#bfaaf5",
          400: "#a68ced",
          500: "#8f7be0",
          600: "#7b66d1",
          700: "#6652b5",
        },
        blush: { 50: "#fff3f8", 100: "#ffe3ef", 200: "#ffcde2" },
        ink: { DEFAULT: "#2b2540", soft: "#4a4363", muted: "#7d7694" },
      },
      fontFamily: { sans: ["var(--font-nunito)", "system-ui", "sans-serif"] },
      borderRadius: { bubble: "20px" },
      boxShadow: {
        soft: "0 8px 30px rgba(143, 123, 224, 0.15)",
        card: "0 2px 12px rgba(143, 123, 224, 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
