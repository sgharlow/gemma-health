import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthPulse Edge",
  description:
    "Quality intelligence for Critical Access Hospitals — runs entirely on-device with Gemma 4.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
