/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { translations } from '../utils/localization';
import type { Language } from '../utils/localization';
import { supabase } from '../utils/supabaseClient';
export type { Language };

export type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem('foxhole_depot_lang');
        return (stored === 'tr' || stored === 'en' || stored === 'pt-BR' || stored === 'ru' || stored === 'de') ? (stored as Language) : 'en';
    });

    const setLanguage = async (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('foxhole_depot_lang', lang);
        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    await supabase
                        .from('profiles')
                        .update({ language: lang })
                        .eq('id', session.user.id);
                }
            } catch (e) {
                console.error('[LanguageContext] Failed to sync language to Supabase:', e);
            }
        }
    };

    const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
        const langObj = translations[language] as Record<string, string>;
        const enObj = translations['en'] as Record<string, string>;
        let text = langObj[key] || enObj[key] || String(key);
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        // Dev/HMR safety: fall back to English instead of crashing the tree
        console.warn('[LanguageContext] useLanguage called outside LanguageProvider — using English fallback.');
        return {
            language: 'en' as Language,
            setLanguage: async () => {},
            t: ((key: string) => {
                const enDict = translations['en'] as Record<string, string>;
                return enDict[key] || key;
            }) as never
        };
    }
    return context;
};
