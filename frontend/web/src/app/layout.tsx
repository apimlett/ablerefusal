import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AbleRefusal",
  description: "Generate amazing AI images locally with Stable Diffusion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}