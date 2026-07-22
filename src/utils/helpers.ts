import type { Language } from './localization';
import type { RegionSettings, RegionSetting } from '../types';

export function resolveTemplateSetting(
  regionName?: string | null,
  townName?: string | null,
  subregionName?: string | null,
  regionSettings: RegionSettings = {}
): RegionSetting {
  const reg = regionName ? regionName.trim() : '';
  const town = townName ? townName.trim() : '';
  const sub = subregionName ? subregionName.trim() : '';

  if (reg && sub) {
    const fullSubKey = `${reg} - ${sub}`;
    if (regionSettings[fullSubKey]) return regionSettings[fullSubKey];
  }
  if (reg && town) {
    const fullTownKey = `${reg} - ${town}`;
    if (regionSettings[fullTownKey]) return regionSettings[fullTownKey];
  }

  if (sub && regionSettings[sub]) return regionSettings[sub];
  if (town && regionSettings[town]) return regionSettings[town];

  if (reg && regionSettings[reg]) return regionSettings[reg];

  if (reg) {
    const matchingKey = Object.keys(regionSettings).find(k => k.startsWith(`${reg} - `) || k === reg);
    if (matchingKey && regionSettings[matchingKey]) return regionSettings[matchingKey];
  }

  return { regionName: reg || 'Unknown', templateType: 'unassigned', demandPercentage: 100 };
}

export const FOXHOLE_REGIONS = [
    "Deadlands",
    "Loch Mór",
    "Terminus",
    "Ash Fields",
    "Callahan's Passage",
    "Weathered Expanse",
    "Marban Hollow",
    "Farranac Coast",
    "Speaking Woods",
    "The Fingers"
];

export const getCategoryClass = (category: string) => {
    switch (category) {
        case 'small_arms':
        case 'medical':
            return 'badge-item';
        case 'heavy_arms':
        case 'materials':
            return 'badge-crate';
        case 'vehicles':
        case 'shippables':
            return 'badge-vehicle';
        case 'heavy_ammunition':
        case 'aircraft_parts':
            return 'badge-crate-vehicle';
        case 'utility':
        case 'uniforms':
            return 'badge-structure';
        default:
            return 'badge-item';
    }
};

export const getPaginationRange = (currentPage: number, totalPages: number): Array<number | 'DOTS'> => {
    const totalPageNumbers = 6;

    if (totalPages <= totalPageNumbers) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - 1, 1);
    const rightSiblingIndex = Math.min(currentPage + 1, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
        const leftItemCount = 3;
        const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
        return [...leftRange, 'DOTS', lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
        const rightItemCount = 3;
        const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
        return [firstPageIndex, 'DOTS', ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
        const middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
        return [firstPageIndex, 'DOTS', ...middleRange, 'DOTS', lastPageIndex];
    }

    return [];
};

export const getRelativeTimeString = (timestamp: string, language: Language): string => {
    if (!timestamp) return '';
    try {
        let date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            // Try ISO normalization
            const iso = timestamp.trim().replace(' ', 'T');
            date = new Date(iso);
        }
        if (isNaN(date.getTime())) {
            // Try safari-friendly format YYYY/MM/DD HH:MM:SS
            const saf = timestamp.replace(/-/g, '/');
            date = new Date(saf);
        }
        if (isNaN(date.getTime())) {
            return timestamp;
        }
        
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        
        if (diffMs < 5000) {
            if (language === 'tr') return 'şimdi';
            if (language === 'pt-BR') return 'agora mesmo';
            if (language === 'ru') return 'прямо сейчас';
            if (language === 'de') return 'gerade eben';
            return 'just now';
        }
        
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHr / 24);
        
        if (diffSec < 60) {
            if (language === 'tr') return `${diffSec} saniye önce`;
            if (language === 'pt-BR') return `há ${diffSec} segundos`;
            if (language === 'ru') return `${diffSec} сек. назад`;
            if (language === 'de') return `vor ${diffSec} Sekunden`;
            return `${diffSec} seconds ago`;
        }
        if (diffMin < 60) {
            if (language === 'tr') return `${diffMin} dakika önce`;
            if (language === 'pt-BR') return `há ${diffMin} minutos`;
            if (language === 'ru') return `${diffMin} мин. назад`;
            if (language === 'de') return `vor ${diffMin} Minuten`;
            return `${diffMin} minutes ago`;
        }
        if (diffHr < 24) {
            if (language === 'tr') return `${diffHr} saat önce`;
            if (language === 'pt-BR') return `há ${diffHr} horas`;
            if (language === 'ru') return `${diffHr} ч. назад`;
            if (language === 'de') return `vor ${diffHr} Stunden`;
            return `${diffHr} hours ago`;
        }
        if (diffDays < 30) {
            if (language === 'tr') return `${diffDays} gün önce`;
            if (language === 'pt-BR') return `há ${diffDays} dias`;
            if (language === 'ru') return `${diffDays} дн. назад`;
            if (language === 'de') return `vor ${diffDays} Tagen`;
            return `${diffDays} days ago`;
        }
        
        let localeStr = 'en-US';
        if (language === 'tr') localeStr = 'tr-TR';
        else if (language === 'pt-BR') localeStr = 'pt-BR';
        else if (language === 'ru') localeStr = 'ru-RU';
        else if (language === 'de') localeStr = 'de-DE';
        
        return date.toLocaleDateString(localeStr);
    } catch {
        return timestamp;
    }
};

export interface DepotMinimal {
    name: string;
    customName: string | null;
    townName?: string | null;
}

export const getDepotDisplayName = (dep: DepotMinimal): string => {
    if (dep.customName) return dep.customName;
    if (dep.townName) {
        let tName = dep.townName;
        const trimmed = tName.trim();
        if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") tName = "Light's End";
        else if (trimmed === 'Loftmire' || trimmed === 'The Blemish') tName = 'Blemish';
        else if (trimmed === 'Rising Loom') tName = 'Therizo';

        const parts = dep.name.split(' - ');
        if (parts.length >= 2) {
            return `${parts[0]} - ${tName} - ${parts.slice(1).join(' - ')}`;
        }
    }
    return dep.name;
};

export const getRelativeTimeColor = (timestamp: string): string => {
    if (!timestamp) return 'var(--text-muted)';
    try {
        let date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            const iso = timestamp.trim().replace(' ', 'T');
            date = new Date(iso);
        }
        if (isNaN(date.getTime())) {
            const saf = timestamp.replace(/-/g, '/');
            date = new Date(saf);
        }
        if (isNaN(date.getTime())) {
            return 'var(--text-muted)';
        }
        
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHr = diffMs / (1000 * 60 * 60);
        
        if (diffHr < 6) return '#10B981'; // Green
        if (diffHr < 12) return '#F59E0B'; // Yellow
        if (diffHr < 24) return '#F97316'; // Orange
        return '#EF4444'; // Red
    } catch {
        return 'var(--text-muted)';
    }
};

export const playChimeSound = (): void => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        
        const ctx = new AudioContextClass();
        
        // Tone 1: C5 (523.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.value = 523.25;
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        // Tone 2: E5 (659.25 Hz) starting slightly later
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 659.25;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
        gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);
        
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.error('Failed to play chime sound:', e);
    }
};

export function formatCanonicalItemName(itemName: string): string {
    if (!itemName) return itemName;
    if (itemName === 'Supplies') return 'Maintenance Supplies';
    if (itemName === 'Supplies (Crate)') return 'Maintenance Supplies (Crate)';
    if (itemName === 'Garrison Supplies') return 'Maintenance Supplies';
    if (itemName === 'Garrison Supplies (Crate)') return 'Maintenance Supplies (Crate)';
    if (itemName === 'Plasma') return 'Blood Plasma';
    if (itemName === 'Plasma (Crate)') return 'Blood Plasma (Crate)';
    if (itemName === 'Bandage') return 'Bandages';
    if (itemName === 'Bandage (Crate)') return 'Bandages (Crate)';
    return itemName;
}
