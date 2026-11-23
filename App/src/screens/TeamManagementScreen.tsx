import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Mail,
  PauseCircle,
  PlayCircle,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  createTeamMember,
  deleteTeamMember,
  fetchTeamMembers,
  TeamMemberRecord,
  updateTeamMember,
} from '../services/tiwloAccount';
import { colors } from '../theme/tokens';

interface TeamManagementScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
}

const ROLE_OPTIONS = ['Admin', 'Developer', 'Support', 'Billing'] as const;
const PERMISSION_KEYS = [
  { key: 'droplets', label: 'Manage Droplets & Backups' },
  { key: 'stores', label: 'Manage Online Stores & Orders' },
  { key: 'domains', label: 'DNS & Custom Domains' },
  { key: 'billing', label: 'View Billing & Invoices' },
  { key: 'security', label: 'Access Security & Sessions' },
];

export const TeamManagementScreen: React.FC<TeamManagementScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [inviteOpen, setInviteOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('Developer');
  const [permissions, setPermissions] = useState<string[]>(['droplets', 'stores']);
  const [require2FAForTeam, setRequire2FAForTeam] = useState(true);
  const [auditAllActions, setAuditAllActions] = useState(true);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const loadTeam = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const res = await fetchTeamMembers(sessionToken);
      setMembers(res.members || res.staff || []);
    } catch {
      // ignore offline
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleInvite = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!newName.trim() || !newEmail.trim()) {
      setBannerTone('error');
      setBanner('Enter member name and email / Tiwi ID.');
      return;
    }
    try {
      const res = await createTeamMember(
        { name: newName.trim(), email: newEmail.trim(), role: newRole, permissions },
        sessionToken
      );
      if (res.member) setMembers((prev) => [res.member!, ...prev]);
      setNewName('');
      setNewEmail('');
      setInviteOpen(false);
      setBannerTone('success');
      setBanner('Team member invitation sent.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Failed to add team member.');
    }
  };

  const handleToggleStatus = async (member: TeamMemberRecord) => {
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    try {
      await updateTeamMember(member.id, { status: nextStatus }, sessionToken);
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, status: nextStatus } : m))
      );
      setBannerTone('success');
      setBanner(`${member.name} is now ${nextStatus}.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update member.');
    }
  };

  const handleRemoveMember = async (member: TeamMemberRecord) => {
    try {
      await deleteTeamMember(member.id, sessionToken);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setBannerTone('info');
      setBanner(`${member.name} removed from team.`);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not remove member.');
    }
  };

  const activeCount = members.filter((m) => m.status === 'active').length;
  const filteredMembers = members.filter((m) => {
    if (roleFilter !== 'All' && m.role.toLowerCase() !== roleFilter.toLowerCase()) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <AccountPageShell
      title="Team Management"
      onBack={onBack}
      onRefresh={() => void loadTeam()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Flat Seats Summary Header Row */}
      <View style={styles.summaryRow}>
        <Users size={20} strokeWidth={1.9} color={colors.foreground} />
        <View style={styles.flexOne}>
          <Text style={styles.summaryTitle}>
            {members.length + 1} Team Seats · {activeCount + 1} Active
          </Text>
          <Text style={styles.summarySub}>
            Manage roles and module permissions
          </Text>
        </View>
        <TouchableOpacity
          style={styles.inviteBtn}
          onPress={() => setInviteOpen((p) => !p)}
          activeOpacity={0.85}
        >
          <UserPlus size={15} strokeWidth={2} color={colors.ink} />
          <Text style={styles.inviteBtnText}>{inviteOpen ? 'Close' : 'Add Member'}</Text>
        </TouchableOpacity>
      </View>

      {inviteOpen ? (
        <>
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Invite Team Member</Text>

            <TextInput
              style={styles.inputBox}
              value={newName}
              onChangeText={setNewName}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.inputWithIcon}>
              <Mail size={15} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.innerInput}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Email address or Tiwi ID"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => {
                const active = newRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.rolePill, active && styles.rolePillActive]}
                    onPress={() => setNewRole(role)}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>{role}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Permissions</Text>
            <View style={styles.permList}>
              {PERMISSION_KEYS.map((perm) => {
                const checked = permissions.includes(perm.key);
                return (
                  <TouchableOpacity
                    key={perm.key}
                    style={[styles.permRow, checked && styles.permRowActive]}
                    onPress={() => togglePermission(perm.key)}
                  >
                    <CheckCircle2
                      size={16}
                      strokeWidth={2}
                      color={checked ? colors.primaryHover : colors.muted}
                    />
                    <Text style={styles.permLabel}>{perm.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void handleInvite()}
              activeOpacity={0.85}
            >
              <UserPlus size={17} strokeWidth={2} color={colors.ink} />
              <Text style={styles.primaryBtnText}>Send Invitation</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <View style={styles.divider} />

      {/* Search & Filter */}
      <View style={styles.section}>
        <View style={styles.inputWithIcon}>
          <Search size={15} strokeWidth={1.9} color={colors.muted} />
          <TextInput
            style={styles.innerInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search team members..."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.roleRow}>
          {['All', ...ROLE_OPTIONS].map((r) => {
            const active = roleFilter === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.rolePill, active && styles.rolePillActive]}
                onPress={() => setRoleFilter(r)}
              >
                <Text style={[styles.roleText, active && styles.roleTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Owner Row */}
        <View style={styles.memberRow}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberInitials}>
              {(user?.name || 'OW').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.memberName}>{user?.name || 'Workspace Owner'}</Text>
            <Text style={styles.memberSub}>{user?.email || user?.tiwiId || 'Owner Account'}</Text>
          </View>
          <Text style={styles.ownerText}>Owner</Text>
        </View>

        {filteredMembers.length === 0 ? (
          <Text style={styles.emptyText}>
            {user
              ? 'No additional staff members yet.'
              : 'Sign in to view and manage team seats.'}
          </Text>
        ) : (
          filteredMembers.map((member) => (
            <React.Fragment key={member.id}>
              <View style={styles.hairline} />
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>
                    {member.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberSub}>
                    {member.role} · {member.status}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => void handleToggleStatus(member)}>
                  {member.status === 'active' ? (
                    <PauseCircle size={18} strokeWidth={1.9} color={colors.warning} />
                  ) : (
                    <PlayCircle size={18} strokeWidth={1.9} color={colors.primaryHover} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void handleRemoveMember(member)}>
                  <Trash2 size={17} strokeWidth={1.9} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      <View style={styles.divider} />

      {/* Team Policies */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Team Policies</Text>

        <View style={styles.switchRow}>
          <Shield size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.memberName}>Require 2FA for Staff</Text>
            <Text style={styles.memberSub}>Members must enable 2FA before console access</Text>
          </View>
          <Switch
            value={require2FAForTeam}
            onValueChange={setRequire2FAForTeam}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <Shield size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.memberName}>Record Staff Audit Events</Text>
            <Text style={styles.memberSub}>Log droplet, DNS, and store actions</Text>
          </View>
          <Switch
            value={auditAllActions}
            onValueChange={setAuditAllActions}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  summarySub: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  inputBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.foreground,
  },
  inputWithIcon: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  innerInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.foreground,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  rolePillActive: {
    backgroundColor: colors.primary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  roleTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  permList: {
    gap: 6,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  permRowActive: {
    backgroundColor: colors.primarySoft,
  },
  permLabel: {
    fontSize: 13,
    fontWeight: '500',
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  memberSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  ownerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
});
