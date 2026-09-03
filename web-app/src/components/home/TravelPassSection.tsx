'use client';

import Link from 'next/link';
import { QrCode, ShieldCheck, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode.react';

export default function TravelPassSection() {
  return (
    <section className="py-20 md:py-24 bg-ink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.22em] text-etp-600 mb-3">
              QR Travel Pass
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-ink-900 leading-[1.05] tracking-tight">
              One Pass. <br />
              <span className="text-gradient bg-gradient-to-r from-etp-700 to-indigo-700">
                Your whole journey.
              </span>
            </h2>
            <p className="text-ink-600 mt-5 text-base md:text-lg leading-relaxed max-w-md">
              Every ETP booking comes with a secure QR Travel Pass — your bus
              ticket, hotel key and entry pass, all in one scan.
            </p>
            <div className="mt-7 space-y-2.5">
              {[
                'Instant secure QR for every booking',
                'Encrypted identity & trip data',
                'Works offline at the gate',
              ].map((t) => (
                <div key={t} className="flex items-center gap-2.5 text-sm text-ink-700">
                  <ShieldCheck className="w-4 h-4 text-etp-600 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="group mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-etp-700 to-indigo-700 hover:from-etp-800 hover:to-indigo-800 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-etp-sm transition-all hover:-translate-y-0.5"
            >
              Explore Travel Pass
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Pass card */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 bg-gradient-to-br from-etp-500/30 via-indigo-500/20 to-violet-500/30 blur-3xl rounded-3xl" />
              <div className="relative bg-gradient-to-br from-etp-700 via-indigo-800 to-ink-950 rounded-3xl p-7 text-white shadow-etp-lg overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-etp-300/20 rounded-full blur-2xl pointer-events-none" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-display font-bold text-sm">
                      ETP
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                        QR Travel Pass
                      </p>
                      <p className="text-sm font-semibold">Premium</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                      Pass ID
                    </p>
                    <p className="text-sm font-mono font-semibold">ETP-2026-A7K9</p>
                  </div>
                </div>

                <div className="relative mt-8 flex items-center gap-5">
                  <div className="bg-white rounded-2xl p-3 shadow-etp-md flex-shrink-0">
                    <QRCode value="ETP-PASS-2026-A7K9-X9D2" size={112} level="H" includeMargin={false} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                        Traveller
                      </p>
                      <p className="text-lg font-display font-semibold leading-tight">
                        Tanvir Ahmed
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                        Active route
                      </p>
                      <p className="text-sm text-ink-100 leading-tight">
                        Dhaka → Cox&apos;s Bazar
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Secure · Verified
                    </div>
                  </div>
                </div>

                <div className="relative mt-6 pt-5 border-t border-white/15 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                      ETP Points
                    </p>
                    <p className="text-base font-display font-semibold">2,450</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-200 font-semibold">
                      Tier
                    </p>
                    <p className="text-base font-display font-semibold">Gold</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-white" />
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