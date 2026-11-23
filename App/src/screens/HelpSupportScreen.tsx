import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Send,
  Ticket,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import {
  convertSupportToTicket,
  initiateSupportConversation,
  sendSupportMessage,
  SupportChatMessage,
} from '../services/tiwloAccount';
import { colors } from '../theme/tokens';

interface HelpSupportScreenProps {
  sessionToken?: string;
  onBack: () => void;
}

type SupportTab = 'chat' | 'ticket' | 'faq';

const FAQ_ITEMS = [
  {
    q: 'How do I link a custom domain to my Tiwlo Store?',
    a: 'Open Cloud -> Domains, add your domain name, point your DNS A record to your workspace IP, and SSL activates automatically.',
  },
  {
    q: 'What happens when a droplet snapshot is created?',
    a: 'Snapshots capture point-in-time block storage images that you can clone into new regions or restore immediately.',
  },
  {
    q: 'How are Cloud Credits & Vouchers applied?',
    a: 'Promotional credits apply before cash credits on hourly compute and storefront renewals.',
  },
  {
    q: 'How can I recover my account if I lose 2FA access?',
    a: 'Use any saved Recovery Code during sign-in or open a support ticket with your Tiwi ID.',
  },
];

const CATEGORIES = ['Cloud Droplets', 'Online Store', 'Billing & Credits', 'Domains & SSL', 'Security'];
const PRIORITIES = ['Normal', 'High', 'Urgent'];

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({
  sessionToken,
  onBack,
}) => {
  const [tab, setTab] = useState<SupportTab>('chat');
  const [sessionId, setSessionId] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<SupportChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Send a message below for help with droplets, stores, billing, or security.',
      time: 'Now',
    },
  ]);

  const [ticketCategory, setTicketCategory] = useState('Cloud Droplets');
  const [ticketPriority, setTicketPriority] = useState('Normal');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const handleSendChat = async () => {
    const clean = chatInput.trim();
    if (!clean) return;
    setChatInput('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: clean, time: 'Just now' },
    ]);

    try {
      let sid = sessionId;
      let reply = '';
      if (!sid) {
        const initRes = await initiateSupportConversation(
          { subject: clean.slice(0, 60), category: ticketCategory, message: clean },
          sessionToken
        );
        sid = initRes.sessionId || initRes.conversationId || `sess-${Date.now()}`;
        setSessionId(sid);
        reply = initRes.reply || 'Support thread created.';
      } else {
        const msgRes = await sendSupportMessage({ sessionId: sid, message: clean }, sessionToken);
        reply = msgRes.reply || 'Message sent.';
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, sender: 'agent', text: reply, time: 'Just now' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          sender: 'system',
          text: 'Unable to send right now. Sign in or check connection.',
          time: 'Retry',
        },
      ]);
    }
  };

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketBody.trim()) {
      setBannerTone('error');
      setBanner('Enter ticket subject and description.');
      return;
    }
    try {
      const init = await initiateSupportConversation(
        {
          subject: ticketSubject.trim(),
          category: ticketCategory,
          message: ticketBody.trim(),
        },
        sessionToken
      );
      const sid = init.sessionId || init.conversationId;
      if (sid) {
        await convertSupportToTicket(
          sid,
          { subject: ticketSubject.trim(), priority: ticketPriority.toLowerCase() },
          sessionToken
        );
      }
      setTicketSubject('');
      setTicketBody('');
      setBannerTone('success');
      setBanner('Support ticket submitted.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Unable to submit ticket.');
    }
  };

  return (
    <AccountPageShell
      title="Help & Support"
      onBack={onBack}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Segmented Tabs */}
      <View style={styles.segmentWrap}>
        {(
          [
            { key: 'chat', label: 'Messages' },
            { key: 'ticket', label: 'New Ticket' },
            { key: 'faq', label: 'FAQ' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentPill, active && styles.segmentPillActive]}
              onPress={() => setTab(item.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'chat' && (
        <View style={styles.section}>
          <View style={styles.chatThread}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <View
                  key={msg.id}
                  style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}
                >
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                  <Text style={styles.bubbleTime}>{msg.time}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Write a message..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="send"
              onSubmitEditing={() => void handleSendChat()}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => void handleSendChat()}>
              <Send size={17} strokeWidth={2} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {tab === 'ticket' && (
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Department</Text>
          <View style={styles.pillWrap}>
            {CATEGORIES.map((cat) => {
              const active = ticketCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.choicePill, active && styles.choicePillActive]}
                  onPress={() => setTicketCategory(cat)}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Priority</Text>
          <View style={styles.pillWrap}>
            {PRIORITIES.map((prio) => {
              const active = ticketPriority === prio;
              return (
                <TouchableOpacity
                  key={prio}
                  style={[styles.choicePill, active && styles.choicePillActive]}
                  onPress={() => setTicketPriority(prio)}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{prio}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.inputBox}
            value={ticketSubject}
            onChangeText={setTicketSubject}
            placeholder="Ticket Subject"
            placeholderTextColor="#9CA3AF"
          />

          <TextInput
            style={styles.textArea}
            value={ticketBody}
            onChangeText={setTicketBody}
            placeholder="Describe the issue..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleSubmitTicket()}>
            <Ticket size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Submit Ticket</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'faq' && (
        <View style={styles.section}>
          {FAQ_ITEMS.map((item, idx) => {
            const open = openFaqIdx === idx;
            return (
              <React.Fragment key={item.q}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => setOpenFaqIdx(open ? null : idx)}
                  activeOpacity={0.85}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQ}>{item.q}</Text>
                    {open ? (
                      <ChevronUp size={17} strokeWidth={2} color={colors.primaryHover} />
                    ) : (
                      <ChevronDown size={17} strokeWidth={2} color={colors.muted} />
                    )}
                  </View>
                  {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentPillActive: {
    backgroundColor: colors.background,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  chatThread: {
    gap: 10,
  },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 4,
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primarySoft,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.foreground,
  },
  bubbleTime: {
    fontSize: 10.5,
    color: colors.muted,
  },
  composerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  composerInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 13.5,
    color: colors.foreground,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  choiceTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 110,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 14,
    fontSize: 13.5,
    color: colors.foreground,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  faqRow: {
    paddingVertical: 8,
    gap: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQ: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  faqA: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
});
