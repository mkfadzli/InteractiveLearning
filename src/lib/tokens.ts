/**
 * Design tokens — TypeScript mirror of the CSS variables in globals.css.
 * The web app consumes the CSS variables (via Tailwind semantic colors).
 * The React Native / Expo app will import this object directly so both
 * platforms stay on one source of truth. Keep in sync with globals.css.
 */
export const tokens = {
  brand: {
    teal: "#0FB1A8", // fill only — fails 4.5:1 on white as text
    tealDeep: "#0B7A74", // accessible primary (text, CTAs on light)
    tealSoft: "#E0F5F3",
    coral: "#FF6B61",
    coralDeep: "#D9453B",
    coralSoft: "#FFE9E7",
    navy: "#0B2545",
    slate: "#6B7A90",
  },
  light: {
    bg: "#F6F8FA",
    surface: "#FFFFFF",
    surface2: "#EEF2F6",
    text: "#0B2545",
    text2: "#5B6B82",
    border: "#E2E8F0",
    primary: "#0B7A74",
    onPrimary: "#FFFFFF",
    success: "#0B7A74",
    error: "#C9302A",
  },
  dark: {
    bg: "#071020",
    surface: "#0E1B30",
    surface2: "#132440",
    text: "#EAF1F8",
    text2: "#9FB0C5",
    border: "#1E3252",
    primary: "#34C8BC",
    onPrimary: "#06251F",
    success: "#34C8BC",
    error: "#FF8A82",
    teal: "#0DA99C",
    tealSoft: "#0E2E3A",
    coral: "#FF7A6E",
    coralDeep: "#FF9189",
    coralSoft: "#3A1E22",
  },
  radius: { lg: 20, md: 14, sm: 10 },
  motion: { dur: 200, ease: [0.2, 0.8, 0.3, 1] as const },
} as const;

export type Tokens = typeof tokens;
