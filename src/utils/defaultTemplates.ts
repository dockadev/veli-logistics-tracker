import type { StockpileTemplates, StockpileTemplateRule } from '../types';
import { ITEM_CATEGORY_MAP } from './itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from './colonialItems';

export const DEFAULT_TEMPLATE_COLORS: Record<string, string> = {
    frontline: '#ef4444', // Red
    backline: '#ffffff',  // White
    aircraft: '#06b6d4'   // Cyan
};

export const PRESET_COLORS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Yellow
    '#10b981', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ffffff'  // White
];

// Default Category-based Min/Max rules
const DEFAULT_CATEGORY_RULES: Record<string, { frontline: StockpileTemplateRule; backline: StockpileTemplateRule; aircraft: StockpileTemplateRule }> = {
    small_arms: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        aircraft: { min: 20, max: 200 }
    },
    heavy_arms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 },
        aircraft: { min: 10, max: 100 }
    },
    heavy_ammunition: {
        frontline: { min: 50, max: 600 },
        backline: { min: 200, max: 2000 },
        aircraft: { min: 50, max: 500 }
    },
    utility: {
        frontline: { min: 40, max: 400 },
        backline: { min: 150, max: 1500 },
        aircraft: { min: 30, max: 300 }
    },
    medical: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        aircraft: { min: 20, max: 200 }
    },
    materials: {
        frontline: { min: 100, max: 1000 },
        backline: { min: 500, max: 3000 },
        aircraft: { min: 200, max: 1500 }
    },
    uniforms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 },
        aircraft: { min: 40, max: 400 }
    },
    aircraft_parts: {
        frontline: { min: 10, max: 100 },
        backline: { min: 50, max: 500 },
        aircraft: { min: 100, max: 1000 }
    },
    vehicles: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        aircraft: { min: 0, max: 0 }
    },
    shippables: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        aircraft: { min: 0, max: 0 }
    },
    vehicle_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        aircraft: { min: 0, max: 0 }
    },
    shippable_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        aircraft: { min: 0, max: 0 }
    }
};

export function getDefaultTemplates(): StockpileTemplates {
    const frontline: Record<string, StockpileTemplateRule> = {};
    const backline: Record<string, StockpileTemplateRule> = {};
    const aircraft: Record<string, StockpileTemplateRule> = {};

    Object.entries(ITEM_CATEGORY_MAP).forEach(([itemName, category]) => {
        if (!COLONIAL_NEUTRAL_ITEMS.has(itemName)) return; // Skip Warden-only items!

        const rules = DEFAULT_CATEGORY_RULES[category] || {
            frontline: { min: 50, max: 500 },
            backline: { min: 150, max: 1500 },
            aircraft: { min: 20, max: 200 }
        };
        frontline[itemName] = { ...rules.frontline };
        backline[itemName] = { ...rules.backline };
        aircraft[itemName] = { ...rules.aircraft };
    });

    return { frontline, backline, aircraft };
}

export function getDefaultRuleForCategory(category: string, role: string): StockpileTemplateRule {
    const safeRole: 'frontline' | 'backline' | 'aircraft' = role === 'backline' ? 'backline' : role === 'aircraft' ? 'aircraft' : 'frontline';
    const rules = DEFAULT_CATEGORY_RULES[category] || {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        aircraft: { min: 20, max: 200 }
    };
    const target = rules[safeRole] || rules.frontline || { min: 50, max: 500 };
    return { ...target };
}
