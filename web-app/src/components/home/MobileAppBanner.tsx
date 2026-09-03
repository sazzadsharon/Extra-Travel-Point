'use client';

import { useState } from 'react';
import { QrCode, Smartphone } from 'lucide-react';
import QRCode from 'qrcode.react';

export default function MobileAppBanner() {
  const [showNote, setShowNote] = useState(false);
  const appUrl = 'https://extratravelpoint.com';

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-primary-950 rounded-3xl p-8 md:p-12">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-accent-500/15 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-500/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 border border-white/10">
                <Smartphone className="w-4 h-4 text-accent-300" />
                <span className="text-sm font-medium text-white">ETP Mobile App</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                Your Journey, Your Way!
              </h2>
              <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto lg:mx-0">
                Faster booking, offline tickets and push updates for every journey — right in your
                pocket.
              </p>
<div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => setShowNote(true)}
                  className="inline-flex items-center gap-3 bg-white text-gray-900 px-5 py-3 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.2 11.9l2.398-2.398zM5.864 2.658L16.8 9.99l-2.302 2.302-8.634-8.634z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 leading-none">Get it on</div>
                    <div className="text-sm font-semibold leading-tight">Google Play</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowNote(true)}
                  className="inline-flex items-center gap-3 bg-white text-gray-900 px-5 py-3 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.29.87.81 0 2.25-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.68.81-1.83 1.44-2.94 1.44-.1-1.18.35-2.35 1.04-3.13" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 leading-none">Download on the</div>
                    <div className="text-sm font-semibold leading-tight">App Store</div>
                  </div>
                </button>
              </div>
{showNote && (
                <p className="mt-4 text-sm text-accent-300 bg-accent-500/10 border border-accent-400/30 inline-block px-4 py-2 rounded-xl">
                  📲 The ETP app is launching soon — we&apos;ll notify you the moment it is live.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3 justify-center lg:justify-start text-xs text-gray-300">
                <span className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">Instant QR tickets</span>
                <span className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">ETP Points balance</span>
                <span className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">Trip reminders</span>
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center shadow-2xl p-4">
                  <QRCode value={appUrl} size={160} level="H" includeMargin={false} />
                </div>
                <div className="absolute -top-2 -right-2 w-9 h-9 bg-accent-400 rounded-full flex items-center justify-center shadow-lg">
                  <QrCode className="w-5 h-5 text-primary-950" />
                </div>
              </div>
              <p className="text-sm text-gray-400">Scan to open ETP</p>

              {/* Phone mockup */}
              <div className="relative mt-2">
                <div className="w-36 h-72 bg-gray-900 rounded-[2rem] border-4 border-gray-700 shadow-2xl overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-b from-primary-700 to-primary-950 flex items-center justify-center">
                    <div className="text-center text-white p-4">
                      <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto mb-3" fill="#ffffff">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.2 11.9l2.398-2.398zM5.864 2.658L16.8 9.99l-2.302 2.302-8.634-8.634z" />
                      </svg>
                      <p className="font-display text-sm font-bold">ETP</p>
                      <p className="text-xs text-primary-200 mt-1">Travel Super App</p>
                      <div className="mt-4 space-y-2">
                        <div className="h-2 bg-white/20 rounded-full" />
                        <div className="h-2 bg-white/20 rounded-full w-3/4 mx-auto" />
                        <div className="h-6 bg-accent-400/80 rounded-lg mt-3" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}