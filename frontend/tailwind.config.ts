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
        obsidian: {
          bg: "#09090B",
          card: "#121216",
          elevated: "#18181F",
          border: "rgba(255, 255, 255, 0.08)",
        },
        violet: {
          electric: "#8B5CF6",
        },
        cyan: {
          signal: "#06B6D4",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "obsidian-grid":
          "radial-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px)",
        "studio-glow":
          "radial-gradient(ellipse 65% 45% at 50% -10%, rgba(139, 92, 246, 0.16), transparent 70%), radial-gradient(ellipse 45% 35% at 85% 15%, rgba(6, 182, 212, 0.10), transparent 70%)",
      },
      backgroundSize: {
        "grid-24": "24px 24px",
      },
      boxShadow: {
        studio: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 20px 50px -24px rgba(0, 0, 0, 0.9)",
        "violet-glow": "0 0 28px -6px rgba(139, 92, 246, 0.55)",
        "cyan-glow": "0 0 24px -6px rgba(6, 182, 212, 0.5)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
