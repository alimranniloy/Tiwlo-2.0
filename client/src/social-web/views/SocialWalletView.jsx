import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Send, Sparkles, CheckCircle2, History } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-tr from-[#1E293B] via-[#0F172A] to-[#0B57D0] p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#8AB4F8]" />
            </div>
            <div>
              <span className="text-xs text-gray-300">Tiwi Social Balance</span>
              <div className="text-xs font-bold text-[#8AB4F8]">Verified Digital Wallet</div>
            </div>
          </div>
          <span className="text-xs font-mono bg-white/10 px-3 py-1 rounded-full">TIWI-COIN</span>
        </div>

        <div>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {wallet.balance || 450} <span className="text-sm font-semibold text-gray-300">Coins</span>
          </div>
          <p className="text-xs text-gray-300 mt-1">≈ ${( (wallet.balance || 450) * 0.1 ).toFixed(2)} USD Estimated Value</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => showToast('Coin top-up gateway active', 'info')}
            className="flex-1 bg-[#0B57D0] hover:bg-[#0842A0] text-white py-2.5 rounded-full text-xs font-bold text-center transition-colors shadow-xs"
          >
            + Top Up Coins
          </button>
          <button
            onClick={() => showToast('Creator cashout requested', 'info')}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-full text-xs font-bold text-center transition-colors"
          >
            Withdraw to Bank
          </button>
        </div>
      </div>

      {/* Tip Creator Card */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-4">
        <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-[#0B57D0]" />
          Tip a Creator or Friend
        </h3>

        <form onSubmit={handleSendTip} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-[#F1F3F4] dark:bg-[#111827] rounded-2xl px-4 py-2 flex items-center">
              <span className="text-xs text-gray-400 mr-1">@</span>
              <input
                type="text"
                placeholder="creator_handle"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-transparent text-xs text-[#1F1F1F] dark:text-white focus:outline-none"
              />
            </div>

            <div className="w-full sm:w-36 bg-[#F1F3F4] dark:bg-[#111827] rounded-2xl px-4 py-2 flex items-center">
              <input
                type="number"
                placeholder="Coins"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-xs text-[#1F1F1F] dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={tipping || !recipient.trim() || !amount}
            className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white py-2.5 rounded-full text-xs font-bold shadow-xs transition-all w-full"
          >
            {tipping ? 'Sending Tip...' : 'Send Coins'}
          </button>
        </form>
      </div>

      {/* Transactions History */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-3">
        <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white flex items-center gap-2">
          <History className="w-4 h-4 text-[#0B57D0]" />
          Recent Transactions
        </h3>

        <div className="flex flex-col gap-2 pt-1">
          {(wallet.transactions?.length > 0 ? wallet.transactions : [
            { type: 'tip_sent', recipient: 'alex_r', amount: 50, createdAt: 'Yesterday' },
            { type: 'reward', recipient: 'Welcome Bonus', amount: 500, createdAt: '3 days ago' },
          ]).map((tx, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#111827] text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-[#0B57D0]">
                  {tx.type === 'tip_sent' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-[#1F1F1F] dark:text-white">
                    {tx.type === 'tip_sent' ? `Tip sent to @${tx.recipient}` : 'Tiwi Community Reward'}
                  </div>
                  <div className="text-[11px] text-gray-400">{tx.createdAt}</div>
                </div>
              </div>
              <span className={`font-bold ${tx.type === 'tip_sent' ? 'text-red-500' : 'text-emerald-500'}`}>
                {tx.type === 'tip_sent' ? `-${tx.amount}` : `+${tx.amount}`} Coins
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
