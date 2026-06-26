/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: '#0a0a0a',
          panel: '#111111',
          line: '#555555',
          accent: '#fe523d',
          accent2: '#ff6b57',
          blue: '#3b82f6',
          green: '#27c163',
          dim: '#a1a1a1',
        },
      },
      fontFamily: {
        mono: ["'Geist Mono'", "'JetBrains Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
