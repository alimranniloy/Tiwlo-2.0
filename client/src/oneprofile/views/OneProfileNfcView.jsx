import React, { useState } from 'react';
import { CreditCard, Wifi, QrCode, Check, ShieldCheck, Truck, Sparkles } from 'lucide-react';
import UidisLogoIcon from '../components/UidisLogoIcon';

export default function OneProfileNfcView() {
  const [cardColor, setCardColor] = useState('matte-black');
  const [customName, setCustomName] = useState('John Doe');

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">NFC Business Cards</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Order your smart contactless NFC card and share your UIDs profile with a single tap.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Card Customization & Order Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <h3 className="text-base font-extrabold text-slate-900">Customise Your Card</h3>

          {/* Card Finish */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">Select Finish</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'matte-black', label: 'Matte Black', bg: 'bg-slate-950 text-white' },
                { id: 'pure-white', label: 'Pure White', bg: 'bg-slate-100 text-slate-900' },
                { id: 'metallic-silver', label: 'Metallic Silver', bg: 'bg-gradient-to-r from-slate-200 to-slate-400 text-slate-900' },
              ].map((finish) => (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => setCardColor(finish.id)}
                  className={`p-3 rounded-xl border text-center transition ${
                    cardColor === finish.id
                      ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg mx-auto mb-1.5 ${finish.bg} shadow-2xs`} />
                  <div className="text-xs font-bold text-slate-800">{finish.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name on Card */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Printed Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Linked Target */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs">
            <span className="font-bold text-blue-900">Linked Profile: </span>
            <span className="font-mono text-blue-700 font-semibold">https://john.uids.app</span>
            <p className="text-[11px] text-blue-600/80 mt-1">Whenever anyone taps your NFC card with an iPhone or Android, your live digital profile opens instantly.</p>
          </div>

          {/* Perks */}
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Embedded NTAG216 high-density NFC chip</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Waterproof matte polycarbonate finish</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Worldwide express shipping with live tracking</span>
            </li>
          </ul>

          <button
            type="button"
            className="w-full py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition"
          >
            Order NFC Card &bull; $29 USD
          </button>
        </div>

        {/* Right: Live Interactive Card Mockup Preview */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 rounded-2xl border border-slate-200/90 p-6 flex flex-col items-center justify-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Preview</div>

          {/* 3D Physical Card Mockup */}
          <div className={`w-full max-w-[280px] h-44 rounded-2xl p-5 shadow-2xl flex flex-col justify-between transition-all duration-300 ${
            cardColor === 'matte-black'
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white shadow-black/30'
              : cardColor === 'pure-white'
              ? 'bg-white text-slate-900 border border-slate-200 shadow-slate-300/40'
              : 'bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-400 text-slate-900 shadow-slate-400/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <UidisLogoIcon className="w-5 h-5" />
                <span className="text-xs font-extrabold tracking-tight">UIDs.app</span>
              </div>
              <Wifi className="w-4 h-4 rotate-90 opacity-70" />
            </div>

            <div className="my-auto py-1">
              <div className="text-base font-extrabold tracking-wide">{customName || 'Your Name'}</div>
              <div className="text-[10px] opacity-70 font-mono">john.uids.app</div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">Tap to connect</span>
              <QrCode className="w-6 h-6 opacity-80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
