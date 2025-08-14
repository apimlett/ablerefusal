'use client';

import { SettingsProvider } from "@/contexts/SettingsContext";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>AbleRefusal</title>
        <meta name="description" content="Generate amazing AI images locally with Stable Diffusion" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}