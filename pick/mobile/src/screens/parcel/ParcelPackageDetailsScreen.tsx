import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { Header } from '../../components/common/Header';
import { PickIcon } from '../../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../../components/common/ScreenContainer';

export interface PackageDetailsData {
  categoryId: string;
  categoryName: string;
  weight: number;
  value: number;
  handleWithCare: boolean;
  keepUpright: boolean;
  directHandover: boolean;
  notes: string;
}

interface ParcelPackageDetailsScreenProps {
  onBack: () => void;
  initialData?: PackageDetailsData;
  onSave: (data: PackageDetailsData) => void;
}

const CATEGORIES = [
  { id: 'docs', name: 'কাগজপত্র ও ফাইল' },
  { id: 'gadgets', name: 'ইলেকট্রনিক্স' },
  { id: 'clothes', name: 'পোশাক ও উপহার' },
  { id: 'fragile', name: 'ভঙ্গুর সামগ্রী' },
  { id: 'box', name: 'কার্টন ও বক্স' },
];

export const ParcelPackageDetailsScreen: React.FC<ParcelPackageDetailsScreenProps> = ({
  onBack,
  initialData,
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(
    initialData?.categoryId ?? 'docs'
  );
  const [weight, setWeight] = useState(initialData?.weight ?? 1.5);
  const [value, setValue] = useState(initialData?.value?.toString() ?? '');
  const [handleWithCare, setHandleWithCare] = useState(
    initialData?.handleWithCare ?? true
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  const handleSave = () => {
    const cat = CATEGORIES.find((c) => c.id === selectedCategory);
    onSave({
      categoryId: selectedCategory,
      categoryName: cat?.name ?? 'পার্সেল',
      weight,
      value: parseInt(value, 10) || 0,
      handleWithCare,
      keepUpright: false,
      directHandover: true,
      notes,
    });
    onBack();
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title="প্যাকেজের তথ্য" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Selection - Clean Tabs */}
        <Text style={styles.sectionTitle}>প্যাকেজের ধরন</Text>
        <View style={styles.categoriesBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Weight Stepper - Flat on background */}
        <Text style={styles.sectionTitle}>আনুমানিক ওজন (কেজি)</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setWeight((prev) => Math.max(0.5, +(prev - 0.5).toFixed(1)))}
          >
            <PickIcon name="minus" size={16} color="#09090B" />
          </TouchableOpacity>
          <Text style={styles.weightValue}>{weight} কেজি</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => setWeight((prev) => +(prev + 0.5).toFixed(1))}
          >
            <PickIcon name="plus" size={16} color="#09090B" />
          </TouchableOpacity>
        </View>

        {/* Estimated Value Input */}
        <Text style={styles.sectionTitle}>আনুমানিক মূল্য (টাকা)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value}
          onChangeText={setValue}
          placeholder="যেমন: ১৫০০"
          placeholderTextColor="#A1A1AA"
        />

        {/* Safety Care Switch */}
        <View style={styles.switchRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>ভঙ্গুর সামগ্রী (সাবধানে হ্যান্ডেল করুন)</Text>
          </View>
          <Switch
            value={handleWithCare}
            onValueChange={setHandleWithCare}
            thumbColor={handleWithCare ? '#09090B' : '#F4F4F5'}
            trackColor={{ false: '#E4E4E7', true: '#A1A1AA' }}
          />
        </View>

        {/* Rider Notes Input */}
        <Text style={styles.sectionTitle}>রাইডারের জন্য নির্দেশ (ঐচ্ছিক)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="যেমন: সাবধানে নেবেন, পার্সেল বাঁকাবেন না"
          placeholderTextColor="#A1A1AA"
          multiline
        />
      </ScrollView>

      {/* Primary Action Button */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: SYSTEM_INSETS.bottom + 16 },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>সংরক্ষণ করুন</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 10,
    marginTop: 14,
  },
  categoriesBar: {
    marginBottom: 8,
  },
  categoryScroll: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F4F4F5',
  },
  categoryChipActive: {
    backgroundColor: '#09090B',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  stepBtn: {
    padding: 8,
  },
  weightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#09090B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    marginTop: 10,
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#09090B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
