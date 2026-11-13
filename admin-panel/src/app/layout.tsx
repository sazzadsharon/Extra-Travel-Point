import './globals.css';
import type { Metadata } from 'next';
import { AdminLanguageProvider } from '../i18n/LanguageProvider';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';

export const metadata: Metadata = {
  title: 'Extra Travel Point — Admin Dashboard',
  description: 'Admin Portal for Extra Travel Point Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50"><AdminLanguageProvider><div className="flex justify-end px-4 pt-4"><LanguageSwitcher /></div>{children}</AdminLanguageProvider></body>
    </html>
  );
}
