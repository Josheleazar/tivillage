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

export interface FilterFieldDef {
  key: keyof import("./types").Filters;
  label: string;
  type: "select" | "date" | "search";
  sourceColumn?: string;
  span?: number;
}

export const FILTER_DEFS: FilterFieldDef[] = [
  { key: "project", label: "Project", type: "select", sourceColumn: "Project related to feedback" },
  { key: "district", label: "District", type: "select", sourceColumn: "District" },
  { key: "subcounty", label: "Subcounty", type: "select", sourceColumn: "Subcounty" },
  { key: "category", label: "Feedback category", type: "select", sourceColumn: "Feedback Category" },
  { key: "status", label: "Status", type: "select", sourceColumn: "Status of this feedback" },
  { key: "gender", label: "Gender", type: "select", sourceColumn: "Gender" },
  { key: "channel", label: "Channel", type: "select", sourceColumn: "Feedback Channel used" },
  { key: "thematic", label: "Thematic area", type: "select", sourceColumn: "Thematic Area" },
  { key: "referral", label: "Referral status", type: "select", sourceColumn: "Referral Status" },
  { key: "emergency", label: "Emergency feedback", type: "select", sourceColumn: "Emergency Feedback" },
  { key: "startDate", label: "Start date", type: "date" },
  { key: "endDate", label: "End date", type: "date" },
  { key: "search", label: "Search text", type: "search", span: 2 },
];
