import type { StockpileTemplates, StockpileTemplateRule } from '../types';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory } from './itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from './colonialItems';

export const DEFAULT_TEMPLATE_COLORS: Record<string, string> = {
    frontline: '#ef4444', // Red
    backline: '#ffffff',  // White
    airfield: '#06b6d4'   // Cyan
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
const DEFAULT_CATEGORY_RULES: Record<string, { frontline: StockpileTemplateRule; backline: StockpileTemplateRule; airfield: StockpileTemplateRule }> = {
    small_arms: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        airfield: { min: 20, max: 200 }
    },
    heavy_arms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 },
        airfield: { min: 10, max: 100 }
    },
    heavy_ammunition: {
        frontline: { min: 50, max: 600 },
        backline: { min: 200, max: 2000 },
        airfield: { min: 50, max: 500 }
    },
    utility: {
        frontline: { min: 40, max: 400 },
        backline: { min: 150, max: 1500 },
        airfield: { min: 30, max: 300 }
    },
    medical: {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        airfield: { min: 20, max: 200 }
    },
    materials: {
        frontline: { min: 100, max: 1000 },
        backline: { min: 500, max: 3000 },
        airfield: { min: 200, max: 1500 }
    },
    uniforms: {
        frontline: { min: 30, max: 300 },
        backline: { min: 100, max: 1000 },
        airfield: { min: 40, max: 400 }
    },
    aircraft_parts: {
        frontline: { min: 10, max: 100 },
        backline: { min: 50, max: 500 },
        airfield: { min: 100, max: 1000 }
    },
    vehicles: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        airfield: { min: 0, max: 0 }
    },
    shippables: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        airfield: { min: 0, max: 0 }
    },
    vehicle_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        airfield: { min: 0, max: 0 }
    },
    shippable_crates: {
        frontline: { min: 0, max: 0 },
        backline: { min: 0, max: 0 },
        airfield: { min: 0, max: 0 }
    }
};

export function getDefaultTemplates(): StockpileTemplates {
    const frontline: Record<string, StockpileTemplateRule> = {};
    const backline: Record<string, StockpileTemplateRule> = {};
    const airfield: Record<string, StockpileTemplateRule> = {};

    COLONIAL_NEUTRAL_ITEMS.forEach(rawName => {
        const cat = ITEM_CATEGORY_MAP[rawName] || getItemOfficialCategory(rawName);

        const applyRule = (itemName: string, category: string) => {
            const rules = DEFAULT_CATEGORY_RULES[category] || {
                frontline: { min: 50, max: 500 },
                backline: { min: 150, max: 1500 },
                airfield: { min: 20, max: 200 }
            };
            frontline[itemName] = { ...rules.frontline };
            backline[itemName] = { ...rules.backline };
            airfield[itemName] = { ...rules.airfield };
        };

        if (cat === 'vehicles' || cat === 'shippables') {
            applyRule(rawName, cat);
            const crateCat = cat === 'vehicles' ? 'vehicle_crates' : 'shippable_crates';
            applyRule(`${rawName} (Crate)`, crateCat);
        } else {
            const crateName = rawName.endsWith('(Crate)') ? rawName : `${rawName} (Crate)`;
            applyRule(crateName, cat);
        }
    });

    return { frontline, backline, airfield };
}

export function getDefaultRuleForCategory(category: string, role: string): StockpileTemplateRule {
    const safeRole: 'frontline' | 'backline' | 'airfield' = role === 'backline' ? 'backline' : role === 'airfield' ? 'airfield' : 'frontline';
    const rules = DEFAULT_CATEGORY_RULES[category] || {
        frontline: { min: 50, max: 500 },
        backline: { min: 150, max: 1500 },
        airfield: { min: 20, max: 200 }
    };
    const target = rules[safeRole] || rules.frontline || { min: 50, max: 500 };
    return { ...target };
}
