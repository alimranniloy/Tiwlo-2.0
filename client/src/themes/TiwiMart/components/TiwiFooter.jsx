import React from 'react';
import { ShoppingCart, Mail, MapPin, Phone } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function TiwiFooter() {
  const { storeSettings } = useStoreSettings();
  const storeName = storeSettings?.storeName || 'Your Store';
  const address = [
    storeSettings?.storeAddress,
    storeSettings?.storeCity,
    storeSettings?.storeCountry,
    storeSettings?.storePostalCode
  ].filter(Boolean).join(', ');

  return (
    <footer className="bg-[#0b1329] text-[#94a3b8] text-xs pt-8 pb-6 border-t border-slate-800 mt-10">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 space-y-5">
        <div className="flex items-center space-x-2">
          {storeSettings?.storeLogo ? (
            <img src={storeSettings.storeLogo} alt="" className="h-8 max-w-32 object-contain" />
          ) : (
            <ShoppingCart className="w-5 h-5 text-[#38bdf8]" />
          )}
          <span className="text-lg font-black text-white">{storeName}</span>
        </div>
        {(storeSettings?.contactEmail || storeSettings?.contactPhone || address) && (
          <address className="not-italic flex flex-wrap gap-5">
            {address && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />{address}
              </span>
            )}
            {storeSettings.contactEmail && (
              <a href={`mailto:${storeSettings.contactEmail}`} className="inline-flex items-center gap-2 hover:text-white">
                <Mail className="w-3.5 h-3.5" />{storeSettings.contactEmail}
              </a>
            )}
            {storeSettings.contactPhone && (
              <a href={`tel:${storeSettings.contactPhone}`} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="w-3.5 h-3.5" />{storeSettings.contactPhone}
              </a>
            )}
          </address>
        )}
        <p className="pt-4 border-t border-slate-800/80">
          © {new Date().getFullYear()} {storeName}
        </p>
      </div>
    </footer>
  );
}
