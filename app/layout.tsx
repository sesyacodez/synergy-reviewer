import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synergy Reviewer",
  description:
    "Ensemble AI code review — multiple agents, one de-biased review.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
