import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#08080D",
          secondary: "#0D0B14",
        },
        card: {
          DEFAULT: "#12101A",
          elevated: "#181421",
        },
        brand: {
          primary: "#8B5CF6",
          secondary: "#A855F7",
          deep: "#6D28D9",
        },
        accent: {
          cyan: "#22D3EE",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#A1A1AA",
          muted: "#71717A",
        },
        border: {
          DEFAULT: "#272332",
        },
        status: {
          success: "#34D399",
          error: "#FB7185",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "main-gradient":
          "linear-gradient(135deg, #6D28D9 0%, #8B5CF6 50%, #22D3EE 100%)",
        "purple-gradient": "linear-gradient(135deg, #6D28D9 0%, #A855F7 100%)",
        "violet-glow":
          "radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0) 70%)",
        "cyan-glow":
          "radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, rgba(34, 211, 238, 0) 65%)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
