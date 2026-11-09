import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  SupportedLanguage,
  AVAILABLE_LANGUAGES,
  translations,
  LanguageMeta,
} from '../i18n/languages';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (keyOrEn: string, bnFallback?: string) => string;
  availableLanguages: LanguageMeta[];
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (keyOrEn: string, _bnFallback?: string) => keyOrEn,
  availableLanguages: AVAILABLE_LANGUAGES,
});

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // English is the default language as specified
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'bn' : 'en'));
  };

  /**
   * Flexible translation helper:
   * 1. If key is like 'home.popularSection', it retrieves from languages.ts dictionary.
   * 2. If called as t('English String', 'বাংলা স্ট্রিং'), it chooses based on current language.
   */
  const t = (keyOrEn: string, bnFallback?: string): string => {
    if (bnFallback !== undefined) {
      return language === 'bn' ? bnFallback : keyOrEn;
    }

    if (keyOrEn.includes('.')) {
      const parts = keyOrEn.split('.');
      let current: any = translations[language];
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (typeof current === 'string') {
        return current;
      }
    }

    return keyOrEn;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        availableLanguages: AVAILABLE_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
