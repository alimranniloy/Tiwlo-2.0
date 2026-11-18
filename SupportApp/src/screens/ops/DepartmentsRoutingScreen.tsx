import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, SupportDepartmentConfig } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  MagicModalSheet,
  MagicSpinner,
  MagicSwitch,
  NumberTicker,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface OpsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onOpenChat: (chatId: string) => void;
  onNavigateSubScreen: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  routeParams?: Record<string, string | undefined>;
  onPulseSync?: () => void;
}

function formatSlaMinutes(mins?: number | null): string {
  const n = Number(mins || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return `${n}m`;
  const hrs = Math.floor(n / 60);
  const rem = n % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export const DepartmentsRoutingScreen: React.FC<OpsScreenProps> = ({ onBack }) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [departments, setDepartments] = useState<SupportDepartmentConfig[]>([]);
  const [busyDeptId, setBusyDeptId] = useState<string | null>(null);

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [slaResponseMinutes, setSlaResponseMinutes] = useState('15');
  const [slaResolveMinutes, setSlaResolveMinutes] = useState('240');
  const [businessHours, setBusinessHours] = useState('Mon–Sun · 09:00–22:00 BST');
  const [autoAckMessage, setAutoAckMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDepartments = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listDepartments();
        setDepartments(res.departments || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load departments.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadDepartments(false);
  }, [loadDepartments]);

  const activeCount = useMemo(
    () => departments.filter((d) => d.isActive).length,
    [departments]
  );

  const avgFirstResponse = useMemo(() => {
    const active = departments.filter((d) => d.isActive && d.slaResponseMinutes > 0);
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, d) => acc + Number(d.slaResponseMinutes || 0), 0);
    return Math.round(sum / active.length);
  }, [departments]);

  const openModal = (dept?: SupportDepartmentConfig) => {
    if (dept) {
      setEditingId(dept.id);
      setName(dept.name);
      setLeadName(dept.leadName || '');
      setSlaResponseMinutes(String(dept.slaResponseMinutes || 15));
      setSlaResolveMinutes(String(dept.slaResolveMinutes || 240));
      setBusinessHours(dept.businessHours || 'Mon–Sun · 09:00–22:00 BST');
      setAutoAckMessage(dept.autoAckMessage || '');
      setIsActive(dept.isActive);
    } else {
      setEditingId(undefined);
      setName('');
      setLeadName('');
      setSlaResponseMinutes('15');
      setSlaResolveMinutes('240');
      setBusinessHours('Mon–Sun · 09:00–22:00 BST');
      setAutoAckMessage(
        'Thank you for reaching Tiwlo Support. A specialist in our desk is reviewing your request.'
      );
      setIsActive(true);
    }
    setModalVisible(true);
  };

  const handleToggleActive = async (dept: SupportDepartmentConfig, next: boolean) => {
    setBusyDeptId(dept.id);
    setDepartments((prev) =>
      prev.map((d) => (d.id === dept.id ? { ...d, isActive: next } : d))
    );
    try {
      const res = await opsHubService.saveDepartment({
        id: dept.id,
        name: dept.name,
        leadName: dept.leadName,
        slaResponseMinutes: dept.slaResponseMinutes,
        slaResolveMinutes: dept.slaResolveMinutes,
        businessHours: dept.businessHours,
        autoAckMessage: dept.autoAckMessage,
        isActive: next,
      });
      if (res.department) {
        setDepartments((prev) =>
          prev.map((d) => (d.id === dept.id ? res.department : d))
        );
      }
      toast.show({
        variant: 'success',
        label: next ? `${dept.name} queue activated.` : `${dept.name} queue paused.`,
      });
    } catch (err) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === dept.id ? { ...d, isActive: dept.isActive } : d))
      );
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to update department status.',
      });
    } finally {
      setBusyDeptId(null);
    }
  };

  const handleSaveDepartment = async () => {
    if (!name.trim()) {
      toast.show({ variant: 'danger', label: 'Enter a department name.' });
      return;
    }

    const respMins = Math.max(1, Number.parseInt(slaResponseMinutes, 10) || 15);
    const resMins = Math.max(5, Number.parseInt(slaResolveMinutes, 10) || 240);

    setSaving(true);
    try {
      const res = await opsHubService.saveDepartment({
        id: editingId,
        name: name.trim(),
        leadName: leadName.trim() || 'Unassigned Lead',
        slaResponseMinutes: respMins,
        slaResolveMinutes: resMins,
        businessHours: businessHours.trim() || '24/7 Operations',
        autoAckMessage: autoAckMessage.trim(),
        isActive,
      });

      if (res.department) {
        setDepartments((prev) =>
          editingId
            ? prev.map((d) => (d.id === editingId ? res.department : d))
            : [...prev, res.department]
        );
      } else {
        loadDepartments(true);
      }
      setModalVisible(false);
      toast.show({
        variant: 'success',
        label: editingId ? 'Department routing updated.' : 'Department created.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to save department.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    setBusyDeptId(id);
    try {
      await opsHubService.deleteDepartment(id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      toast.show({ variant: 'accent', label: 'Department deleted.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not delete department.',
      });
    } finally {
      setBusyDeptId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Borderless Top Header */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton
          name="arrow-left"
          size={20}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.text }]}>
            Departments & SLA Routing
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Business hours, SLA targets & auto-acknowledgements
          </Text>
        </View>
        <ShimmerButton
          label="+ Add Dept"
          size="xs"
          variant="accent"
          onPress={() => openModal()}
        />
      </View>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={tokens.accent}
            onRefresh={() => {
              setRefreshing(true);
              loadDepartments(true);
            }}
          />
        }
      >
        {/* Summary KPI Strip */}
        <BlurFade delay={0} offset={5}>
          <View style={[styles.kpiStrip, { borderColor: tokens.hairline }]}>
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>DEPARTMENTS</Text>
              <NumberTicker
                value={departments.length}
                style={[styles.kpiVal, { color: tokens.text }]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>ACTIVE QUEUES</Text>
              <NumberTicker
                value={activeCount}
                style={[styles.kpiVal, { color: tokens.success }]}
              />
            </View>
            <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
            <View style={styles.kpiCell}>
              <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>AVG FRT TARGET</Text>
              <NumberTicker
                value={avgFirstResponse}
                suffix="m"
                style={[styles.kpiVal, { color: tokens.accent }]}
              />
            </View>
          </View>
        </BlurFade>

        {loading && departments.length === 0 ? (
          <MagicSpinner label="Loading routing departments..." />
        ) : departments.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No departments configured yet. Tap + Add Dept to set up routing queues.
          </Text>
        ) : (
          departments.map((dept, idx) => (
            <AnimatedListItem key={dept.id} index={idx}>
              <View style={[styles.deptRow, { borderBottomColor: tokens.hairlineStrong }]}>
                <View style={styles.deptHeader}>
                  <View style={styles.flex1}>
                    <View style={styles.titlePair}>
                      <Text
                        numberOfLines={1}
                        style={[styles.deptName, { color: tokens.text }]}
                      >
                        {dept.name}
                      </Text>
                      <FlatBadge label={`/${dept.slug}`} tone="neutral" />
                    </View>
                    <Text style={[styles.leadText, { color: tokens.textSecondary }]}>
                      {`Lead: ${dept.leadName || 'Unassigned'}`}
                    </Text>
                  </View>

                  <MagicSwitch
                    value={dept.isActive}
                    disabled={busyDeptId === dept.id}
                    onValueChange={(next) => handleToggleActive(dept, next)}
                  />
                </View>

                {/* SLA + Hours Metrics Strip */}
                <View
                  style={[
                    styles.slaGrid,
                    {
                      backgroundColor: tokens.surfaceSubtle,
                      borderColor: tokens.hairlineStrong,
                    },
                  ]}
                >
                  <View style={styles.slaItem}>
                    <Text style={[styles.slaMicro, { color: tokens.textMuted }]}>
                      FIRST RESPONSE
                    </Text>
                    <Text style={[styles.slaValue, { color: tokens.accent }]}>
                      {`${dept.slaResponseMinutes}m (${formatSlaMinutes(dept.slaResponseMinutes)})`}
                    </Text>
                  </View>
                  <View style={[styles.vSep, { backgroundColor: tokens.hairline }]} />
                  <View style={styles.slaItem}>
                    <Text style={[styles.slaMicro, { color: tokens.textMuted }]}>
                      RESOLUTION SLA
                    </Text>
                    <Text style={[styles.slaValue, { color: tokens.text }]}>
                      {`${dept.slaResolveMinutes}m (${formatSlaMinutes(dept.slaResolveMinutes)})`}
                    </Text>
                  </View>
                </View>

                <View style={styles.hoursLine}>
                  <Feather name="clock" size={12} color={tokens.textMuted} />
                  <Text style={[styles.hoursText, { color: tokens.textSecondary }]}>
                    {dept.businessHours || '24/7 Operations'}
                  </Text>
                </View>

                {dept.autoAckMessage ? (
                  <View
                    style={[
                      styles.ackPreview,
                      { borderLeftColor: tokens.accent, backgroundColor: tokens.surfaceSubtle },
                    ]}
                  >
                    <Text style={[styles.ackLabel, { color: tokens.textMuted }]}>
                      AUTO-ACKNOWLEDGEMENT
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.ackBody, { color: tokens.textSecondary }]}
                    >
                      {dept.autoAckMessage}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.deptFoot}>
                  <Text style={[styles.updatedText, { color: tokens.textMuted }]}>
                    {`Updated ${formatShortDateTime(dept.updatedAt)}`}
                  </Text>
                  <View style={styles.footLinks}>
                    <TouchableOpacity onPress={() => openModal(dept)} hitSlop={8}>
                      <Text style={[styles.linkBtn, { color: tokens.accent }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyDeptId === dept.id}
                      onPress={() => handleDeleteDepartment(dept.id)}
                      hitSlop={8}
                    >
                      <Text style={[styles.linkBtn, { color: tokens.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* + Add / Edit Department Modal */}
      <MagicModalSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Department' : 'Add Routing Department'}
        subtitle="Configure desk lead, SLA targets, hours & auto-reply"
      >
        <FlatInput
          label="Department Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Customer Support, Billing, Technical, Trust & Safety..."
        />

        <FlatInput
          label="Department Lead Name"
          value={leadName}
          onChangeText={setLeadName}
          autoCapitalize="words"
          placeholder="e.g. Nadia Islam"
        />

        <View style={styles.dualInputs}>
          <FlatInput
            label="First-Response SLA (min)"
            value={slaResponseMinutes}
            onChangeText={setSlaResponseMinutes}
            keyboardType="number-pad"
            placeholder="15"
            style={styles.flex1}
          />
          <FlatInput
            label="Resolution SLA (min)"
            value={slaResolveMinutes}
            onChangeText={setSlaResolveMinutes}
            keyboardType="number-pad"
            placeholder="240"
            style={styles.flex1}
          />
        </View>

        <FlatInput
          label="Business Hours"
          value={businessHours}
          onChangeText={setBusinessHours}
          autoCapitalize="words"
          placeholder="Mon–Sun · 09:00–22:00 BST"
        />

        <FlatInput
          label="Auto-Acknowledgement Message"
          value={autoAckMessage}
          onChangeText={setAutoAckMessage}
          autoCapitalize="sentences"
          autoCorrect
          multiline
          placeholder="Sent automatically when a ticket enters this department..."
        />

        <View style={styles.modalFoot}>
          <View style={styles.switchInline}>
            <MagicSwitch value={isActive} onValueChange={setIsActive} />
            <Text style={[styles.switchLabel, { color: tokens.text }]}>Queue Active</Text>
          </View>

          <ShimmerButton
            label={editingId ? 'Save Changes' : 'Create Department'}
            size="sm"
            variant="accent"
            loading={saving}
            onPress={handleSaveDepartment}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

export default DepartmentsRoutingScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11.5,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  vSep: {
    width: 1,
    height: 26,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  deptRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 9,
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titlePair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deptName: {
    fontSize: 14.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  leadText: {
    fontSize: 12,
    marginTop: 2,
  },
  slaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  slaItem: {
    flex: 1,
    gap: 2,
  },
  slaMicro: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  slaValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  hoursLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hoursText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ackPreview: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderLeftWidth: 2,
    borderRadius: 5,
    gap: 2,
  },
  ackLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  ackBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  deptFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  updatedText: {
    fontSize: 11,
  },
  footLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  linkBtn: {
    fontSize: 12,
    fontWeight: '700',
  },
  dualInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
