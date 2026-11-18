import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { getWorkspacePreferences } from '../../services/preferencesService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type {
  AuthUser,
  LiveChatMessage,
  LiveChatSession,
  StaffProfileMe,
  SupportMacro,
} from '../../types/support';
import { formatShortDateTime, getStatusLabel, getStatusTone } from '../../utils/formatters';
import { evaluateLiveChatReplyAccess } from '../../utils/replyGuard';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicModalSheet,
  MagicSpinner,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

interface LiveChatRoomScreenProps {
  chatId: string;
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onPulseSync?: () => void;
}

export const LiveChatRoomScreen: React.FC<LiveChatRoomScreenProps> = ({
  chatId,
  user,
  staffProfile,
  onBack,
  onOpenTicket,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<LiveChatSession | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const [actionsVisible, setActionsVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [templates, setTemplates] = useState<SupportMacro[]>([]);
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplBody, setNewTplBody] = useState('');
  const [tplBusy, setTplBusy] = useState(false);

  const [coBrowseVisible, setCoBrowseVisible] = useState(false);
  const [selectorInput, setSelectorInput] = useState('');
  const [guidanceInput, setGuidanceInput] = useState('');

  const [convertVisible, setConvertVisible] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState('medium');

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadRoom = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await supportService.getLiveChatDetail(chatId);
        setChat(res.chat || null);
        setMessages(res.messages || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to open chat room.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [chatId, toast]
  );

  useEffect(() => {
    loadRoom(false);
    const interval = setInterval(() => loadRoom(true), 3500);
    return () => clearInterval(interval);
  }, [loadRoom]);

  const handleAccept = async () => {
    setBusyAction(true);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptLiveChat(chatId);
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Chat accepted.' });
      await loadRoom(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept chat.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleCancel = async () => {
    setBusyAction(true);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelLiveChat(chatId);
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Live chat dismissed from your queue.' });
      onBack();
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not dismiss chat.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleSend = async () => {
    const clean = draft.trim();
    if (!clean) return;
    setSending(true);
    try {
      await supportService.replyLiveChat(chatId, clean);
      setDraft('');
      await loadRoom(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to send message.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleHold = async () => {
    setBusyAction(true);
    try {
      await supportService.holdLiveChat(chatId, 'Placed on hold from Support App');
      toast.show({ variant: 'accent', label: 'Chat placed on hold.' });
      setActionsVisible(false);
      await loadRoom(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to hold chat.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleEnd = async () => {
    setBusyAction(true);
    try {
      await supportService.endLiveChat(chatId);
      toast.show({ variant: 'success', label: 'Live chat ended.' });
      setActionsVisible(false);
      await loadRoom(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to end chat.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleAi = async (mode: 'suggest_reply' | 'polish_reply' | 'summarize') => {
    setAiBusy(true);
    try {
      const res = await supportService.aiAssistLiveChat(chatId, mode, draft.trim());
      const output = res.suggestion || res.reply || res.summary || res.text || '';
      if (!output.trim()) {
        toast.show({ variant: 'accent', label: 'AI returned no response.' });
        return;
      }
      if (mode === 'summarize') {
        setAiSummary(output.trim());
      } else {
        setDraft(output.trim());
        toast.show({ variant: 'success', label: 'AI draft inserted.' });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'AI assistant unavailable.',
      });
    } finally {
      setAiBusy(false);
    }
  };

  const openTemplates = async () => {
    setTemplatesVisible(true);
    try {
      const res = await supportService.listLiveChatTemplates();
      setTemplates(res.templates || []);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to load templates.',
      });
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTplTitle.trim() || !newTplBody.trim()) {
      toast.show({ variant: 'danger', label: 'Enter template title and body.' });
      return;
    }
    setTplBusy(true);
    try {
      await supportService.createLiveChatTemplate({
        title: newTplTitle.trim(),
        body: newTplBody.trim(),
      });
      setNewTplTitle('');
      setNewTplBody('');
      const res = await supportService.listLiveChatTemplates();
      setTemplates(res.templates || []);
      toast.show({ variant: 'success', label: 'Template saved.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not save template.',
      });
    } finally {
      setTplBusy(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await supportService.deleteLiveChatTemplate(id);
      setTemplates((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Delete failed.',
      });
    }
  };

  const handlePushCoBrowse = async () => {
    if (!selectorInput.trim() && !guidanceInput.trim()) {
      toast.show({ variant: 'danger', label: 'Enter CSS selector or guidance note.' });
      return;
    }
    setBusyAction(true);
    try {
      await supportService.pushCoBrowseGuidance(chatId, {
        highlightSelector: selectorInput.trim() || undefined,
        agentGuidanceNote: guidanceInput.trim() || undefined,
      });
      toast.show({ variant: 'success', label: 'Co-browse guidance pushed.' });
      setSelectorInput('');
      setGuidanceInput('');
      setCoBrowseVisible(false);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Co-browse push failed.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleConvert = async () => {
    setBusyAction(true);
    try {
      const res = await supportService.convertLiveChatToTicket(chatId, {
        subject:
          ticketSubject.trim() || chat?.topic || `Live Chat Follow-up (${chat?.guestName || 'Visitor'})`,
        priority: ticketPriority,
      });
      toast.show({ variant: 'success', label: 'Converted to support ticket.' });
      setConvertVisible(false);
      await loadRoom(true);
      if (res.ticket?.id) onOpenTicket(res.ticket.id);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Conversion failed.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  if (loading || !chat) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <View style={styles.topBar}>
          <BorderlessIconButton name="arrow-left" onPress={onBack} accessibilityLabel="Back" />
        </View>
        <MagicSpinner label="Opening chat room..." />
      </View>
    );
  }

  const coBrowse = chat.coBrowse || chat.coBrowseTelemetry;
  const isClosed = chat.status === 'closed' || chat.status === 'cancelled';
  const replyAccess = evaluateLiveChatReplyAccess(chat, user, staffProfile);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: tokens.bg }]}
    >
      {/* Clean Borderless Top Header */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton name="arrow-left" size={20} onPress={onBack} accessibilityLabel="Back" />

        <MagicAvatar
          name={chat.guestName || chat.guestEmail || 'Visitor'}
          uri={resolveWebsiteUrl(chat.userAvatar)}
          size={30}
        />

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerName, { color: tokens.text }]}>
            {chat.guestName || chat.guestEmail || 'Guest Visitor'}
          </Text>
          <View style={styles.headerStatusRow}>
            <FlatBadge label={getStatusLabel(chat.status)} tone={getStatusTone(chat.status)} withDot />
            {chat.chatNumber ? (
              <Text style={[styles.chatNo, { color: tokens.textMuted }]}>#{chat.chatNumber}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          <BorderlessIconButton
            name="cpu"
            size={18}
            color={tokens.accent}
            disabled={aiBusy}
            onPress={() => handleAi('suggest_reply')}
            accessibilityLabel="AI suggest"
          />
          <BorderlessIconButton
            name="zap"
            size={18}
            onPress={openTemplates}
            accessibilityLabel="Quick templates"
          />
          <BorderlessIconButton
            name="more-horizontal"
            size={20}
            onPress={() => setActionsVisible(true)}
            accessibilityLabel="Room actions"
          />
        </View>
      </View>

      {/* Claim Waiting Chat Flat Banner */}
      {chat.status === 'waiting' ? (
        <View style={[styles.flatStrip, { backgroundColor: tokens.warningSoft, borderBottomColor: tokens.hairline }]}>
          <View style={styles.stripRow}>
            <PulsatingDot color={tokens.warning} size={6} />
            <Text style={[styles.stripText, { color: tokens.warning }]}>
              Accept chat to lock & reply, or cancel
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <ShimmerButton
              label="Accept"
              size="xs"
              variant="accent"
              loading={busyAction}
              onPress={handleAccept}
            />
            <ShimmerButton
              label="Cancel"
              size="xs"
              variant="subtle"
              disabled={busyAction}
              onPress={handleCancel}
            />
          </View>
        </View>
      ) : null}

      {/* Co-Browse Info Strip */}
      {coBrowse?.consent && coBrowse.currentUrl ? (
        <View style={[styles.flatStrip, { backgroundColor: tokens.accentSoft, borderBottomColor: tokens.hairline }]}>
          <Text numberOfLines={1} style={[styles.stripText, { color: tokens.accent }]}>
            Viewing: {coBrowse.currentUrl}
          </Text>
          <TouchableOpacity onPress={() => setCoBrowseVisible(true)} hitSlop={8}>
            <Text style={[styles.stripAction, { color: tokens.accent }]}>Guide</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Converted Ticket Link Strip */}
      {chat.convertedTicketId ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onOpenTicket(chat.convertedTicketId!)}
          style={[styles.flatStrip, { borderBottomColor: tokens.hairline }]}
        >
          <Text style={[styles.stripText, { color: tokens.textMuted }]}>
            Linked ticket: #{chat.convertedTicketNumber || chat.convertedTicketId}
          </Text>
          <Text style={[styles.stripAction, { color: tokens.accent }]}>Open →</Text>
        </TouchableOpacity>
      ) : null}

      {/* AI Summary Inline Strip */}
      {aiSummary ? (
        <View style={[styles.summaryStrip, { backgroundColor: tokens.surfaceMuted, borderBottomColor: tokens.hairline }]}>
          <View style={styles.summaryTop}>
            <Text style={[styles.summaryLabel, { color: tokens.accent }]}>AI SUMMARY</Text>
            <TouchableOpacity onPress={() => setAiSummary('')} hitSlop={8}>
              <Text style={[styles.dismissText, { color: tokens.textMuted }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.summaryBody, { color: tokens.text }]}>{aiSummary}</Text>
        </View>
      ) : null}

      {/* Messages Feed */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex1}
        contentContainerStyle={styles.messagesScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((msg, idx) => {
          const isAgent = msg.senderType === 'agent' || msg.senderType === 'staff';
          const isSystem = msg.senderType === 'system' || msg.senderType === 'ai';

          if (isSystem) {
            return (
              <AnimatedListItem key={msg.id || idx} index={idx} staggerMs={25}>
                <View style={styles.systemRow}>
                  <Text style={[styles.systemText, { color: tokens.textMuted }]}>{msg.body}</Text>
                </View>
              </AnimatedListItem>
            );
          }

          return (
            <AnimatedListItem key={msg.id || idx} index={idx} staggerMs={20}>
              <View style={[styles.msgAlign, isAgent ? styles.msgRight : styles.msgLeft]}>
                {!isAgent ? (
                  <View style={{ marginRight: 7, alignSelf: 'flex-end' }}>
                    <MagicAvatar
                      name={msg.senderName || chat.guestName || 'Visitor'}
                      uri={resolveWebsiteUrl(msg.senderAvatar || chat.userAvatar)}
                      size={24}
                    />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isAgent ? tokens.inkButton : tokens.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.msgMeta,
                      { color: isAgent ? 'rgba(255,255,255,0.68)' : tokens.textMuted },
                    ]}
                  >
                    {msg.senderName || (isAgent ? 'You' : 'Visitor')} · {formatShortDateTime(msg.createdAt)}
                  </Text>
                  <Text
                    style={[
                      styles.msgBody,
                      { color: isAgent ? tokens.inkButtonText : tokens.text },
                    ]}
                  >
                    {msg.body}
                  </Text>
                </View>
              </View>
            </AnimatedListItem>
          );
        })}
      </ScrollView>

      {/* Keyboard-Lifted Flat Composer Dock OR Disabled "Unable to Reply" Box */}
      {!replyAccess.canReply ? (
        <View
          style={[
            styles.composerDock,
            {
              backgroundColor: tokens.bg,
              borderTopColor: tokens.hairlineStrong,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {replyAccess.requiresAccept ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: tokens.textSecondary }}>
                Accept this live chat to claim ownership & unlock composer
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <ShimmerButton
                  label="Accept"
                  size="xs"
                  variant="accent"
                  loading={busyAction}
                  onPress={handleAccept}
                />
                <ShimmerButton
                  label="Cancel"
                  size="xs"
                  variant="subtle"
                  disabled={busyAction}
                  onPress={handleCancel}
                />
              </View>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 40,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: tokens.hairlineStrong,
              backgroundColor: tokens.surfaceMuted,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: 0.88,
            }}
          >
            <Feather name="slash" size={14} color={tokens.danger} />
            <Text
              numberOfLines={2}
              style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: tokens.textMuted }}
            >
              {replyAccess.unableReason || 'Unable to reply to this conversation.'}
            </Text>
            <FlatBadge label="Unable" tone="danger" />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.composerDock,
            {
              backgroundColor: tokens.bg,
              borderTopColor: tokens.hairlineStrong,
              paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View style={styles.quickActionLine}>
            <TouchableOpacity
              disabled={aiBusy}
              onPress={() => handleAi(draft.trim() ? 'polish_reply' : 'suggest_reply')}
              hitSlop={6}
            >
              <Text style={[styles.toolLink, { color: tokens.accent }]}>
                {aiBusy ? 'Gemini Writing...' : draft.trim() ? 'Polish AI' : 'AI Reply'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={aiBusy} onPress={() => handleAi('summarize')} hitSlop={6}>
              <Text style={[styles.toolLink, { color: tokens.textMuted }]}>Summarize</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const prefs = await getWorkspacePreferences();
                if (prefs.signatureText.trim()) {
                  setDraft((prev) =>
                    prev.trim() ? `${prev.trim()}\n\n${prefs.signatureText.trim()}` : prefs.signatureText.trim()
                  );
                }
              }}
              hitSlop={6}
            >
              <Text style={[styles.toolLink, { color: tokens.textMuted }]}>Signature</Text>
            </TouchableOpacity>
            {coBrowse?.consent ? (
              <TouchableOpacity onPress={() => setCoBrowseVisible(true)} hitSlop={6}>
                <Text style={[styles.toolLink, { color: tokens.textMuted }]}>Co-Browse</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 140);
              }}
              placeholder="Write a message..."
              placeholderTextColor={tokens.textMuted}
              multiline
              style={[
                styles.composerInput,
                {
                  color: tokens.text,
                  backgroundColor: tokens.surfaceSubtle,
                  borderWidth: 1,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            />
            <ShimmerButton
              label="Send"
              size="sm"
              variant="accent"
              loading={sending}
              disabled={!draft.trim()}
              onPress={handleSend}
            />
          </View>
        </View>
      )}

      {/* Room Actions Flat Modal */}
      <MagicModalSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        title="Conversation Actions"
        subtitle="Manage chat status, co-browsing, or ticket escalation"
      >
        <View style={styles.menuList}>
          {chat.status !== 'on_hold' && !isClosed ? (
            <TouchableOpacity style={[styles.menuRow, { borderBottomColor: tokens.hairline }]} onPress={handleHold}>
              <Feather name="pause-circle" size={17} color={tokens.text} />
              <Text style={[styles.menuLabel, { color: tokens.text }]}>Place Chat On Hold</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: tokens.hairline }]}
            onPress={() => {
              setActionsVisible(false);
              setCoBrowseVisible(true);
            }}
          >
            <Feather name="navigation" size={17} color={tokens.text} />
            <Text style={[styles.menuLabel, { color: tokens.text }]}>Push Co-Browse Guidance</Text>
          </TouchableOpacity>

          {!chat.convertedTicketId ? (
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomColor: tokens.hairline }]}
              onPress={() => {
                setTicketSubject(chat.topic || '');
                setActionsVisible(false);
                setConvertVisible(true);
              }}
            >
              <Feather name="file-plus" size={17} color={tokens.text} />
              <Text style={[styles.menuLabel, { color: tokens.text }]}>Convert to Support Ticket</Text>
            </TouchableOpacity>
          ) : null}

          {!isClosed ? (
            <TouchableOpacity style={styles.menuRow} onPress={handleEnd}>
              <Feather name="x-circle" size={17} color={tokens.danger} />
              <Text style={[styles.menuLabel, { color: tokens.danger }]}>End Live Chat</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </MagicModalSheet>

      {/* Templates Modal */}
      <MagicModalSheet
        visible={templatesVisible}
        onClose={() => setTemplatesVisible(false)}
        title="Quick Reply Templates"
        subtitle="Tap to insert into your draft"
      >
        {templates.map((tpl) => (
          <View key={tpl.id} style={[styles.tplItem, { borderBottomColor: tokens.hairline }]}>
            <TouchableOpacity
              style={styles.flex1}
              onPress={() => {
                setDraft((prev) => (prev.trim() ? `${prev}\n${tpl.body}` : tpl.body));
                setTemplatesVisible(false);
              }}
            >
              <Text style={[styles.tplTitle, { color: tokens.text }]}>{tpl.title}</Text>
              <Text numberOfLines={2} style={[styles.tplBody, { color: tokens.textMuted }]}>
                {tpl.body}
              </Text>
            </TouchableOpacity>
            <BorderlessIconButton
              name="trash-2"
              size={16}
              color={tokens.danger}
              onPress={() => handleDeleteTemplate(tpl.id)}
              accessibilityLabel="Delete template"
            />
          </View>
        ))}

        <Hairline style={{ marginVertical: 4 }} />
        <Text style={[styles.subHeader, { color: tokens.text }]}>New Template</Text>
        <FlatInput label="Title" value={newTplTitle} onChangeText={setNewTplTitle} placeholder="Template title" />
        <FlatInput label="Body" value={newTplBody} onChangeText={setNewTplBody} placeholder="Template text..." multiline />
        <ShimmerButton label="Save Template" size="sm" loading={tplBusy} onPress={handleCreateTemplate} />
      </MagicModalSheet>

      {/* Co-Browse Sheet */}
      <MagicModalSheet
        visible={coBrowseVisible}
        onClose={() => setCoBrowseVisible(false)}
        title="Push Co-Browse Guidance"
        subtitle="Highlight an element on the customer's page"
      >
        <FlatInput
          label="CSS Selector (Optional)"
          value={selectorInput}
          onChangeText={setSelectorInput}
          placeholder="#billing-upgrade-btn"
        />
        <FlatInput
          label="Guidance Note"
          value={guidanceInput}
          onChangeText={setGuidanceInput}
          placeholder="Instruction shown on visitor screen..."
          multiline
        />
        <ShimmerButton label="Send Overlay" size="sm" loading={busyAction} onPress={handlePushCoBrowse} />
      </MagicModalSheet>

      {/* Convert to Ticket Sheet */}
      <MagicModalSheet
        visible={convertVisible}
        onClose={() => setConvertVisible(false)}
        title="Convert to Ticket"
        subtitle="Creates a tracked ticket linked to this conversation"
      >
        <FlatInput
          label="Ticket Subject"
          value={ticketSubject}
          onChangeText={setTicketSubject}
          placeholder="Summary subject..."
        />
        <View style={styles.prioRow}>
          {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
            const active = ticketPriority === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setTicketPriority(p)}
                style={[
                  styles.prioChoice,
                  {
                    backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    color: active ? tokens.accent : tokens.textMuted,
                  }}
                >
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <ShimmerButton label="Create Ticket" size="sm" loading={busyAction} onPress={handleConvert} />
      </MagicModalSheet>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatNo: { fontSize: 11 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flatStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  stripText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  stripAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 4,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  dismissText: { fontSize: 11, fontWeight: '600' },
  summaryBody: { fontSize: 12.5, lineHeight: 18 },
  messagesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  systemRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  systemText: {
    fontSize: 11,
    textAlign: 'center',
  },
  msgAlign: {
    flexDirection: 'row',
  },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 3,
  },
  msgMeta: {
    fontSize: 10,
    fontWeight: '600',
  },
  msgBody: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  composerDock: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  quickActionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 104,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
  },
  closedBar: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  menuList: {
    gap: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tplItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tplTitle: { fontSize: 13.5, fontWeight: '600' },
  tplBody: { fontSize: 12, marginTop: 2 },
  subHeader: { fontSize: 13.5, fontWeight: '700', marginTop: 4 },
  prioRow: { flexDirection: 'row', gap: 8 },
  prioChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
