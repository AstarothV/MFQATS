import React from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';

// DM Sans is kept in the project (variable font, weights 100-1000) instead of fetched from Google at build time:
// Turbopack could not read the font links Google now returns, which stopped `npm run dev` from starting.
const dmSans = localFont({
  src: './fonts/dm-sans-latin-wght-normal.woff2',
  weight: '100 1000',
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // the site has its own light and dark themes: phone browsers must not darken it themselves
  colorScheme: 'light dark',
  themeColor: '#F5F3FF',
};

export const metadata: Metadata = {
  title: 'MFQATS — MVCA WoodWorks Quality Assurance & Tracking System',
  description:
    'Enterprise manufacturing QA platform with automated defect detection, 3D models, real-time production tracking, and role-based access control.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(() => {
            try {
              // light by default; dark only if the person picked it ('mfqats-theme', so older saved choices don't apply)
              const storedTheme = localStorage.getItem('mfqats-theme');
              const theme = storedTheme === 'dark' ? 'dark' : 'light';
              document.documentElement.classList.toggle('dark', theme === 'dark');
              document.documentElement.style.colorScheme = theme;
              if (theme === 'dark') document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', '#0B0B0F'));
            } catch (error) {
              document.documentElement.classList.remove('dark');
              document.documentElement.style.colorScheme = 'light';
            }
          })();`}
        </Script>
      </head>
      <body className={dmSans.className} suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}