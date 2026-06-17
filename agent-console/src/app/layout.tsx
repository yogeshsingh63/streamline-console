import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streamline Console — Agent Interface",
  description:
    "Real-time AI agent console with streaming responses, tool call interruptions, and protocol tracing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
