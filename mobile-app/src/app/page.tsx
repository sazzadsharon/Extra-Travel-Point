'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Ticket, Hotel, Bus, Plane, CheckCircle2, ScanLine, ArrowRight } from 'lucide-react';

export default function MobileApp() {
  const [role, setRole] = useState<'customer' | 'vendor'>('customer');
  const [view, setView] = useState<'home' | 'booking' | 'qr' | 'scanner'>('home');
  const [selectedService, setSelectedService] = useState<'hotel' | 'bus' | 'flight'>('hotel');

  const sampleBookingQR = JSON.stringify({
    payload: {
      booking_id: "BKG-2024-0001",
      user_id: "USR-12345",
      provider_id: "PRV-67890",
      category: "hotel",
      valid_from: "2026-08-26",
      valid_until: "2026-08-31",
      discounts: [
        { type: "combo", provider: "PRV-67890", value: 1200, unit: "BDT" }
      ]
    },
    signature: "8f3b2a1c9e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
  });

  const [scanResult, setScanResult] = useState<any>(null);

  const handleSimulateScan = () => {
    setScanResult({
      valid: true,
      user_name: "Shakib Al Hasan",
      booking_id: "BKG-2024-0001",
      category: "hotel",
      discountApplied: "BDT 1,200 (10% Combo Discount)",
      scanned_at: new Date().toLocaleTimeString()
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4">
      {/* Top Header */}
      <div>
        <header className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <div>
            <h1 className="font-bold text-lg text-sky-400">এক্সট্রাভেল পয়েন্ট</h1>
            <p className="text-xs text-slate-400">Extra Travel Point App</p>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => { setRole('customer'); setView('home'); }}
              className={`px-3 py-1 rounded-md font-medium transition ${role === 'customer' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
            >
              Customer
            </button>
            <button
              onClick={() => { setRole('vendor'); setView('scanner'); }}
              className={`px-3 py-1 rounded-md font-medium transition ${role === 'vendor' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}
            >
              Vendor
            </button>
          </div>
        </header>

        {/* Customer Views */}
        {role === 'customer' && (
          <>
            {view === 'home' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-5 rounded-2xl text-white">
                  <h2 className="text-xl font-bold mb-1">স্মার্ট ভ্রমণ ও বিশেষ ছাড়!</h2>
                  <p className="text-xs text-sky-100 mb-4">হোটেল, বাস ও ফ্লাইট বুকিংয়ে ১৫% পর্যন্ত কম্বো ডিসকাউন্ট পান QR স্ক্যানে</p>
                  <button
                    onClick={() => setView('booking')}
                    className="bg-white text-sky-700 px-4 py-2 rounded-xl font-bold text-xs shadow hover:bg-sky-50 transition flex items-center space-x-1"
                  >
                    <span>নতুন বুকিং করুন</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <h3 className="font-semibold text-sm text-slate-300">সেবা নির্বাচন করুন</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => { setSelectedService('hotel'); setView('booking'); }}
                    className="bg-slate-800 p-4 rounded-xl flex flex-col items-center justify-center text-slate-300 hover:border hover:border-sky-500 transition"
                  >
                    <Hotel size={28} className="text-sky-400 mb-2" />
                    <span className="text-xs font-medium">হোটেল</span>
                  </button>
                  <button
                    onClick={() => { setSelectedService('bus'); setView('booking'); }}
                    className="bg-slate-800 p-4 rounded-xl flex flex-col items-center justify-center text-slate-300 hover:border hover:border-sky-500 transition"
                  >
                    <Bus size={28} className="text-indigo-400 mb-2" />
                    <span className="text-xs font-medium">বাস টিকিট</span>
                  </button>
                  <button
                    onClick={() => { setSelectedService('flight'); setView('booking'); }}
                    className="bg-slate-800 p-4 rounded-xl flex flex-col items-center justify-center text-slate-300 hover:border hover:border-sky-500 transition"
                  >
                    <Plane size={28} className="text-emerald-400 mb-2" />
                    <span className="text-xs font-medium">ফ্লাইট</span>
                  </button>
                </div>

                {/* My Bookings preview */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-xs text-slate-300">সাম্প্রতিক বুকিং (Active Booking)</span>
                    <span className="text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded font-mono">Confirmed</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-white">Cox's Bazar Hotel Palace</p>
                      <p className="text-xs text-slate-400">২ রাত • ১টি রুম</p>
                    </div>
                    <button
                      onClick={() => setView('qr')}
                      className="bg-sky-600 p-2.5 rounded-lg text-white hover:bg-sky-500"
                    >
                      <QrCode size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === 'booking' && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white capitalize">{selectedService} বুকিং ফরম</h2>
                <div className="space-y-3 bg-slate-800 p-4 rounded-xl">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">গন্তব্য / হোটেল নাম</label>
                    <input type="text" defaultValue="Cox's Bazar Sea Palace" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">ভ্রমণের তারিখ</label>
                    <input type="date" defaultValue="2026-08-28" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">যাত্রী সংখ্যা</label>
                    <input type="number" defaultValue="2" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white" />
                  </div>

                  <div className="border-t border-slate-700 pt-3 mt-3 flex justify-between text-xs">
                    <span className="text-slate-400">মোট মূল্য:</span>
                    <span className="font-bold text-white">BDT 12,000</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                    <span>কম্বো ডিসকাউন্ট (10%):</span>
                    <span>- BDT 1,200</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-sky-400 pt-2 border-t border-slate-700">
                    <span>পরিশোধযোগ্য:</span>
                    <span>BDT 10,800</span>
                  </div>
                </div>

                <button
                  onClick={() => setView('qr')}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs hover:bg-emerald-500 transition"
                >
                  পেমেন্ট সম্পন্ন করুন ও QR জেনারেট করুন
                </button>
              </div>
            )}

            {view === 'qr' && (
              <div className="flex flex-col items-center text-center py-6 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl border-4 border-sky-500">
                  <QRCodeSVG value={sampleBookingQR} size={200} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">আপনার সিকিউরড ডিসকাউন্ট QR</h3>
                  <p className="text-xs text-slate-400 mt-1">ভেন্ডরের কাউন্টারে এই QR কোডটি স্ক্যান করান</p>
                </div>
                <div className="bg-slate-800 p-3 rounded-xl w-full text-left text-xs space-y-1">
                  <p><span className="text-slate-400">Booking ID:</span> <span className="font-mono text-sky-400 font-bold">BKG-2024-0001</span></p>
                  <p><span className="text-slate-400">Security Hash:</span> <span className="font-mono text-slate-300">HMAC-SHA256 Verified</span></p>
                  <p><span className="text-slate-400">Combo Benefit:</span> <span className="text-emerald-400 font-bold">10% Off Hotel & Restaurant</span></p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Vendor Scanner View */}
        {role === 'vendor' && (
          <div className="space-y-6 text-center py-4">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
              <ScanLine size={48} className="mx-auto text-sky-400 mb-3 animate-pulse" />
              <h2 className="font-bold text-base text-white">ভেন্ডর QR স্ক্যানার</h2>
              <p className="text-xs text-slate-400 mt-1 mb-4">গ্রাহকের QR কোড ভেরিফাই করতে স্ক্যান বোতামে চাপুন</p>

              <button
                onClick={handleSimulateScan}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl text-xs transition"
              >
                QR কোড স্ক্যান করুন (Simulate Camera Scan)
              </button>
            </div>

            {scanResult && (
              <div className="bg-emerald-950/80 border border-emerald-500 p-4 rounded-xl text-left space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>QR Signature Verified Successfully!</span>
                </div>
                <div className="text-xs space-y-1 pt-2 border-t border-emerald-800 text-slate-300">
                  <p><span className="text-slate-400">গ্রাহকের নাম:</span> <span className="font-semibold text-white">{scanResult.user_name}</span></p>
                  <p><span className="text-slate-400">বুকিং আইডি:</span> <span className="font-mono text-sky-300">{scanResult.booking_id}</span></p>
                  <p><span className="text-slate-400">প্রযোজ্য ডিসকাউন্ট:</span> <span className="font-bold text-emerald-400">{scanResult.discountApplied}</span></p>
                  <p><span className="text-slate-400">স্ক্যান টাইম:</span> <span>{scanResult.scanned_at}</span></p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <footer className="pt-4 border-t border-slate-800 flex justify-around text-slate-400 text-xs">
        <button onClick={() => setView('home')} className={`flex flex-col items-center space-y-1 ${view === 'home' ? 'text-sky-400' : ''}`}>
          <Hotel size={18} />
          <span>Home</span>
        </button>
        <button onClick={() => setView('qr')} className={`flex flex-col items-center space-y-1 ${view === 'qr' ? 'text-sky-400' : ''}`}>
          <QrCode size={18} />
          <span>My QR</span>
        </button>
        <button onClick={() => setView('booking')} className={`flex flex-col items-center space-y-1 ${view === 'booking' ? 'text-sky-400' : ''}`}>
          <Ticket size={18} />
          <span>Bookings</span>
        </button>
      </footer>
    </div>
  );
}
