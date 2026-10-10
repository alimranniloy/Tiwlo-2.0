import React, { useState } from 'react';
import { PixelAudio } from './PixelSoundFx';
import { CheckCircle2, ArrowLeft, ArrowRight, Copy, Check, Terminal, Globe, Server, Shield, Sparkles, ExternalLink } from 'lucide-react';

export default function PixelClaimWizard({ claimData, onCancel, onComplete }) {
  const { name, suffix, fullDomain } = claimData;

  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState('vercel');
  const [targetValue, setTargetValue] = useState('cname.vercel-dns.com');
  const [copied, setCopied] = useState(false);
  const [activated, setActivated] = useState(false);

  const providers = [
    {
      id: 'vercel',
      name: 'Vercel',
      type: 'CNAME',
      defaultTarget: 'cname.vercel-dns.com',
      badge: 'POPULAR',
      color: '#29D8FF',
      icon: Terminal,
      hint: 'Points your custom subdomain to your Vercel deployment.'
    },
    {
      id: 'github',
      name: 'GitHub Pages',
      type: 'CNAME',
      defaultTarget: `${name || 'username'}.github.io`,
      badge: 'FREE HOSTING',
      color: '#FFD214',
      icon: Globe,
      hint: 'Point to your GitHub repository username.github.io site.'
    },
    {
      id: 'custom_ip',
      name: 'Custom IP (VPS / A Record)',
      type: 'A',
      defaultTarget: '76.76.21.21',
      badge: 'DEVELOPER',
      color: '#FF3864',
      icon: Server,
      hint: 'Direct IPv4 address to your DigitalOcean, Hetzner, or VPS.'
    },
    {
      id: 'tiwlo',
      name: 'Tiwlo Cloud Edge',
      type: 'ALIAS',
      defaultTarget: 'edge.tiwlo.app',
      badge: 'INSTANT 1-CLICK',
      color: '#2CE8A2',
      icon: Sparkles,
      hint: 'Directly linked to your Tiwlo store, API or bot container.'
    }
  ];

  const handleProviderSelect = (p) => {
    PixelAudio.playSelect();
    setProvider(p.id);
    setTargetValue(p.defaultTarget);
  };

  const handleNext = () => {
    PixelAudio.playBlip();
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      PixelAudio.playVictory();
      setActivated(true);
      setStep(3);
    }
  };

  const handleBack = () => {
    PixelAudio.playBlip();
    if (step > 1) {
      setStep(step - 1);
    } else {
      onCancel();
    }
  };

  const handleCopy = (text) => {
    PixelAudio.playCoin();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedProviderObj = providers.find((p) => p.id === provider) || providers[0];

  return (
    <div id="claim-wizard" className="max-w-3xl mx-auto my-8 bg-white border-[3.5px] border-[#181425] pixel-shadow-lg p-5 sm:p-8 font-pixel select-none animate-in fade-in zoom-in-95 duration-200">
      
      {/* Wizard Header Bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b-[2.5px] border-dashed border-[#181425]/30">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="px-2.5 py-1 bg-[#FAF7F2] hover:bg-[#FFEEC2] border-2 border-[#181425] text-[10px] text-[#181425] cursor-pointer flex items-center gap-1 pixel-shadow-sm"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>BACK</span>
          </button>
          <span className="text-[11px] text-[#181425]">
            CLAIM WIZARD • QUEST STEP {step}/3
          </span>
        </div>

        <span className="text-[9px] bg-[#FFD214] border-2 border-[#181425] px-2 py-0.5 text-[#181425]">
          TARGET: {fullDomain}
        </span>
      </div>

      {/* Step 1: Destination Provider Selection */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm sm:text-base text-[#181425] mb-1">
              STEP 1: WHERE WOULD YOU LIKE TO POINT {fullDomain}?
            </h2>
            <p className="font-pixel-sub text-[11px] text-[#5A5766]">
              Choose where your subdomain routes traffic. You can update this anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {providers.map((p) => {
              const Icon = p.icon;
              const isSelected = provider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleProviderSelect(p)}
                  className={`p-4 border-[3px] border-[#181425] cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFEEC2] pixel-shadow translate-x-[-2px] translate-y-[-2px]'
                      : 'bg-[#FAF7F2] hover:bg-white pixel-shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-pixel px-1.5 py-0.5 border border-[#181425] bg-white text-[#181425]">
                      {p.type} RECORD
                    </span>
                    <span className="text-[8px] font-pixel text-[#5A5766]">
                      {p.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-6 h-6 border-2 border-[#181425] flex items-center justify-center"
                      style={{ backgroundColor: p.color }}
                    >
                      <Icon className="w-3.5 h-3.5 text-[#181425]" />
                    </div>
                    <span className="text-xs text-[#181425] font-bold">{p.name}</span>
                  </div>

                  <p className="font-pixel-sub text-[10px] text-[#5A5766]">
                    {p.hint}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-[#2CE8A2] hover:bg-[#1FD691] text-[#181425] pixel-btn text-xs flex items-center gap-2 cursor-pointer"
            >
              <span>CONTINUE TO DNS SETUP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure Record Target */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm sm:text-base text-[#181425] mb-1">
              STEP 2: CONFIGURE {selectedProviderObj.type} TARGET VALUE
            </h2>
            <p className="font-pixel-sub text-[11px] text-[#5A5766]">
              Enter the target hostname or IP address provided by {selectedProviderObj.name}.
            </p>
          </div>

          {/* Form Input */}
          <div className="p-4 bg-[#FAF7F2] border-[2.5px] border-[#181425] pixel-shadow-sm space-y-3">
            <div>
              <label className="block text-[10px] text-[#181425] mb-1.5">
                SUBDOMAIN HOSTNAME:
              </label>
              <input
                type="text"
                disabled
                value={fullDomain}
                className="w-full px-3 py-2 bg-[#EFECE6] border-2 border-[#181425] text-xs text-[#181425] font-mono cursor-not-allowed opacity-90"
              />
            </div>

            <div>
              <label className="block text-[10px] text-[#181425] mb-1.5">
                {selectedProviderObj.type} RECORD DESTINATION:
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. cname.vercel-dns.com or 76.76.21.21"
                className="w-full px-3 py-2 bg-white border-2 border-[#181425] text-xs text-[#181425] font-mono focus:outline-none focus:border-[#29D8FF]"
              />
              <span className="text-[9px] font-pixel-sub text-[#5A5766] mt-1 block">
                Anycast TTL will be set to 60 seconds (Auto-propagation).
              </span>
            </div>
          </div>

          <div className="p-3 bg-[#E7F9F0] border-2 border-[#2CE8A2] text-[#0A5C36] text-[10px] font-pixel-sub flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2CE8A2]" />
            <span>Wildcard SSL Certificate will be provisioned automatically on edge dispatch.</span>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="px-4 py-2.5 bg-white border-2 border-[#181425] pixel-shadow-sm text-[10px] text-[#181425] cursor-pointer"
            >
              ← BACK
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-[#FFD214] hover:bg-[#FFC000] text-[#181425] pixel-btn text-xs flex items-center gap-2 cursor-pointer"
            >
              <span>LOCK IN & ACTIVATE SUBDOMAIN ★</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success & Activated DNS Records */}
      {step === 3 && (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 mx-auto bg-[#2CE8A2] border-[3px] border-[#181425] pixel-shadow flex items-center justify-center font-pixel text-2xl text-[#181425] animate-pixel-float">
            ★
          </div>

          <div>
            <h2 className="text-base sm:text-lg text-[#181425] mb-2">
              VICTORY! {fullDomain} IS CLAIMED!
            </h2>
            <p className="font-pixel-sub text-xs text-[#5A5766] max-w-md mx-auto">
              Your free pixel subdomain is now actively broadcasting across the global Anycast edge network.
            </p>
          </div>

          {/* DNS Table Container */}
          <div className="p-4 bg-[#FAF7F2] border-[3px] border-[#181425] pixel-shadow-sm text-left font-pixel-mono text-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-dashed border-[#181425]/30">
              <span className="font-pixel text-[10px] text-[#181425]">ACTIVE DNS CONFIGURATION:</span>
              <button
                onClick={() => handleCopy(`${fullDomain} ${selectedProviderObj.type} ${targetValue}`)}
                className="px-2 py-1 bg-white border border-[#181425] text-[9px] font-pixel text-[#181425] flex items-center gap-1 cursor-pointer hover:bg-[#FFEEC2]"
              >
                {copied ? <Check className="w-3 h-3 text-[#2CE8A2]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED!' : 'COPY RECORDS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[10px] text-[#5A5766] border-b border-[#181425]/20 pb-1 mb-2">
              <span>TYPE</span>
              <span>HOST</span>
              <span>VALUE</span>
              <span className="text-right">TTL</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[11px] font-bold text-[#181425]">
              <span className="text-[#FF3864]">{selectedProviderObj.type}</span>
              <span className="truncate">{name}</span>
              <span className="truncate text-[#29D8FF]">{targetValue}</span>
              <span className="text-right text-[#2CE8A2]">60s</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://${fullDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-[#2CE8A2] hover:bg-[#1FD691] text-[#181425] pixel-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>VISIT HTTPS://{fullDomain}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border-[2.5px] border-[#181425] pixel-shadow-sm hover:bg-[#FAF7F2] text-xs text-[#181425] cursor-pointer"
            >
              CLAIM ANOTHER SUBDOMAIN +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
