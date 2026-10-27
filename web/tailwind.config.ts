import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090a0f',
        surface: {
          DEFAULT: '#11131a',
          card: '#131622',
          border: '#1f2433',
          hover: '#191e2e',
        },
        brand: {
          DEFAULT: '#00F0FF', // Bold Electric Cyan
          hover: '#33f3ff',
          glow: 'rgba(0, 240, 255, 0.25)',
          dark: '#008b94',
        },
        seat: {
          available: '#1e2433',
          'available-border': '#2f3b52',
          locked: '#f59e0b',
          'locked-glow': 'rgba(245, 158, 11, 0.3)',
          mine: '#00f0ff',
          'mine-glow': 'rgba(0, 240, 255, 0.4)',
          booked: '#272a33',
          'booked-text': '#525866',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
