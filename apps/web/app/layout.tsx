import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SystemMessageProvider } from "@/components/system-message-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { SocketSessionProvider } from "@/components/socket-session-provider";
import { PWAProvider } from "@/components/PWAProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#060e10",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: {
    template: "%s · Texas Hold'em",
    default: "Texas Hold'em — Play to Win",
  },
  description:
    "Multiplayer No-Limit Texas Hold'em poker. Real-time gameplay, casino-style tables.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "CHIPS",
    "mobile-web-app-capable": "yes",
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
        <I18nProvider>
          <SystemMessageProvider>
            <SocketSessionProvider>
              {children}
              <PWAProvider />
            </SocketSessionProvider>
          </SystemMessageProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
