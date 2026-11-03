import type { Config } from "tailwindcss";

// Colours resolve through CSS variables (RGB triplets in app/globals.css) so a single
// data-theme flip re-themes everything and Tailwind's opacity modifiers keep working.
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        fg: token("--fg"),
        muted: token("--fg-muted"),
        subtle: token("--fg-subtle"),
        faint: token("--fg-faint"),
        accent: { DEFAULT: token("--accent"), dim: token("--accent-dim") },
        warn: token("--warn"),
        danger: token("--danger"),
        ink: {
          950: token("--ink-950"),
          900: token("--ink-900"),
          850: token("--ink-850"),
          800: token("--ink-800"),
          700: token("--ink-700"),
          line: token("--ink-line"),
        },
      },
    },
  },
  plugins: [],
};

export default config;
