import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Salon warm palette
        primary: {
          DEFAULT: "#8D6E63",
          dark: "#6D4C41",
          hover: "#795548",
          light: "#EFEBE9",
        },
        cream: {
          DEFAULT: "#FFFDF5",
          dark: "#F5F2EB",
          deeper: "#EDE8DC",
        },
        sand: {
          DEFAULT: "#D7CCC8",
          dark: "#BCAAA4",
        },
        earth: {
          DEFAULT: "#4A3B32",
          light: "#795548",
          muted: "#8D6E63",
        },
        // Appointment status colors
        "appt-confirmed":  "#E07A5F",
        "appt-pending":    "#F4E4BC",
        "appt-completed":  "#8D7766",
        "appt-cancelled":  "#BCAAA4",
        // Backgrounds
        "bg-light":  "#FDFBF7",
        "bg-dark":   "#2C2520",
        "card-light": "#FFFDF5",
        "card-dark":  "#3E3229",
        // Border
        "border-warm": "#E6D5C3",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        sans:    ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.375rem",
        lg:  "0.5rem",
        xl:  "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      boxShadow: {
        "warm-sm": "0 1px 3px 0 rgba(141,110,99,0.12)",
        "warm-md": "0 4px 12px 0 rgba(141,110,99,0.15)",
        "warm-lg": "0 8px 24px 0 rgba(141,110,99,0.18)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
