import type { ItemInfo } from '../types';
import { STANDARD_ITEMS } from './standardItems';
import { getItemOfficialCategory } from './itemCategories';
import { ITEM_TRANSLATIONS } from './itemTranslations';

export function isVehicleName(name: string): boolean {
    const lower = name.toLowerCase();
    const vehicleKeywords = [
        'ambulance', 'truck', 'engine', 'freeman', 'squire', 'knave', 'gravekeeper', 
        'xiphos', 'wild jack', 'highlander', 'percutio', 'gemini', 'chariot', 'caravaner', 
        'assembly rig', 'flatbed', 'ironship', 'krokodil', 'blackguard', 'gunship', 'peltast', 
        'javelin', 'hoplite', 'skycaller', 'blinder', 'scar twin', 'scrap hauler', 'rigger', 
        'cliffwrest', 'acheron', 'doru', 'lpc', 'field gun', 'scorp', 'sagaris', 'birdeater', 
        'hatchet', 'ironhide', 'vulcan', 'kranesca', 'pelekys', 'strider', 'bardiche', 'thornfall', 
        'highwayman', 'outlaw', 'ranseur', 'brigand', 'nemesis', 'lordscar', 'falchion', 'talos', 
        'spatha', 'chieftain', 'ballista', 'caster', 'stinger', 'wheel', 'jester', 'gallant', 
        'spire', 'argonaut', 'icarus', 'spitfire', 'odyssey', 'loscann', 'tankette', 'battery', 
        'lamploader', 'tumblebox', 'junkwagon', 'hauler', 'leatherback', 'tanker', 'fuelrunner', 
        'sisyphus', 'landrunner', 'skirmisher', 'escort', 'loadlugger', 'transport'
    ];
    return vehicleKeywords.some(keyword => lower.includes(keyword));
}

export function isStructureName(name: string): boolean {
    const lower = name.toLowerCase();
    const structureKeywords = [
        'mixer', 'equipment', 'bolas', 'starbreaker', 'shellbore', 'ruptura', 'thunderbolt', 
        'exalt', 'polybolos', 'serra', 'snare trap', 'lariat', 'hades', 'fortress', 'radar', 
        'cannon', 'weather station', 'container', 'pallet', 'booster', 'rocket body', 'warhead', 
        'hull segment', 'shell plating', 'turbine'
    ];
    return structureKeywords.some(keyword => lower.includes(keyword));
}

function remapSubregion(name: string): string {
    const trimmed = name.trim();
    if (trimmed === 'Glimmerhaven') return "Light's End";
    if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
    if (trimmed === 'Rising Loom') return 'Therizo';
    return name;
}

export function parseCSV(text: string): { location: string; timestamp: string; items: Record<string, ItemInfo>; townName?: string | null } | { error: string; details?: string } | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    const headerLine = lines[0];
    const headerParts = headerLine.split(',');
    
    // Strict Foxhole CSV Validation:
    // 1. Header must have at least 2 comma-separated values
    // 2. First part must contain X and Y coordinates
    // 3. Second part must contain a timestamp matching YYYY.MM.DD-HH.MM.SS
    const coordRegex = /X:\s*[0-9.-]+\s*Y:\s*[0-9.-]+/i;
    if (headerParts.length < 2) return null;
    if (!coordRegex.test(headerParts[0])) return null;
    
    const timestampRegex = /^\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}$/;
    if (!timestampRegex.test(headerParts[1].trim())) return null;

    let location = 'Unknown Depot';
    let timestamp = new Date().toISOString();
    let townName: string | null = null;

    if (headerParts.length > 0) {
        const desc = headerParts[0].trim();
        const coordRegex = /X:\s*[0-9.-]+\s*Y:\s*[0-9.-]+/i;
        
        // Split by ' - ' (space-hyphen-space) to isolate segments, preserving tags like PARS-ARC-A
        const parts = desc.split(/\s+-\s+/).map(p => p.trim()).filter(p => p.length > 0);
        // Filter out coordinates segment
        const cleanedParts = parts.filter(p => !coordRegex.test(p));
        
        if (cleanedParts.length > 0) {
            const mappedParts = cleanedParts.map((part, index) => {
                if (index === 1) {
                    return remapSubregion(part);
                }
                const trimmed = part.trim();
                if (trimmed === 'Glimmerhaven') return "Light's End";
                if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
                if (trimmed === 'Rising Loom') return 'Therizo';
                
                const lower = trimmed.toLowerCase();
                if (lower === 'seehafen' || lower === 'porto' || lower === 'морской порт') return 'Seaport';
                if (lower === 'lagerdepot' || lower === 'depósito de suprimentos' || lower === 'склад') return 'Storage Depot';
                
                return part;
            });
            const region = mappedParts[0];
            const typeIndex = mappedParts.findIndex(p => {
                const l = p.toLowerCase();
                return l.includes('seaport') || l.includes('depot') || l.includes('port');
            });

            if (typeIndex !== -1 && typeIndex > 0) {
                if (typeIndex >= 2) {
                    townName = mappedParts[1];
                }
                const nameEnd = mappedParts.length > typeIndex + 1 ? mappedParts.slice(typeIndex + 1).join(' - ') : mappedParts[typeIndex];
                location = `${region} - ${mappedParts[typeIndex]} - ${nameEnd}`;
            } else if (mappedParts.length >= 3) {
                townName = mappedParts[1];
                location = mappedParts.join(' - ');
            } else {
                location = mappedParts.join(' - ');
            }
        }

        if (headerParts.length > 1) {
            const rawTime = headerParts[1].trim();
            const dateMatch = rawTime.match(/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})$/);
            if (dateMatch) {
                timestamp = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}Z`;
            } else {
                timestamp = rawTime;
            }
        }
    }

    const blockGroups = text.split(/\r?\n\r?\n/).map(block => {
        return block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    }).filter(b => b.length > 0);

    if (blockGroups.length > 0 && blockGroups[0][0] === headerLine) {
        blockGroups[0].shift();
    }

    const items: Record<string, ItemInfo> = {};
    let hasMalformedLine = false;
    let hasExtraItems = false;
    let failedItemName = '';
    const parsedItemNames = new Set<string>();
    const NORMALIZED_TO_STANDARD_MAP = new Map<string, string>();
    STANDARD_ITEMS.forEach(item => {
        const normalized = item.replace(/[“”]/g, '"');
        NORMALIZED_TO_STANDARD_MAP.set(normalized, item);
    });

    blockGroups.forEach((group) => {
        if (hasMalformedLine || hasExtraItems) return;

        group.forEach(line => {
            if (hasMalformedLine || hasExtraItems) return;
            const lastCommaIndex = line.lastIndexOf(',');
            if (lastCommaIndex === -1) {
                hasMalformedLine = true;
                return;
            }

            const name = line.substring(0, lastCommaIndex).trim();
            const countStr = line.substring(lastCommaIndex + 1).trim();
            const count = parseInt(countStr, 10);

            if (isNaN(count)) {
                hasMalformedLine = true;
                return;
            }

            if (!name || name === '__proto__' || name === 'constructor') {
                hasMalformedLine = true;
                return;
            }

            const normalizedName = name.replace(/[“”]/g, '"');
            let finalName = normalizedName;
            const lookupKey = normalizedName.toLowerCase();
            if (ITEM_TRANSLATIONS[lookupKey]) {
                finalName = ITEM_TRANSLATIONS[lookupKey];
            }

            if (!NORMALIZED_TO_STANDARD_MAP.has(finalName)) {
                hasExtraItems = true;
                failedItemName = name;
                return;
            }
            const standardName = NORMALIZED_TO_STANDARD_MAP.get(finalName)!;
            parsedItemNames.add(finalName);

            if (count > 0) {
                const officialCat = getItemOfficialCategory(standardName);
                const category: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle' = 
                    officialCat === 'vehicles' ? (standardName.endsWith('(Crate)') ? 'crate_vehicle' : 'vehicle') :
                    officialCat === 'shippables' ? 'structure' :
                    standardName.endsWith('(Crate)') ? 'crate' : 'item';

                items[standardName] = { count, category };
            }
        });
    });

    if (hasMalformedLine) {
        return { error: 'csv_malformed_line' };
    }
    if (hasExtraItems) {
        return { error: 'csv_extra_items', details: failedItemName };
    }

    // Missing items from standard list are allowed and treated as 0 count/omitted.

    return {
        location,
        timestamp,
        items,
        townName
    };
}
