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
        // Palenight theme colors
        palenight: {
          bg: "#292D3E",           // Main background
          bgLight: "#32374D",      // Lighter background (cards, etc)
          bgDark: "#1B1E2B",       // Darker background
          border: "#414863",       // Border color
          borderLight: "#4B5263",  // Light border
          
          // Text colors
          text: "#A6ACCD",         // Primary text
          textBright: "#EEFFFF",   // Bright text
          textDim: "#676E95",      // Dimmed text
          comment: "#676E95",      // Comments/secondary text
          
          // Accent colors
          purple: "#C792EA",       // Primary accent (purple)
          blue: "#82AAFF",         // Blue accent
          cyan: "#89DDFF",         // Cyan accent
          green: "#C3E88D",        // Success/green
          yellow: "#FFCB6B",       // Warning/yellow
          orange: "#F78C6C",       // Orange accent
          red: "#F07178",          // Error/red
          pink: "#FF79C6",         // Pink accent
          
          // UI specific
          selection: "#3A3F5C",    // Selection background
          hover: "#373D49",        // Hover state
          active: "#414863",       // Active state
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-palenight": "linear-gradient(135deg, #292D3E 0%, #1B1E2B 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;