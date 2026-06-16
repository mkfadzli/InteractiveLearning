import type { Config } from "tailwindcss";

/**
 * All colors map to CSS variables defined in globals.css.
 * Components must use these semantic names — never raw hex.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        border: "var(--border)",
        primary: "var(--primary)",
        "on-primary": "var(--on-primary)",
        teal: "var(--teal)",
        "teal-soft": "var(--teal-soft)",
        coral: "var(--coral)",
        "coral-deep": "var(--coral-deep)",
        "coral-soft": "var(--coral-soft)",
        navy: "var(--navy)",
        success: "var(--success)",
        error: "var(--error)",
      },
      borderRadius: {
        lg2: "var(--radius-lg)",
        md2: "var(--radius-md)",
        sm2: "var(--radius-sm)",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,37,69,.06), 0 4px 16px rgba(11,37,69,.06)",
        lift: "0 8px 30px rgba(11,37,69,.12)",
      },
      transitionTimingFunction: { brand: "cubic-bezier(.2,.8,.3,1)" },
    },
  },
  plugins: [],
};
export default config;
