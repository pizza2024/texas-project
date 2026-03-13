import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SystemMessageProvider } from "@/components/system-message-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s · Texas Hold\'em',
    default: 'Texas Hold\'em — Play to Win',
  },
  description: 'Multiplayer No-Limit Texas Hold\'em poker. Real-time gameplay, casino-style tables.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SystemMessageProvider>{children}</SystemMessageProvider>
      </body>
    </html>
  );
}
