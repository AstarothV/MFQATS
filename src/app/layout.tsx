import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import Script from 'next/script';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MWQATS — MVCA Wood Quality Assurance & Tracking System',
  description:
    'Enterprise manufacturing QA platform with AI-powered defect detection, AR measurement, real-time production tracking, and role-based access control.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(() => {
            try {
              const storedTheme = localStorage.getItem('theme');
              const theme = storedTheme === 'light' ? 'light' : 'dark';
              document.documentElement.classList.toggle('dark', theme === 'dark');
              document.documentElement.style.colorScheme = theme;
            } catch (error) {
              document.documentElement.classList.add('dark');
              document.documentElement.style.colorScheme = 'dark';
            }
          })();`}
        </Script>

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fmwqatsm2781back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.18" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body className={dmSans.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}