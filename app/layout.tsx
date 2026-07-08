import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rajuabju",
  description:
    "My style is impetuous, my defense is impregnable, and I'm just ferocious. I'm the best ever.",
  metadataBase: new URL("https://www.rajuabju.com"),
  openGraph: {
    title: "rajuabju",
    description:
      "My style is impetuous, my defense is impregnable, and I'm just ferocious. I'm the best ever.",
    url: "https://www.rajuabju.com",
    siteName: "rajuabju",
    type: "website",
  },
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
