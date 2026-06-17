import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stadium: "#0a0a0a",
        broadcast: {
          text: "#f1f5f9",
          highlight: "#eab308",
          border: "#334155",
        },
      },
      fontFamily: {
        display: ["var(--font-oswald)", "Impact", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "slide-in": "slideIn 0.35s ease-out",
        "goal-flash": "goalFlash 0.6s ease-out",
        ticker: "ticker 20s linear infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        goalFlash: {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(234, 179, 8, 0.25)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
