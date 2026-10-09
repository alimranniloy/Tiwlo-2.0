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
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Automations</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Community Automations
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Configure greeting triggers, automated role assignment, and command responders.
        </p>
      </div>

      {/* 2. Google Cloud Horizontal Tabs */}
      <div className="flex border-b border-[#DADCE0] gap-6 text-[13px]">
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
              className={`pb-3 font-medium cursor-pointer transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === t.id
                  ? 'border-[#1A73E8] text-[#1A73E8]'
                  : 'border-transparent text-[#5F6368] hover:text-[#202124]'
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
        <div className="p-3.5 rounded-lg bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[13px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* 3. Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        {activeTab === 'welcome' && (
          <>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#202124]">
                Announcement Channel
              </label>
              <input
                type="text"
                value={welcomeChannel}
                onChange={(e) => setWelcomeChannel(e.target.value)}
                placeholder="#welcome"
                className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#202124]">
                Greeting Template
              </label>
              <textarea
                rows="4"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              />
              <p className="text-[11px] text-[#5F6368]">Use {'{user}'} to mention the joining account, and {'{server}'} for guild name.</p>
            </div>
          </>
        )}

        {activeTab === 'auto-roles' && (
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Default Role for New Members
            </label>
            <input
              type="text"
              value={autoRoleName}
              onChange={(e) => setAutoRoleName(e.target.value)}
              placeholder="Member"
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            />
            <p className="text-[11px] text-[#5F6368]">Automatically assigned upon joining after Discord verification.</p>
          </div>
        )}

        {activeTab === 'commands' && (
          <>
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#202124]">
                Command Trigger
              </label>
              <input
                type="text"
                value={commandPrefix}
                onChange={(e) => setCommandPrefix(e.target.value)}
                placeholder="!help"
                className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#202124]">
                Bot Response
              </label>
              <textarea
                rows="3"
                value={commandResponse}
                onChange={(e) => setCommandResponse(e.target.value)}
                className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
          </>
        )}

        <div className="pt-4 border-t border-[#F1F3F4] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs disabled:opacity-50"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Automation</span>
          </button>
        </div>
      </form>
    </div>
  );
}
