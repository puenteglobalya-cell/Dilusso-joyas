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
        brand:    "#C5A059",
        "brand-dark": "#A3907A",
        "brand-light": "#F5F0E8",
        ink:      "#2E2B2A",
        muted:    "#8C857B",
        subtle:   "#C4B5A0",
        border:   "#E6E1DA",
        surface:  "#FCFBFA",
        sidebar:  "#1C1A19",
        olive:    "#586E50",
        terracotta: "#946E61",
        bronze:   "#A3907A",
      },
    },
  },
};

export default config;
