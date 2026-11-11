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
        // Tonalità pastello coordinate per gli accenti rose/pink della UI
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#F472B6', // Rosa Pastello / Cipria luminoso
          600: '#E879A8', // Rosa Pastello pieno ma morbido (non acido/aggressivo)
          700: '#C75B8B',
          800: '#9D3F6A',
          900: '#722B4C',
          950: '#3D1527',
        },
        pink: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#FB7185', // Pesca Corallo Pastello
          600: '#E86378', // Pesca Corallo vellutato
          700: '#C8485E',
          800: '#9B3245',
          900: '#6E2130',
          950: '#3B0E17',
        },
        brand: {
          50: '#fdf4f7',
          100: '#fbe8ef',
          200: '#f7d3e1',
          300: '#f0b0c9',
          400: '#e580a8',
          500: '#F472B6',
          600: '#E879A8',
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

