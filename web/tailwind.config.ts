import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Inter', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#020617',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.55)',
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(1200px circle at 20% 10%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(900px circle at 80% 30%, rgba(167,139,250,0.25), transparent 50%), radial-gradient(700px circle at 50% 90%, rgba(34,197,94,0.12), transparent 55%)',
      },
    },
  },
  plugins: [],
} satisfies Config
