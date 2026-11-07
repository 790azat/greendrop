import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui';
import SW from '@/components/SW';

export const metadata: Metadata = {
  title: 'GreenDrop — вынос мусора',
  description: 'Вынесем мусор от вашей двери. Заказ за минуту, фотоотчёт о каждом шаге.',
  manifest: '/manifest.webmanifest',
  applicationName: 'GreenDrop',
  appleWebApp: { capable: true, title: 'GreenDrop', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16a34a' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1410' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster />
        <SW />
      </body>
    </html>
  );
}
