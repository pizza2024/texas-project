import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Texas Admin',
  description: 'Texas Hold\'em Admin Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
