import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundColor: {
        'dark': '#1a1a1a',
        'dark-accent': '#2a2a2a',
      },
      textColor: {
        'dark': '#e0e0e0',
        'dark-muted': '#a0a0a0',
      },
      borderColor: {
        'dark-border': '#3a3a3a',
      },
    },
  },
  plugins: [],
}
export default config
