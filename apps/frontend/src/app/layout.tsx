import type { Metadata } from 'next';
import './globals.css';
import { VoceluneProvider } from '@/context/VoceluneContext';

export const metadata: Metadata = {
  title: 'Vocelune — Mỗi từ, một nhịp nhớ',
  description:
    'Nền tảng học từ vựng tiếng Anh theo phương pháp Active Recall và thuật toán lặp lại ngắt quãng thích ứng FSRS.',
  icons: {
    icon: '/favicon.ico',
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
