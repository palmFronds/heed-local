import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SwapProvider } from "./providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: 390,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Heed Wallet",
  description: "Crypto wallet swap interface — Heed Demo Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground">
        {/* Desktop fallback — shown on viewports > 430px */}
        <div id="desktop-fallback">
          <p>This app is mobile-only.</p>
        </div>

        {/* Mobile app shell — hidden on wide viewports */}
        <div id="mobile-app">
          <SwapProvider>{children}</SwapProvider>
        </div>
      </body>
    </html>
  );
}
