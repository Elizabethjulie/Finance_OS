import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F8FAF9",
        foreground: "#111827",
        brand: {
          DEFAULT: "#0F5147",
          hover: "#0C433A",
          light: "#E8F5F1",
          subtle: "#F0F9F6",
          border: "#A5D8CD",
        },
        accent: {
          DEFAULT: "#0F5147", // align default accent with the primary brand teal
          hover: "#0C433A",
          light: "#E8F5F1",
        },
        muted: "#64748B",
        border: "#E5EBE8",
        danger: "#B91C1C",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
