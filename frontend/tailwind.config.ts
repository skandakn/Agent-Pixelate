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
        apple: {
          bg: "#F5F5F7",
          surface: "#FFFFFF",
          subtle: "#FBFBFD",
          ink: "#1D1D1F",
          secondary: "#6E6E73",
          tertiary: "#86868B",
          border: "#D2D2D7",
          blue: "#0071E3",
          "blue-hover": "#0077ED",
          link: "#0066CC",
          green: "#248A3D",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'SF Pro Display'",
          "'SF Pro Text'",
          "'Plus Jakarta Sans'",
          "'Helvetica Neue'",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "'SF Mono'",
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        apple:
          "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.08)",
        "apple-hover":
          "0 4px 12px rgba(0, 0, 0, 0.05), 0 18px 36px -16px rgba(0, 0, 0, 0.12)",
        "apple-pill": "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        "apple-card": "20px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
