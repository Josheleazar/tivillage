export const BRAND = {
  red: "#EF3A4F",
  redDark: "#ad2435",
  cream: "#FFFFF0",
  dark: "#403833",
  grey: "#BFAD9F",
  muted: "#766a62",
  border: "#eadfd6",
  bg: "#faf7f2",
} as const;

// Twelve-color donut palette. Steps 7 + 11 take this verbatim into
// charts.tsx's options. Keep tail-friendly muted palette Cordaid's
// existing donut colour scheme.
export const CHART_PALETTE = [
  "#EF3A4F",
  "#ad2435",
  "#403833",
  "#766a62",
  "#BFAD9F",
  "#F2A65A",
  "#3E7C9A",
  "#87B87F",
  "#9C7BB0",
  "#C99E5D",
  "#5E8FA8",
  "#D08C5C",
];
