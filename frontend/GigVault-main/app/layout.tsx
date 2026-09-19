import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GigVault — The missing rail.",
  description:
    "GigVault turns bank-recorded income and tenure into a portable work passport for gig workers.",
  icons: {
    icon: "/icon.svg",
  },
};

import { AppStateProvider } from "../lib/AppState";
import { Providers } from "../lib/Providers";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body bg-bg-primary text-text-primary antialiased">
        <Providers>
          <AppStateProvider>
            {children}
          </AppStateProvider>
        </Providers>
      </body>
    </html>
  );
}