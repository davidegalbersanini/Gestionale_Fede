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
          50: '#fdf4f7',
          100: '#fbe8ef',
          200: '#f7d3e1',
          300: '#f0b0c9',
          400: '#e580a8',
          500: '#d75a89',
          600: '#c13b6e',
          700: '#a32955',
          800: '#872547',
          900: '#71233e',
          950: '#440f22',
        },
      },
    },
  },
  plugins: [],
};
export default config;
