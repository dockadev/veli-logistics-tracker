import { STANDARD_ITEMS } from './standardItems';
import { normalizeItemKey } from './helpers';

// Lookup map from normalized key to canonical standard item display name
const CANONICAL_LOOKUP_MAP: Record<string, string> = {};

// Populate canonical map from STANDARD_ITEMS
STANDARD_ITEMS.forEach(itemName => {
    const normKey = normalizeItemKey(itemName);
    if (!CANONICAL_LOOKUP_MAP[normKey]) {
        CANONICAL_LOOKUP_MAP[normKey] = itemName;
    }
});

/**
 * Returns the exact canonical standard item display name for any given item string
 * (resolves straight quotes, curly quotes, special slashes, extra spaces, etc.).
 */
export function toCanonicalItemName(rawName: string): string {
    if (!rawName) return '';
    const cleanName = rawName.replace(/[\u201c\u201d\u201e\u201f\u2033\u2036"]/g, '"').replace(/[\u2018\u2019\u201a\u201b`']/g, "'").trim();
    const normKey = normalizeItemKey(cleanName);
    
    if (CANONICAL_LOOKUP_MAP[normKey]) {
        return CANONICAL_LOOKUP_MAP[normKey];
    }
    
    return cleanName;
}

/**
 * Normalizes a stockpile template role dictionary so that all keys are deduplicated
 * and mapped strictly to their canonical item display name.
 */
export function canonicalizeTemplateRole<T>(roleDict: Record<string, T>): Record<string, T> {
    const result: Record<string, T> = {};
    if (!roleDict || typeof roleDict !== 'object') return result;

    Object.entries(roleDict).forEach(([key, val]) => {
        if (!val) return;
        const canonicalKey = toCanonicalItemName(key);
        
        // If entry already exists, update/merge so we prefer explicit/recent values
        if (!result[canonicalKey]) {
            result[canonicalKey] = val;
        } else {
            // If existing is 0/0 and new val has >0, or vice versa, prioritize non-zero or clean rule
            const existingRule: any = result[canonicalKey];
            const newRule: any = val;
            
            // Prefer the rule that has active/custom bounds if one is 0/0
            if (existingRule && typeof existingRule === 'object') {
                const existingMax = existingRule.max || 0;
                const newMax = newRule.max || 0;
                
                if (existingMax === 0 && newMax > 0) {
                    result[canonicalKey] = val;
                }
            }
        }
    });

    return result;
}
