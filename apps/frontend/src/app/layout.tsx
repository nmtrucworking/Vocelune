import type { Metadata } from 'next';
import './globals.css';
import { VoceluneProvider } from '@/context/VoceluneContext';

export const metadata: Metadata = {
  title: 'Vocelune — Mỗi từ, một nhịp nhớ',
  description:
    'Nền tảng học từ vựng tiếng Anh theo phương pháp Active Recall và thuật toán lặp lại ngắt quãng thích ứng FSRS.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/logo-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Vocelune — Mỗi từ, một nhịp nhớ',
    description:
      'Nền tảng học từ vựng tiếng Anh theo phương pháp Active Recall và thuật toán lặp lại ngắt quãng thích ứng FSRS.',
    siteName: 'Vocelune',
    images: [
      {
        url: '/brand/logo.png',
        width: 1200,
        height: 630,
        alt: 'Vocelune — Moon Flashcard Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <VoceluneProvider>{children}</VoceluneProvider>
      </body>
    </html>
  );
}
