import { en } from './en';
import { tr } from './tr';
import { ptBR } from './ptBR';
import { ru } from './ru';
import { de } from './de';
import type { Language } from './types';

export type { Language };
export type TranslationKey = keyof typeof en;

export const translations: Record<Language, Record<string, string>> = {
    en: en as Record<string, string>,
    tr: tr as Record<string, string>,
    'pt-BR': ptBR as Record<string, string>,
    ru: ru as Record<string, string>,
    de: de as Record<string, string>
};
