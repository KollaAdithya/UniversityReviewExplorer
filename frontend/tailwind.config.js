/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd4ff",
          300: "#8eb8ff",
          400: "#5a92ff",
          500: "#3366ff",
          600: "#1a44f5",
          700: "#1534e1",
          800: "#182db6",
          900: "#192b8f",
          950: "#121b57",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae3",
          300: "#b0b9c9",
          400: "#8593ab",
          500: "#667690",
          600: "#515f77",
          700: "#434d61",
          800: "#3a4252",
          900: "#343a46",
          950: "#1c2029",
        },
        sent: {
          pos: "#16a34a",
          neu: "#d97706",
          neg: "#dc2626",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 32, 41, 0.04), 0 8px 24px rgba(28, 32, 41, 0.06)",
        "card-hover": "0 4px 12px rgba(28, 32, 41, 0.08), 0 16px 40px rgba(51, 102, 255, 0.1)",
        nav: "0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(18, 27, 87, 0.35)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
