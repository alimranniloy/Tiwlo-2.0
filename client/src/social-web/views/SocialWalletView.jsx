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
      <div className="bg-[#1a73e8] p-6 sm:p-8 rounded-lg text-white shadow-sm flex flex-col justify-between gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-md bg-white/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xs text-blue-100 font-medium">Tiwi Social Balance</span>
              <div className="text-xs font-bold text-white">Verified Digital Wallet</div>
            </div>
          </div>
          <span className="text-xs font-mono bg-white/15 px-3 py-1 rounded-md">TIWI-COIN</span>
        </div>

        <div>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {wallet.balance || 450} <span className="text-sm font-semibold text-blue-100">Coins</span>
          </div>
          <p className="text-xs text-blue-100 mt-1">≈ ${( (wallet.balance || 450) * 0.1 ).toFixed(2)} USD Estimated Value</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => showToast('Coin top-up gateway active', 'info')}
            className="flex-1 bg-white hover:bg-blue-50 text-[#1a73e8] py-2.5 rounded-md text-xs font-bold text-center transition-colors shadow-xs cursor-pointer"
          >
            + Top Up Coins
          </button>
          <button
            onClick={() => showToast('Creator cashout requested', 'info')}
            className="flex-1 bg-white/15 hover:bg-white/25 text-white py-2.5 rounded-md text-xs font-bold text-center transition-colors cursor-pointer"
          >
            Withdraw to Bank
          </button>
        </div>
      </div>

      {/* Tip Creator Card */}
      <div className="bg-white dark:bg-[#202124] p-6 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex flex-col gap-4">
        <h3 className="font-bold text-sm text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
          <Send className="w-4 h-4 text-[#1a73e8]" />
          Tip a Creator or Friend
        </h3>

        <form onSubmit={handleSendTip} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-[#f8f9fa] dark:bg-[#303134] rounded-md px-3 py-2 flex items-center border border-[#dadce0] dark:border-[#5f6368] focus-within:border-[#1a73e8]">
              <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mr-1">@</span>
              <input
                type="text"
                placeholder="creator_handle"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-transparent text-xs text-[#202124] dark:text-[#e8eaed] focus:outline-none"
              />
            </div>

            <div className="w-full sm:w-36 bg-[#f8f9fa] dark:bg-[#303134] rounded-md px-3 py-2 flex items-center border border-[#dadce0] dark:border-[#5f6368] focus-within:border-[#1a73e8]">
              <input
                type="number"
                placeholder="Coins"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-xs text-[#202124] dark:text-[#e8eaed] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={tipping || !recipient.trim() || !amount}
            className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white py-2.5 rounded-md text-xs font-bold shadow-xs transition-all w-full cursor-pointer"
          >
            {tipping ? 'Sending Tip...' : 'Send Coins'}
          </button>
        </form>
      </div>

      {/* Transactions History */}
      <div className="bg-white dark:bg-[#202124] p-6 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex flex-col gap-3">
        <h3 className="font-bold text-sm text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
          <History className="w-4 h-4 text-[#1a73e8]" />
          Recent Transactions
        </h3>

        <div className="flex flex-col gap-2 pt-1">
          {(wallet.transactions?.length > 0 ? wallet.transactions : [
            { type: 'tip_sent', recipient: 'alex_r', amount: 50, createdAt: 'Yesterday' },
            { type: 'reward', recipient: 'Welcome Bonus', amount: 500, createdAt: '3 days ago' },
          ]).map((tx, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-[#f8f9fa] dark:bg-[#303134] text-xs border border-[#dadce0]/60 dark:border-[#3c4043]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#e8f0fe] dark:bg-[#174ea6] flex items-center justify-center text-[#1a73e8]">
                  {tx.type === 'tip_sent' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-[#202124] dark:text-[#e8eaed]">
                    {tx.type === 'tip_sent' ? `Tip sent to @${tx.recipient}` : 'Tiwi Community Reward'}
                  </div>
                  <div className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">{tx.createdAt}</div>
                </div>
              </div>
              <span className={`font-bold ${tx.type === 'tip_sent' ? 'text-[#d93025]' : 'text-[#188038]'}`}>
                {tx.type === 'tip_sent' ? `-${tx.amount}` : `+${tx.amount}`} Coins
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
