import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, UserCheck, Terminal, Save, CheckCircle2 } from 'lucide-react';
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
      setSavedMsg('Automation saved successfully!');
    } catch (err) {
      setSavedMsg(err.message || 'Error saving automation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#0F172A] transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Workspace Overview</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Automations
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure greeting messages, auto-assigned roles, and custom command responses for your bots.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('welcome')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'welcome'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Welcome Messages</span>
        </button>
        <button
          onClick={() => setActiveTab('auto-roles')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'auto-roles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Auto Roles</span>
        </button>
        <button
          onClick={() => setActiveTab('commands')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'commands'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Custom Commands</span>
        </button>
      </div>

      {savedMsg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {activeTab === 'welcome' && (
          <>
            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                Greeting Channel
              </label>
              <input
                type="text"
                value={welcomeChannel}
                onChange={(e) => setWelcomeChannel(e.target.value)}
                placeholder="#welcome"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Channel where the bot announces new joiners.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                Welcome Message Template
              </label>
              <textarea
                rows={4}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Available variables: {'{user}'}, {'{server}'}, {'{count}'}.</p>
            </div>
          </>
        )}

        {activeTab === 'auto-roles' && (
          <>
            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                Default Member Role
              </label>
              <input
                type="text"
                value={autoRoleName}
                onChange={(e) => setAutoRoleName(e.target.value)}
                placeholder="e.g. Member, Verified Community"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Role automatically assigned when a new user joins.</p>
            </div>
          </>
        )}

        {activeTab === 'commands' && (
          <>
            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                Trigger Command
              </label>
              <input
                type="text"
                value={commandPrefix}
                onChange={(e) => setCommandPrefix(e.target.value)}
                placeholder="!help"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
                Bot Response
              </label>
              <textarea
                rows={4}
                value={commandResponse}
                onChange={(e) => setCommandResponse(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Automation'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
