import type { Language } from './localization';

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
        else if (trimmed === 'Loftmire') tName = 'Blemish';
        else if (trimmed === 'Rising Loom') tName = 'Therizo';

        const parts = dep.name.split(' - ');
        if (parts.length >= 2) {
            return `${parts[0]} - ${tName} - ${parts.slice(1).join(' - ')}`;
        }
    }
    return dep.name;
};
