import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Sparkles,
  CheckCircle2,
  History,
  Coins,
  CreditCard,
  Plus
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SocialWalletView() {
  const { currentUser, showToast } = useSocial();
  const [wallet, setWallet] = useState({ balance: 450, transactions: [] });
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tipping, setTipping] = useState(false);

  useEffect(() => {
    TiwiSocialAPI.getWallet(currentUser?.id).then((data) => {
      if (data) setWallet(data);
    });
  }, [currentUser?.id]);

  const handleSendTip = async (e) => {
    e.preventDefault();
    const val = parseInt(amount, 10);
    if (!recipient.trim() || isNaN(val) || val <= 0) {
      showToast('Please enter a valid creator handle and amount', 'error');
      return;
    }
    if (val > (wallet.balance || 0)) {
      showToast('Insufficient wallet coin balance', 'error');
      return;
    }

    setTipping(true);
    try {
      await TiwiSocialAPI.tipCreator(
        { recipientId: recipient.trim(), amount: val },
        currentUser?.id
      );
      setWallet((prev) => ({
        ...prev,
        balance: prev.balance - val,
        transactions: [
          {
            id: `tx_${Date.now()}`,
            type: 'tip_sent',
            recipient: recipient.trim(),
            amount: val,
            createdAt: 'Just now'
          },
          ...(prev.transactions || [])
        ]
      }));
      setRecipient('');
      setAmount('');
      showToast(`Successfully tipped ${val} Tiwi Coins to @${recipient}!`, 'info');
    } catch (e) {
      showToast('Tip failed', 'error');
    } finally {
      setTipping(false);
    }
  };

  const sampleTxs = wallet.transactions?.length > 0 ? wallet.transactions : [
    { id: 't1', type: 'reward', title: 'Stream Activity Bonus', amount: 50, createdAt: 'Yesterday' },
    { id: 't2', type: 'tip_received', title: 'Tip from @alex_r', amount: 100, createdAt: '2 days ago' },
    { id: 't3', type: 'topup', title: 'Wallet Top Up', amount: 300, createdAt: '1 week ago' },
  ];

  return (
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20 space-y-5">
      {/* 1. FinTech Card Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-7 text-white shadow-xl shadow-violet-500/20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-300" />
            </div>
            <span className="font-bold text-sm tracking-wide">Tiwi Creator Wallet</span>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md">
            Active
          </span>
        </div>

        <div>
          <span className="text-white/80 text-xs uppercase tracking-wider font-semibold">Available Balance</span>
          <div className="text-4xl font-extrabold tracking-tight mt-1 flex items-baseline gap-2">
            <span>{wallet.balance?.toLocaleString() || 450}</span>
            <span className="text-lg font-medium text-amber-300">Tiwi Coins</span>
          </div>
          <span className="text-white/70 text-xs mt-1 block">≈ ${(wallet.balance * 0.1).toFixed(2)} USD value</span>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <button
            onClick={() => {
              setWallet((prev) => ({ ...prev, balance: prev.balance + 100 }));
              showToast('Added 100 Tiwi Coins to wallet', 'info');
            }}
            className="flex-1 py-2.5 rounded-xl bg-white text-violet-900 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md hover:bg-white/90 transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Top Up Coins</span>
          </button>

          <button
            onClick={() => showToast('Payout request initiated. Processed in 24 hours.', 'info')}
            className="flex-1 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-1.5 backdrop-blur-md transition cursor-pointer active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* 2. Direct Tip Composer Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm">
        <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
          Tip a Creator
        </h3>
        <p className="text-[12.5px] text-[#65676b] dark:text-[#8a8d91] mb-4">
          Support your favorite voices on Tiwi directly with instant coin transfers.
        </p>

        <form onSubmit={handleSendTip} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1">
                Creator Handle
              </label>
              <div className="flex items-center h-11 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl px-3.5 border border-black/[0.05] dark:border-white/[0.08] focus-within:ring-2 focus-within:ring-violet-500/30">
                <span className="text-[#65676b] text-sm mr-1">@</span>
                <input
                  type="text"
                  placeholder="handle"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="bg-transparent text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none w-full"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1">
                Amount (Coins)
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3.5 bg-black/[0.03] dark:bg-white/[0.05] rounded-xl border border-black/[0.05] dark:border-white/[0.08] text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>

          {/* Quick amount presets */}
          <div className="flex items-center gap-2 pt-1">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className="px-3 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] hover:bg-violet-500/10 text-xs font-semibold text-[#65676b] dark:text-[#8a8d91] hover:text-violet-600 transition cursor-pointer"
              >
                +{preset}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={tipping}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[13px] shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <Send className="w-4 h-4" />
            <span>{tipping ? 'Sending Tip...' : 'Send Coin Tip'}</span>
          </button>
        </form>
      </div>

      {/* 3. Transaction History */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[15px] text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-2">
            <History className="w-4 h-4 text-violet-500" />
            <span>Transaction Activity</span>
          </h3>
        </div>

        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
          {sampleTxs.map((tx) => (
            <div key={tx.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  tx.type === 'tip_sent'
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {tx.type === 'tip_sent' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>

                <div>
                  <span className="font-semibold text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] block">
                    {tx.title || `Tip to @${tx.recipient}`}
                  </span>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                    {tx.createdAt}
                  </span>
                </div>
              </div>

              <span className={`font-bold text-[14px] ${
                tx.type === 'tip_sent' ? 'text-rose-500' : 'text-emerald-500'
              }`}>
                {tx.type === 'tip_sent' ? '-' : '+'}{tx.amount} Coins
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
