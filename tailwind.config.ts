import type { Config } from 'tailwindcss';
import scrollbar from 'tailwind-scrollbar';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    fontFamily: {
      sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui']
    },
    extend: {
      spacing: {
        '2.5': '0.875rem'
      },
      screens: {
        'xs': '475px',
        'mobile': {'raw': '(hover: none) and (pointer: coarse) and (orientation: portrait)'},
        'touch': {'raw': '(hover: none) and (orientation: portrait)'},
        'ios': {'raw': '(-webkit-touch-callout: none) and (orientation: portrait)'},
        'portrait': {'raw': '(orientation: portrait)'},
        '3xl': '2000px'
      }
    }
  },
  plugins: [
    scrollbar({ nocompatible: true })
  ]
};
export default config;
