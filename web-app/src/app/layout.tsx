import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../contexts/AuthContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL('https://extratravelpoint.com'),
  title: 'Extra Travel Point — Bangladesh Travel Super App',
  description:
    'Book buses, hotels and tours across Bangladesh. Earn ETP Points, get instant QR tickets and travel more while paying less.',
  keywords: [
    'bus ticket Bangladesh',
    'hotel booking Bangladesh',
    'travel super app',
    'ETP Points',
    'tour packages Bangladesh',
    'Extra Travel Point',
  ],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Extra Travel Point',
    title: 'Extra Travel Point — Travel Super App',
    description: 'Book buses, hotels and tours across Bangladesh. Earn ETP Points with every journey.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Extra Travel Point',
      },
    ],
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}