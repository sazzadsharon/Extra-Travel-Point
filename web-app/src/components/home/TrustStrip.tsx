'use client';

import { ShieldCheck, Lock, Headphones, Award } from 'lucide-react';

const items = [
  { Icon: Lock, title: 'Secure Payments', desc: 'PCI-DSS encrypted checkout' },
  { Icon: ShieldCheck, title: 'Verified Partners', desc: 'Trusted operators only' },
  { Icon: Headphones, title: '24/7 Support', desc: 'Helpdesk in Bangla & English' },
  { Icon: Award, title: 'Trusted Travel Experience', desc: 'Backed by real reviews' },
];

export default function TrustStrip() {
  return (
    <section className="py-16 bg-ink-50 border-y border-ink-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it) => (
            <div key={it.title} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-ink-100 flex items-center justify-center shadow-etp-sm flex-shrink-0">
                <it.Icon className="w-5 h-5 text-etp-700" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-ink-900 tracking-tight">
                  {it.title}
                </h3>
                <p className="text-sm text-ink-600 mt-1 leading-relaxed">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}