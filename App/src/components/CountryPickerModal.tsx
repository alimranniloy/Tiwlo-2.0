import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Check, ChevronDown, Globe, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COUNTRIES,
  CountryOption,
  findCountry,
  searchCountries,
} from '../utils/countries';
import { colors } from '../theme/tokens';

interface CountryPickerFieldProps {
  value: string;
  onChange: (countryName: string, country: CountryOption) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  showDialCode?: boolean;
  triggerStyle?: StyleProp<ViewStyle>;
}

export const CountryPickerField: React.FC<CountryPickerFieldProps> = ({
  value,
  onChange,
  placeholder = 'Select country',
  title = 'Select country',
  disabled = false,
  showDialCode = false,
  triggerStyle,
}) => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selectedCountry = useMemo(() => findCountry(value), [value]);
  const filtered = useMemo(() => searchCountries(query), [query]);

  const closeModal = () => {
    setVisible(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        style={[styles.trigger, disabled && styles.triggerDisabled, triggerStyle]}
        onPress={() => {
          if (!disabled) setVisible(true);
        }}
        disabled={disabled}
        activeOpacity={0.75}
      >
        <View style={styles.triggerLeft}>
          {selectedCountry?.flag ? (
            <Text style={styles.triggerFlag}>{selectedCountry.flag}</Text>
          ) : (
            <Globe size={15} strokeWidth={1.9} color={colors.muted} />
          )}
          <Text
            numberOfLines={1}
            style={[styles.triggerText, !value && styles.placeholderText]}
          >
            {selectedCountry?.name || value || placeholder}
          </Text>
        </View>
        <ChevronDown size={15} strokeWidth={2} color={colors.muted} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View
          style={[
            styles.modalPage,
            {
              paddingTop: Math.max(insets.top, 16) + 8,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close country picker"
              onPress={closeModal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={22} strokeWidth={2} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} strokeWidth={1.9} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${COUNTRIES.length} countries or code...`}
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No matching country found.</Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedCountry?.code === item.code;
              return (
                <TouchableOpacity
                  style={[styles.countryRow, isSelected && styles.countryRowActive]}
                  onPress={() => {
                    onChange(item.name, item);
                    closeModal();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text numberOfLines={1} style={styles.countryName}>
                    {item.name}
                  </Text>
                  <Text style={styles.countryCode}>
                    {showDialCode ? `${item.code} · ${item.dial}` : item.code}
                  </Text>
                  {isSelected ? (
                    <Check size={16} strokeWidth={2.4} color={colors.primaryHover} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerDisabled: {
    opacity: 0.6,
  },
  triggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  triggerFlag: {
    fontSize: 17,
  },
  triggerText: {
    flex: 1,
    fontSize: 14.5,
    color: colors.foreground,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  modalPage: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  searchWrap: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: colors.foreground,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 13.5,
    paddingVertical: 28,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  countryRowActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
  },
  countryFlag: {
    fontSize: 19,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '500',
  },
  countryCode: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
});
