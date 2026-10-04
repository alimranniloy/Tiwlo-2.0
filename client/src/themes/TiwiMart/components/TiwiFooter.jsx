import React from 'react';
import { ShoppingCart, Mail, Globe, ShieldCheck, Phone, MapPin } from 'lucide-react';

export default function TiwiFooter() {
  return (
    <footer className="bg-[#0b1329] text-[#94a3b8] text-xs pt-12 pb-8 border-t border-slate-800 mt-10">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-10">
        {/* Top 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-6 h-6 text-[#38bdf8]" />
              <span className="text-xl font-black text-white tracking-tight">
                Tiwlo<span className="text-[#38bdf8]">Mart</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Global marketplace connecting millions of verified sellers and discerning buyers worldwide. Secure transactions, fast fulfillment, and round-the-clock buyer protection.
            </p>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Sector 4, Dhaka Logistics Zone & Silicon Global Port</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>+1 (800) 555-STOCK / +880 1700 000000</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>support@tiwlomart.com</span>
              </div>
            </div>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Customer Care
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#help" className="hover:text-white transition">Help Center</a></li>
              <li><a href="#track" className="hover:text-white transition">Track Your Order</a></li>
              <li><a href="#refunds" className="hover:text-white transition">Returns & Refunds</a></li>
              <li><a href="#shipping" className="hover:text-white transition">Shipping Info</a></li>
              <li><a href="#protection" className="hover:text-white transition">Buyer Protection</a></li>
            </ul>
          </div>

          {/* Sell on TiwloMart */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Sell on TiwloMart
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#seller" className="hover:text-white transition">Become a Verified Seller</a></li>
              <li><a href="#dropship" className="hover:text-white transition">Dropshipping Program</a></li>
              <li><a href="#wholesale" className="hover:text-white transition">Wholesale Inquiries</a></li>
              <li><a href="#affiliate" className="hover:text-white transition">Affiliate Program</a></li>
              <li><a href="#seller-hub" className="hover:text-white transition">Seller Central</a></li>
            </ul>
          </div>

          {/* Quick Newsletter */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-xs uppercase tracking-wider">
              Stay in the Loop
            </h4>
            <p className="text-[11px] text-slate-400">
              Subscribe for exclusive flash sales, newly arrived tech, and seasonal coupons.
            </p>
            <div className="flex rounded-xl overflow-hidden border border-slate-700">
              <input
                type="email"
                placeholder="Enter email address"
                className="bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none flex-1"
              />
              <button className="bg-[#2563eb] text-white px-3.5 py-2 font-bold hover:bg-blue-600 transition">
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
          <p>© {new Date().getFullYear()} TiwloMart Global. All rights reserved. Powered by Tiwlo Platform.</p>
          <div className="flex items-center space-x-4">
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer">Security Standards</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
