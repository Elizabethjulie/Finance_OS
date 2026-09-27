import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FAFAFA",
        foreground: "#1A1A1A",
        accent: {
          DEFAULT: "#0F766E", // muted teal — the one restrained accent color
          hover: "#0B5C56",
        },
        muted: "#6B7280",
        border: "#E5E7EB",
        danger: "#B91C1C",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
