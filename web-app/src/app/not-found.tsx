import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-primary-950 relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent-500/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

      <div className="relative text-center max-w-lg">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent-300 bg-accent-500/10 border border-accent-400/30 rounded-full px-4 py-1.5 mb-8">
          <MapPin className="w-4 h-4" />
          Route not discovered
        </div>

        <h1 className="font-display text-7xl md:text-8xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-3">This page is off the beaten path</h2>
        <p className="text-primary-100/80 mb-10 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back to your
          next adventure.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-primary-950 font-bold px-6 py-3.5 rounded-xl transition-colors"
          >
            Go Back Home
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/transport/bus"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors"
          >
            Browse Buses
          </Link>
        </div>
      </div>
    </div>
  );
}