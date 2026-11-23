import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  Archive,
  ArrowLeft,
  Bot,
  Boxes,
  Camera,
  ChevronRight,
  Container,
  CreditCard,
  DatabaseBackup,
  Download,
  Fingerprint,
  Globe,
  HardDrive,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  PanelsTopLeft,
  Plus,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
  Users,
  Webhook,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavKey, MobileBottomNavbar } from '../components/MobileNavbar';
import type { TiwloUser } from '../services/tiwloAuth';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import { colors } from '../theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

function resolveAvatarUri(avatar?: string): string | null {
  const clean = typeof avatar === 'string' ? avatar.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('https://') || clean.startsWith('http://')) return clean;
  if (clean.startsWith('/')) return `${TIWLO_ORIGIN}${clean}`;
  return null;
}

export interface NavMenuItem {
  id: string;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
  badge?: string;
}

export interface NavMenuGroup {
  section: string;
  items: NavMenuItem[];
}

const iconColor = (active: boolean) => (active ? colors.primaryHover : colors.muted);

export const getDashboardMenuGroups = (storeCount: number): NavMenuGroup[] => [
  {
    section: 'Overview',
    items: [
      {
        id: 'workspace',
        label: 'Workspace',
        renderIcon: (a) => <LayoutGrid size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace-hub',
        label: 'Services Hub',
        renderIcon: (a) => <Boxes size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
    ],
  },
  {
    section: 'Products',
    items: [
      {
        id: 'my-online-store',
        label: 'Online Store',
        badge: storeCount > 0 ? String(storeCount) : undefined,
        renderIcon: (a) => <Store size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'create-store',
        label: 'Create Store',
        renderIcon: (a) => <Plus size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        renderIcon: (a) => <ShoppingBag size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'email',
        label: 'tMail',
        renderIcon: (a) => <Mail size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'oneprofile',
        label: 'OneProfile',
        renderIcon: (a) => <UserRound size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'whatsapp-automation',
        label: 'WhatsApp Automation',
        renderIcon: (a) => <MessageCircle size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'discord',
        label: 'Discord Console',
        renderIcon: (a) => <Bot size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
    ],
  },
  {
    section: 'Cloud',
    items: [
      {
        id: 'domains',
        label: 'Domains',
        renderIcon: (a) => <Globe size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'create-droplet',
        label: 'Create Droplet',
        renderIcon: (a) => <Plus size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'my-droplets',
        label: 'My Droplets',
        renderIcon: (a) => <Server size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'tpanel',
        label: 'TPanel Control Panel',
        badge: 'Pro',
        renderIcon: (a) => <PanelsTopLeft size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'images',
        label: 'Images',
        renderIcon: (a) => <ImageIcon size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'snapshots',
        label: 'Snapshots',
        renderIcon: (a) => <Camera size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'backups',
        label: 'Backups',
        renderIcon: (a) => <Archive size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'volumes',
        label: 'Volumes',
        renderIcon: (a) => <HardDrive size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'kubernetes',
        label: 'Kubernetes',
        badge: 'New',
        renderIcon: (a) => <Container size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
    ],
  },
  {
    section: 'Workspace Controls',
    items: [
      {
        id: 'workspace/performance',
        label: 'System Performance',
        renderIcon: (a) => <Activity size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace/security-alerts',
        label: 'Security Alerts',
        renderIcon: (a) => <ShieldAlert size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace/billing',
        label: 'Billing History',
        renderIcon: (a) => <CreditCard size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace/webhooks',
        label: 'Webhooks',
        renderIcon: (a) => <Webhook size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace/backup-policy',
        label: 'Backup Policy',
        renderIcon: (a) => <DatabaseBackup size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'workspace/data-export',
        label: 'Data Export',
        renderIcon: (a) => <Download size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
    ],
  },
  {
    section: 'Account',
    items: [
      {
        id: 'identity',
        label: 'Identity',
        renderIcon: (a) => <Fingerprint size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'profile-settings',
        label: 'User Settings',
        renderIcon: (a) => <Settings size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'active-sessions',
        label: 'Active Sessions',
        renderIcon: (a) => <Smartphone size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'two-factor-auth',
        label: 'Two-Factor Auth (2FA)',
        renderIcon: (a) => <KeyRound size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'team-management',
        label: 'Team Management',
        renderIcon: (a) => <Users size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'help-support',
        label: 'Help & Support',
        renderIcon: (a) => <HelpCircle size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
      {
        id: 'billing',
        label: 'Cloud Wallet & Plans',
        renderIcon: (a) => <CreditCard size={18} strokeWidth={1.9} color={iconColor(a)} />,
      },
    ],
  },
];

interface MenuScreenProps {
  activeNav: string;
  user: TiwloUser | null;
  storeCount: number;
  onBack: () => void;
  onSelectItem: (item: NavMenuItem) => void;
  onSelectBottomTab: (tab: BottomNavKey) => void;
  onAuthAction: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  activeNav,
  user,
  storeCount,
  onBack,
  onSelectItem,
  onSelectBottomTab,
  onAuthAction,
}) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const avatarUri = resolveAvatarUri(user?.avatar);

  const filteredGroups = useMemo(() => {
    const groups = getDashboardMenuGroups(storeCount);
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            group.section.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, storeCount]);

  return (
    <View style={styles.page}>
      {/* Full-Screen Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
        <View style={styles.topRow}>
          <View style={styles.titleLeft}>
            <TouchableOpacity
              onPress={onBack}
              accessibilityLabel="Back to dashboard"
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowLeft size={21} strokeWidth={2} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Menu</Text>
          </View>
          <Image
            source={require('../../assets/tiwlo-light-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.searchRow}>
          <Search size={15} strokeWidth={2} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search menu sections, stores, cloud..."
            placeholderTextColor="#A1A1AA"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} strokeWidth={2} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-Width Account Row */}
        <View style={styles.accountRow}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <UserRound size={22} strokeWidth={1.9} color={colors.foreground} />
            )}
          </View>
          <View style={styles.accountMeta}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name || user?.storeName || 'Tiwlo Workspace'}
            </Text>
            <Text style={styles.accountSub} numberOfLines={1}>
              {user?.tiwiId || user?.email || 'Sign in to sync stores & cloud droplets'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.authChip, !user && styles.authChipPrimary]}
            onPress={onAuthAction}
            activeOpacity={0.8}
          >
            {user ? (
              <LogOut size={14} strokeWidth={2} color={colors.danger} />
            ) : (
              <LogIn size={14} strokeWidth={2} color={colors.ink} />
            )}
            <Text style={[styles.authChipText, !user && styles.authChipPrimaryText]}>
              {user ? 'Sign out' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />

        {filteredGroups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matching menu items</Text>
            <Text style={styles.emptySub}>Try another keyword such as Store, Droplet, or 2FA.</Text>
          </View>
        ) : (
          filteredGroups.map((group, groupIdx) => (
            <React.Fragment key={group.section}>
              {groupIdx > 0 ? <View style={styles.sectionDivider} /> : null}
              <View style={styles.groupBlock}>
                <Text style={styles.groupLabel}>{group.section}</Text>
                {group.items.map((item, itemIdx) => {
                  const active = activeNav === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      {itemIdx > 0 ? <View style={styles.hairline} /> : null}
                      <TouchableOpacity
                        style={styles.menuRow}
                        onPress={() => onSelectItem(item)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.rowIconWrap}>{item.renderIcon(active)}</View>
                        <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                          {item.label}
                        </Text>
                        {item.badge ? (
                          <View
                            style={[
                              styles.badgePill,
                              active ? styles.badgePillActive : styles.badgePillMuted,
                            ]}
                          >
                            <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                              {item.badge}
                            </Text>
                          </View>
                        ) : null}
                        <ChevronRight size={16} strokeWidth={1.9} color={colors.muted} />
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </React.Fragment>
          ))
        )}
      </ScrollView>

      <MobileBottomNavbar activeTab="menu" onSelectTab={onSelectBottomTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  logo: {
    width: 84,
    height: 26,
  },
  searchRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: colors.foreground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 999,
  },
  accountMeta: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  accountSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  authChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authChipPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  authChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  authChipPrimaryText: {
    color: colors.ink,
    fontWeight: '700',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  groupBlock: {
    gap: 2,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  rowIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.foreground,
  },
  menuLabelActive: {
    fontWeight: '700',
    color: colors.primaryHover,
  },
  badgePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePillMuted: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgePillActive: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  badgeTextActive: {
    color: colors.ink,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
});
