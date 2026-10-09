import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, UserCheck, Terminal, Save, CheckCircle2, RotateCw } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function AutomationsView({ initialTab = 'welcome', onNavigate }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to our community, {user}! Please check the rules.');
  const [welcomeChannel, setWelcomeChannel] = useState('#welcome');
  const [autoRoleName, setAutoRoleName] = useState('Member');
  const [commandPrefix, setCommandPrefix] = useState('!help');
  const [commandResponse, setCommandResponse] = useState('For assistance, open a ticket or visit our support portal.');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      if (activeTab === 'welcome') {
        await DiscordAPI.saveAutomation({
          type: 'welcome',
          title: 'Welcome Messages Automation',
          config: { message: welcomeMessage, channel: welcomeChannel }
        });
      } else if (activeTab === 'auto-roles') {
        await DiscordAPI.saveAutomation({
          type: 'autorole',
          title: 'Auto Roles Assignment',
          config: { defaultRole: autoRoleName }
        });
      } else {
        await DiscordAPI.saveAutomation({
          type: 'custom_command',
          title: `Command: ${commandPrefix}`,
          config: { trigger: commandPrefix, response: commandResponse }
        });
      }
      setSavedMsg('Automation rule synchronized and deployed.');
    } catch (err) {
      setSavedMsg(err.message || 'Error saving automation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Automations</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Community Automations
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Configure greeting triggers, automated role assignment, and command responders.
        </p>
      </div>

      {/* 2. Modern Google Material 3 Pill Tabs */}
      <div className="flex gap-2 text-[13px] pb-1">
        {[
          { id: 'welcome', label: 'Welcome Messages', icon: MessageSquare },
          { id: 'auto-roles', label: 'Auto Roles', icon: UserCheck },
          { id: 'commands', label: 'Custom Commands', icon: Terminal }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-full font-medium cursor-pointer transition-colors flex items-center gap-2 ${
                activeTab === t.id
                  ? 'bg-[#C2E7FF] text-[#001D35]'
                  : 'text-[#444746] hover:bg-[#F0F4F9]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {savedMsg && (
        <div className="p-4 rounded-2xl bg-[#C4EED0]/30 border border-[#C4EED0] text-[#072711] text-[13px] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* 3. Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        {activeTab === 'welcome' && (
          <>
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#1F1F1F]">
                Announcement Channel
              </label>
              <input
                type="text"
                value={welcomeChannel}
                onChange={(e) => setWelcomeChannel(e.target.value)}
                placeholder="#welcome"
                className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#1F1F1F]">
                Greeting Template
              </label>
              <textarea
                rows="4"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
              />
              <p className="text-[11px] text-[#747775]">Use {'{user}'} to mention the joining account, and {'{server}'} for guild name.</p>
            </div>
          </>
        )}

        {activeTab === 'auto-roles' && (
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Default Role for New Members
            </label>
            <input
              type="text"
              value={autoRoleName}
              onChange={(e) => setAutoRoleName(e.target.value)}
              placeholder="Member"
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            />
            <p className="text-[11px] text-[#747775]">Automatically assigned upon joining after Discord verification.</p>
          </div>
        )}

        {activeTab === 'commands' && (
          <>
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#1F1F1F]">
                Command Trigger
              </label>
              <input
                type="text"
                value={commandPrefix}
                onChange={(e) => setCommandPrefix(e.target.value)}
                placeholder="!help"
                className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-[#1F1F1F]">
                Bot Response
              </label>
              <textarea
                rows="3"
                value={commandResponse}
                onChange={(e) => setCommandResponse(e.target.value)}
                className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
              />
            </div>
          </>
        )}

        <div className="pt-4 border-t border-[#F0F4F9] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Automation</span>
          </button>
        </div>
      </form>
    </div>
  );
}
