import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  ShieldCheck,
  Check,
  Server,
  Download,
  Shield,
  MessageSquare,
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function MarketplaceProductDetailView({ productId, onBack, onNavigate }) {
  const [product, setProduct] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [prod, srvList] = await Promise.all([
          DiscordAPI.getMarketplaceProductById(productId),
          DiscordAPI.getServers()
        ]);
        setProduct(prod);
        setServers(srvList || []);
        if (srvList && srvList.length > 0) {
          setSelectedServerId(srvList[0].id);
        }
      } catch (err) {
        setMsg({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (productId) loadData();
  }, [productId]);

  const handleInstall = async () => {
    if (!selectedServerId) {
      setMsg({ text: 'Please select a Discord server to install this bot.', type: 'error' });
      return;
    }
    setInstalling(true);
    setMsg(null);
    try {
      const res = await DiscordAPI.installMarketplaceProduct(productId, selectedServerId);
      setInstallSuccess(true);
      setMsg({ text: res.message || 'Bot installed successfully to server!', type: 'success' });
    } catch (err) {
      setMsg({ text: err.message || 'Failed to install bot', type: 'error' });
    } finally {
      setInstalling(false);
    }
  };

  const renderProductIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#0F2D6B] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-8 h-8 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquare className="w-8 h-8 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-xs">
            <BarChart2 className="w-8 h-8 stroke-[2]" />
          </div>
        );
      case 'trending':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="w-8 h-8 stroke-[2]" />
          </div>
        );
      case 'users':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="w-8 h-8 stroke-[2]" />
          </div>
        );
      case 'calendar':
        return (
          <div className="w-16 h-16 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-8 h-8 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-8 h-8" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        <p>Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-gray-500">Product not found in Marketplace.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F172A] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Marketplace</span>
      </button>

      {/* Product Hero Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            {renderProductIcon(product.iconType)}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                  {product.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Developed by <span className="font-semibold text-gray-800">{product.developer}</span> • {product.category}
              </p>

              <div className="flex items-center gap-3 mt-3 text-sm">
                <div className="flex items-center gap-1 font-bold text-[#0F172A]">
                  <Star className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  <span>{product.rating}</span>
                  <span className="text-gray-400 font-normal">({product.reviewsCount} reviews)</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-gray-700">{product.pricingLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Section */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs text-gray-400 block font-medium">Install to Server</span>
              {servers.length > 0 ? (
                <select
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({(Number(s.memberCount) || 0).toLocaleString()} members)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-amber-600 font-medium">No servers connected yet</span>
              )}
            </div>
          </div>

          <button
            onClick={handleInstall}
            disabled={installing || servers.length === 0 || installSuccess}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {installSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Installed</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{installing ? 'Installing...' : 'Add to Server'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Description & Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] mb-2">Overview</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#0F172A] mb-3">Key Features</h2>
            <div className="space-y-2.5">
              {(product.features || []).map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs space-y-5 h-fit">
          <h3 className="text-base font-bold text-[#0F172A]">About Developer</h3>
          <div className="space-y-3 text-xs text-gray-600">
            <div>
              <span className="text-gray-400 block font-medium">Developer</span>
              <span className="text-sm font-semibold text-[#0F172A]">{product.developer}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Category</span>
              <span className="text-sm font-semibold text-[#0F172A]">{product.category}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Rating</span>
              <span className="text-sm font-semibold text-[#0F172A]">★ {product.rating} / 5.0</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium">Verification Status</span>
              <span className="text-sm font-semibold text-green-600">✓ Security Passed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
