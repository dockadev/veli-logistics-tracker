import type { StockpileTemplates, StockpileTemplateRule } from '../types';
import { ITEM_CATEGORY_MAP } from './itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from './colonialItems';

// Default Category-based Min/Max rules
const DEFAULT_CATEGORY_RULES: Record<string, { frontline: StockpileTemplateRule; backline: StockpileTemplateRule }> = {
    small_arms: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 }
    },
    heavy_arms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 }
    },
    heavy_ammunition: {
        frontline: { min: 50, max: 600 },
        backline: { min: 200, max: 2000 }
    },
    utility: {
        frontline: { min: 40, max: 400 },
        backline: { min: 150, max: 1500 }
    },
    medical: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 }
    },
    materials: {
        frontline: { min: 100, max: 1000 },
        backline: { min: 500, max: 3000 }
    },
    uniforms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 }
    },
    aircraft_parts: {
        frontline: { min: 10, max: 100 },
        backline: { min: 50, max: 500 }
    },
    vehicles: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 }
    },
    shippables: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 }
    },
    vehicle_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 }
    },
    shippable_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 }
    }
};

export function getDefaultTemplates(): StockpileTemplates {
    const frontline: Record<string, StockpileTemplateRule> = {};
    const backline: Record<string, StockpileTemplateRule> = {};

    Object.entries(ITEM_CATEGORY_MAP).forEach(([itemName, category]) => {
        if (!COLONIAL_NEUTRAL_ITEMS.has(itemName)) return; // Skip Warden-only items!

        const rules = DEFAULT_CATEGORY_RULES[category] || {
            frontline: { min: 50, max: 500 },
            backline: { min: 150, max: 1500 }
        };
        frontline[itemName] = { ...rules.frontline };
        backline[itemName] = { ...rules.backline };
    });

    return { frontline, backline };
}

export function getDefaultRuleForCategory(category: string, role: string): StockpileTemplateRule {
    const safeRole: 'frontline' | 'backline' = role === 'backline' ? 'backline' : 'frontline';
    const rules = DEFAULT_CATEGORY_RULES[category] || {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 }
    };
    const target = rules[safeRole] || rules.frontline || { min: 50, max: 500 };
    return { ...target };
}
