import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Extra Travel Point Mobile',
  description: 'Mobile App Portal for Extra Travel Point',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex justify-center bg-slate-950 min-h-screen">
        <div className="w-full max-w-md bg-slate-900 min-h-screen border-x border-slate-800 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
