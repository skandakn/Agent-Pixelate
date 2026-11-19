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
        approva: {
          canvas: "#E6F7EB",
          "canvas-tint": "#DCF5E3",
          card: "#FFFFFF",
          black: "#000000",
          mint: "#10B981",
          "mint-light": "#D1FAE5",
          amber: "#F59E0B",
          "amber-light": "#FEF3C7",
          red: "#EF4444",
          "red-light": "#FEE2E2",
          purple: "#8B5CF6",
          "purple-light": "#EDE9FE",
          blue: "#2563EB",
          "blue-light": "#DBEAFE",
          gray: "#64748B",
          "gray-light": "#F1F5F9",
        },
      },
      fontFamily: {
        display: [
          "'Archivo'",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        sans: [
          "'Hanken Grotesk'",
          "'Plus Jakarta Sans'",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        brutal: "4px 4px 0px #000000",
        "brutal-sm": "2px 2px 0px #000000",
        "brutal-lg": "6px 6px 0px #000000",
        "brutal-xl": "8px 8px 0px #000000",
        "brutal-active": "1px 1px 0px #000000",
      },
      borderWidth: {
        "3": "3px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
