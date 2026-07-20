import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Cordaid Feedback and Response Dashboard",
  description:
    "Interactive dashboard for Cordaid feedback and response data, with filters, KPIs, analytics charts, sortable records, and detail drill-downs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
