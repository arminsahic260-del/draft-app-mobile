/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        lol: {
          dark:        '#0a0a13',
          darker:      '#06060d',
          card:        '#13132b',
          border:      '#1e1e3f',
          gold:        '#c89b3c',
          'gold-light':'#f0e6d2',
          blue:        '#0397ab',
          red:         '#e84057',
          purple:      '#6366f1',
          green:       '#22c55e',
          text:        '#a09b8c',
          'text-bright':'#f0e6d2',
        },
      },
    },
  },
  plugins: [],
};
