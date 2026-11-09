import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View
} from 'react-native';
import { SYSTEM_INSETS } from './ScreenContainer';
import { useLanguage } from '../../context/LanguageContext';

interface WarningSheetProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

export const WarningSheet: React.FC<WarningSheetProps> = ({
  visible,
  title,
  message,
  onDismiss
}) => {
  const isDark = useColorScheme() === 'dark';
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss warning"
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <View
          accessibilityRole="alert"
          style={[
            styles.sheet,
            isDark && styles.sheetDark,
            { paddingBottom: SYSTEM_INSETS.bottom + 18 }
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.icon}>
            <Text style={styles.iconText}>!</Text>
          </View>
          <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.button, isDark && styles.buttonDark]}
            onPress={onDismiss}
          >
            <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>
              {t('Got it', 'বুঝেছি')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 9, 11, 0.48)'
  },
  sheet: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12
  },
  sheetDark: { backgroundColor: '#18181B' },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4D4D8',
    marginBottom: 22
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    marginBottom: 14
  },
  iconText: { color: '#B45309', fontSize: 24, fontWeight: '700' },
  title: { color: '#09090B', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  titleDark: { color: '#FAFAFA' },
  message: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center'
  },
  messageDark: { color: '#D4D4D8' },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#09090B',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    marginTop: 22
  },
  buttonDark: { backgroundColor: '#FAFAFA' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  buttonTextDark: { color: '#09090B' }
});
