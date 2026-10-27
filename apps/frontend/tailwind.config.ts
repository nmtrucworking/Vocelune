import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#5949E8",
          primaryHover: "#4A3BD6",
          primarySoft: "#EAE8FF",
          ink: "#17213B",
          canvas: "#F7F8FC",
          mint: "#D8F7F1",
        },
        surface: {
          base: "#FFFFFF",
          muted: "#F0F2F8",
          subtle: "#F8F9FD",
        },
        text: {
          primary: "#17213B",
          secondary: "#59647D",
          muted: "#8C96AB",
        },
        semantic: {
          successText: "#1B786E",
          successBg: "#E3FAF5",
          warningText: "#9B5B0E",
          warningBg: "#FEF4E2",
          errorText: "#B93655",
          errorBg: "#FDECEF",
          infoText: "#2B59C3",
          infoBg: "#EEF3FF",
        },
      },
      fontFamily: {
        sans: [
          '"Be Vietnam Pro"',
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(23, 33, 59, 0.05), 0 20px 25px -5px rgba(23, 33, 59, 0.03)",
        card: "0 2px 8px -2px rgba(23, 33, 59, 0.06), 0 10px 16px -4px rgba(23, 33, 59, 0.04)",
        elevated: "0 10px 30px -5px rgba(89, 73, 232, 0.12), 0 8px 10px -6px rgba(23, 33, 59, 0.04)",
      },
      keyframes: {
        "orbit-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
      },
      animation: {
        "orbit-pulse": "orbit-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
