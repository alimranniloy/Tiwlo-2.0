import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { opsHubService } from '../../services/opsHubService';
import { getTonePalette, useAppTheme } from '../../theme/ThemeContext';
import type { SupportDepartmentConfig } from '../../types/opsHub';
import { getPriorityTone, getStatusLabel } from '../../utils/formatters';
import {
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

const CATEGORY_OPTIONS = [
  'general',
  'billing',
  'technical',
  'account',
  'orders',
  'domains',
  'security',
];

const DEFAULT_DEPARTMENTS = [
  'General Support',
  'Billing & Finance',
  'Technical Ops',
  'Domains & Hosting',
  'Trust & Security',
];

const PRIORITY_LEVELS: ('low' | 'medium' | 'high' | 'urgent')[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

export const TicketCreateInternalScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onOpenTicket,
  routeParams,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [customerName, setCustomerName] = useState(routeParams?.customerName || '');
  const [customerEmail, setCustomerEmail] = useState(routeParams?.customerEmail || '');
  const [customerPhone, setCustomerPhone] = useState(routeParams?.customerPhone || '');
  const [subject, setSubject] = useState(routeParams?.subject || '');
  const [category, setCategory] = useState('general');
  const [department, setDepartment] = useState('General Support');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [description, setDescription] = useState('');
  const [assignToSelf, setAssignToSelf] = useState(true);

  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (routeParams?.customerName) setCustomerName(routeParams.customerName);
    if (routeParams?.customerEmail) setCustomerEmail(routeParams.customerEmail);
    if (routeParams?.customerPhone) setCustomerPhone(routeParams.customerPhone);
  }, [routeParams?.customerEmail, routeParams?.customerName, routeParams?.customerPhone]);

  useEffect(() => {
    let active = true;
    opsHubService
      .listDepartments()
      .then((res) => {
        if (!active) return;
        const names = (res.departments || [])
          .filter((d: SupportDepartmentConfig) => d.isActive !== false)
          .map((d: SupportDepartmentConfig) => d.name)
          .filter(Boolean);
        if (names.length > 0) {
          setDepartmentsList(names);
          setDepartment((prev) => (names.includes(prev) ? prev : names[0]));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleAiPolish = async () => {
    const raw = description.trim();
    if (!raw) {
      showToast({ variant: 'danger', label: 'Write a rough message first for Gemini AI to polish.' });
      return;
    }
    setAiPolishing(true);
    try {
      const res = await opsHubService.runAiPlayground({
        task: 'polish',
        input: raw,
        customerName: customerName.trim() || undefined,
      });
      if (res.output?.trim()) {
        setDescription(res.output.trim());
        showToast({ variant: 'accent', label: 'Polished with Gemini AI.' });
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Gemini AI polish unavailable.',
      });
    } finally {
      setAiPolishing(false);
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    const cleanName = customerName.trim();
    const cleanEmail = customerEmail.trim();
    const cleanSubject = subject.trim();
    const cleanDesc = description.trim();

    if (!cleanName) {
      setFormError('Customer name is required.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('A valid customer email address is required.');
      return;
    }
    if (!cleanSubject) {
      setFormError('Enter a clear ticket subject.');
      return;
    }
    if (!cleanDesc) {
      setFormError('Enter the outbound message or issue description.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await opsHubService.createInternalTicket({
        customerName: cleanName,
        customerEmail: cleanEmail,
        customerPhone: customerPhone.trim() || undefined,
        subject: cleanSubject,
        description: cleanDesc,
        priority,
        category,
        department,
        assignToSelf,
      });
      showToast({
        variant: 'success',
        label: 'Outbound support ticket created.',
      });
      onPulseSync?.();
      if (res.ticket?.id) {
        onOpenTicket(res.ticket.id);
      } else {
        onBack();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create outbound ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View>
            <Text style={[styles.pageTitle, { color: tokens.text }]}>New Outbound Ticket</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              Open a proactive ticket on behalf of a customer
            </Text>
          </View>
        </View>
        <FlatBadge label="Staff Outbound" tone="accent" withDot />
      </View>

      <KeyboardAwareScrollView
        style={styles.flex1}
        bottomOffset={72}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {formError ? (
          <FlatNotice text={formError} tone="danger" icon="alert-circle" />
        ) : null}

        {/* Customer Contact Section */}
        <BlurFade delay={20} offset={6}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              CUSTOMER RECIPIENT
            </Text>
            <FlatInput
              label="Customer Name *"
              placeholder="e.g. Tanvir Rahman"
              value={customerName}
              onChangeText={setCustomerName}
              autoCapitalize="words"
              leftIcon={<Feather name="user" size={14} color={tokens.textMuted} />}
            />
            <FlatInput
              label="Customer Email *"
              placeholder="customer@domain.com"
              value={customerEmail}
              onChangeText={setCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Feather name="mail" size={14} color={tokens.textMuted} />}
            />
            <FlatInput
              label="Phone Number (Optional)"
              placeholder="+880 17XX-XXXXXX"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              leftIcon={<Feather name="phone" size={14} color={tokens.textMuted} />}
            />
          </View>
        </BlurFade>

        <Hairline />

        {/* Routing & Priority Section */}
        <BlurFade delay={60} offset={6}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
              TICKET CLASSIFICATION
            </Text>

            <FlatInput
              label="Subject *"
              placeholder="Concise summary of the proactive outreach..."
              value={subject}
              onChangeText={setSubject}
              autoCapitalize="sentences"
            />

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldTitle, { color: tokens.textSecondary }]}>Priority</Text>
              <View style={styles.chipRow}>
                {PRIORITY_LEVELS.map((p) => {
                  const active = priority === p;
                  const palette = getTonePalette(tokens, getPriorityTone(p));
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: active ? palette.bg : tokens.surfaceSubtle,
                          borderColor: active ? palette.fg : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? palette.fg : tokens.textSecondary },
                        ]}
                      >
                        {getStatusLabel(p)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldTitle, { color: tokens.textSecondary }]}>Category</Text>
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? tokens.accent : tokens.textSecondary },
                        ]}
                      >
                        {getStatusLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldTitle, { color: tokens.textSecondary }]}>Department</Text>
              <View style={styles.chipRow}>
                {departmentsList.map((dept) => {
                  const active = department === dept;
                  return (
                    <TouchableOpacity
                      key={dept}
                      onPress={() => setDepartment(dept)}
                      style={[
                        styles.selectChip,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? tokens.accent : tokens.textSecondary },
                        ]}
                      >
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </BlurFade>

        <Hairline />

        {/* Message & AI Polish Section */}
        <BlurFade delay={100} offset={6}>
          <View style={styles.section}>
            <View style={styles.descHeaderRow}>
              <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                INITIAL MESSAGE & CONTEXT
              </Text>
              <ShimmerButton
                label="Gemini AI Polish"
                size="xs"
                variant="subtle"
                loading={aiPolishing}
                disabled={submitting}
                leftIcon={<Feather name="zap" size={12} color={tokens.accent} />}
                onPress={handleAiPolish}
              />
            </View>

            <FlatInput
              placeholder="Write the message the customer will receive, or jot notes and tap Gemini AI Polish..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              autoCapitalize="sentences"
              autoCorrect
              inputStyle={styles.multilineInput}
            />

            {/* Lock Ownership Switch Strip */}
            <View
              style={[
                styles.switchRow,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <View style={styles.switchMeta}>
                <Text style={[styles.switchTitle, { color: tokens.text }]}>
                  Assign & lock to me immediately
                </Text>
                <Text style={[styles.switchSub, { color: tokens.textMuted }]}>
                  Skips unclaimed alert queue and unlocks reply composer for you right away
                </Text>
              </View>
              <MagicSwitch value={assignToSelf} onValueChange={setAssignToSelf} />
            </View>
          </View>
        </BlurFade>

        <View style={styles.submitRow}>
          <TouchableOpacity onPress={onBack} disabled={submitting} hitSlop={8}>
            <Text style={[styles.cancelLink, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label="Create & Open Ticket"
            variant="accent"
            size="sm"
            loading={submitting}
            disabled={aiPolishing}
            leftIcon={<Feather name="send" size={13} color={tokens.accentText} />}
            onPress={handleSubmit}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pageTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  descHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  multilineInput: {
    minHeight: 112,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchMeta: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  cancelLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});
