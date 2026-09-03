import Link from 'next/link';
import { Mail, Phone, MapPin, Shield, Award, Globe2 } from 'lucide-react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer className="relative bg-ink-950 text-ink-100 overflow-hidden">
      <div className="absolute inset-0 etp-grain opacity-60 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[300px] bg-etp-700/20 blur-3xl rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center space-x-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-etp-600 via-etp-700 to-indigo-700 flex items-center justify-center shadow-etp-md">
                <span className="font-display font-bold text-white text-sm tracking-wider">ETP</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-lg text-white tracking-tight">
                  Extra Travel Point
                </span>
                <span className="text-[10px] text-ink-300 font-semibold uppercase tracking-[0.2em] mt-0.5">
                  Travel Super App
                </span>
              </div>
            </Link>
            <p className="text-ink-300 text-sm mb-6 leading-relaxed max-w-sm">
              Your Journey. One ETP. Bangladesh&apos;s premium travel super app — buses,
              hotels, flights and curated experiences across the country.
            </p>
            <div className="space-y-2.5 text-sm text-ink-300">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-etp-300" />
                hello@extratravelpoint.com
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-etp-300" />
                +880 1700-000000
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-etp-300" />
                Dhaka, Bangladesh
              </p>
            </div>
            <div className="flex space-x-3 mt-6">
              {[
                { Icon: FaFacebook, label: 'Facebook' },
                { Icon: FaTwitter, label: 'Twitter' },
                { Icon: FaInstagram, label: 'Instagram' },
                { Icon: FaLinkedin, label: 'LinkedIn' },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 bg-white/5 hover:bg-etp-600 rounded-lg flex items-center justify-center text-ink-200 hover:text-white border border-white/5 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.18em]">
              Explore
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/destinations" className="text-ink-300 hover:text-white transition-colors">Destinations</Link></li>
              <li><Link href="/plan-trip" className="text-ink-300 hover:text-white transition-colors">Plan a Trip</Link></li>
              <li><Link href="/transport/bus" className="text-ink-300 hover:text-white transition-colors">Bus Tickets</Link></li>
              <li><Link href="/ai-assistant" className="text-ink-300 hover:text-white transition-colors">AI Trip Assistant</Link></li>
              <li><Link href="/dashboard" className="text-ink-300 hover:text-white transition-colors">My Dashboard</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.18em]">
              Account
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/login" className="text-ink-300 hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/register" className="text-ink-300 hover:text-white transition-colors">Create Account</Link></li>
              <li><Link href="/vendor/register" className="text-ink-300 hover:text-white transition-colors">Become a Vendor</Link></li>
              <li><Link href="/vendor" className="text-ink-300 hover:text-white transition-colors">Vendor Portal</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.18em]">
              Company
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/login" className="text-ink-300 hover:text-white transition-colors">About ETP</Link></li>
              <li><Link href="/vendor/register" className="text-ink-300 hover:text-white transition-colors">Business</Link></li>
              <li><Link href="/login" className="text-ink-300 hover:text-white transition-colors">Investor Relations</Link></li>
              <li><Link href="/login" className="text-ink-300 hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="/login" className="text-ink-300 hover:text-white transition-colors">Press</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.18em]">
              Trust
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-ink-300">
                <Shield className="w-4 h-4 text-etp-300" />
                Secure Payments
              </li>
              <li className="flex items-center gap-2 text-ink-300">
                <Award className="w-4 h-4 text-etp-300" />
                Verified Partners
              </li>
              <li className="flex items-center gap-2 text-ink-300">
                <Globe2 className="w-4 h-4 text-etp-300" />
                Bangladesh Coverage
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-ink-400 text-sm">
              © {new Date().getFullYear()} Extra Travel Point. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs text-ink-400 uppercase tracking-[0.18em]">We Accept</span>
              <div className="flex items-center gap-2">
                {['VISA', 'Mastercard', 'bKash', 'Nagad', 'Rocket'].map((pay) => (
                  <span
                    key={pay}
                    className="px-2.5 py-1.5 bg-white/5 border border-white/5 rounded-md text-[11px] font-semibold text-ink-100"
                  >
                    {pay}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-400">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <span className="text-ink-700">•</span>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <span className="text-ink-700">•</span>
            <Link href="#" className="hover:text-white transition-colors">Cookies</Link>
            <span className="text-ink-700">•</span>
            <Link href="#" className="hover:text-white transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}