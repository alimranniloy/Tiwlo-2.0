import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bell,
  LayoutGrid,
  Menu,
  Plus,
  Search,
  Server,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TiwloUser } from '../services/tiwloAuth';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import { colors } from '../theme/tokens';

export type BottomNavKey = 'dashboard' | 'products' | 'create-store' | 'cloud' | 'menu';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

function resolveAvatarUri(avatar?: string): string | null {
  const clean = typeof avatar === 'string' ? avatar.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('https://') || clean.startsWith('http://')) return clean;
  if (clean.startsWith('/')) return `${TIWLO_ORIGIN}${clean}`;
  return null;
}

interface MobileTopNavbarProps {
  user: TiwloUser | null;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
}

export const MobileTopNavbar: React.FC<MobileTopNavbarProps> = ({
  user,
  searchQuery,
  onSearchChange,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const avatarUri = resolveAvatarUri(user?.avatar);

  return (
    <View style={[styles.topWrap, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
      <View style={styles.topRow}>
        <Image
          source={require('../../assets/tiwlo-light-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.rightGroup}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenNotifications}
            accessibilityLabel="Activity notifications"
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Bell size={20} strokeWidth={1.9} color={colors.foreground} />
            {unreadCount > 0 ? <View style={styles.notifDot} /> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={onOpenProfile}
            accessibilityLabel="Account profile"
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <UserRound size={20} strokeWidth={1.9} color={colors.foreground} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Search size={15} strokeWidth={2} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search droplets, stores, domains..."
          placeholderTextColor="#A1A1AA"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => onSearchChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} strokeWidth={2} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

interface MobileBottomNavbarProps {
  activeTab: BottomNavKey;
  onSelectTab: (tab: BottomNavKey) => void;
}

const BOTTOM_ITEMS: {
  key: BottomNavKey;
  label: string;
  isCenterAction?: boolean;
  renderIcon: (active: boolean) => React.ReactNode;
}[] = [
  {
    key: 'dashboard',
    label: 'Overview',
    renderIcon: (active) => (
      <LayoutGrid size={20} strokeWidth={active ? 2.2 : 1.75} color={active ? colors.primaryHover : colors.muted} />
    ),
  },
  {
    key: 'products',
    label: 'Products',
    renderIcon: (active) => (
      <ShoppingBag size={20} strokeWidth={active ? 2.2 : 1.75} color={active ? colors.primaryHover : colors.muted} />
    ),
  },
  {
    key: 'create-store',
    label: 'Create',
    isCenterAction: true,
    renderIcon: () => <Plus size={22} strokeWidth={2.4} color={colors.ink} />,
  },
  {
    key: 'cloud',
    label: 'Cloud',
    renderIcon: (active) => (
      <Server size={20} strokeWidth={active ? 2.2 : 1.75} color={active ? colors.primaryHover : colors.muted} />
    ),
  },
  {
    key: 'menu',
    label: 'Menu',
    renderIcon: (active) => (
      <Menu size={20} strokeWidth={active ? 2.2 : 1.75} color={active ? colors.primaryHover : colors.muted} />
    ),
  },
];

export const MobileBottomNavbar: React.FC<MobileBottomNavbarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bottomBar,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      {BOTTOM_ITEMS.map((item) => {
        const active = activeTab === item.key;
        if (item.isCenterAction) {
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.centerBottomItem}
              onPress={() => onSelectTab(item.key)}
              accessibilityLabel="Create Store"
              activeOpacity={0.85}
            >
              <View style={[styles.centerActionCircle, active && styles.centerActionCircleActive]}>
                {item.renderIcon(active)}
              </View>
              <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.bottomItem}
            onPress={() => onSelectTab(item.key)}
            activeOpacity={0.75}
          >
            <View style={styles.bottomIconWrap}>
              {item.renderIcon(active)}
            </View>
            <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  topWrap: {
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
  logo: {
    width: 92,
    height: 28,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 999,
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
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  centerBottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    gap: 3,
  },
  centerActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#1ED760',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  centerActionCircleActive: {
    backgroundColor: colors.primaryHover,
  },
  bottomIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
  },
  bottomLabelActive: {
    color: colors.primaryHover,
    fontWeight: '600',
  },
});
