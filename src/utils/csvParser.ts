import type { ItemInfo } from '../types';
import { STANDARD_ITEMS } from './standardItems';

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

export function parseCSV(text: string): { location: string; timestamp: string; items: Record<string, ItemInfo> } | { error: string } | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    const headerLine = lines[0];
    const headerParts = headerLine.split(',');
    
    let location = 'Unknown Depot';
    let timestamp = new Date().toISOString();

    if (headerParts.length > 0) {
        const desc = headerParts[0].trim();
        const coordRegex = /X:\s*[0-9.-]+\s*Y:\s*[0-9.-]+/i;
        
        // Split by ' - ' (space-hyphen-space) to isolate segments, preserving tags like PARS-ARC-A
        const parts = desc.split(/\s+-\s+/).map(p => p.trim()).filter(p => p.length > 0);
        // Filter out coordinates segment
        const cleanedParts = parts.filter(p => !coordRegex.test(p));
        
        if (cleanedParts.length > 0) {
            const region = cleanedParts[0];
            const typeIndex = cleanedParts.findIndex(p => {
                const l = p.toLowerCase();
                return l.includes('seaport') || l.includes('depot') || l.includes('port');
            });
            if (typeIndex !== -1 && typeIndex > 0 && typeIndex < cleanedParts.length - 1) {
                location = `${region} - ${cleanedParts[typeIndex]} - ${cleanedParts[cleanedParts.length - 1]}`;
            } else if (cleanedParts.length >= 4) {
                location = `${cleanedParts[0]} - ${cleanedParts[2]} - ${cleanedParts[3]}`;
            } else if (cleanedParts.length > 0) {
                location = cleanedParts.join(' - ');
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
    const parsedItemNames = new Set<string>();
    const NORMALIZED_STANDARD_ITEMS = new Set(
        Array.from(STANDARD_ITEMS).map(item => item.replace(/[“”]/g, '"'))
    );

    blockGroups.forEach((group, blockIndex) => {
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
            if (!NORMALIZED_STANDARD_ITEMS.has(normalizedName)) {
                hasExtraItems = true;
                return;
            }
            parsedItemNames.add(normalizedName);

            if (count > 0) {
                let category: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle';
                const isCrate = name.endsWith('(Crate)');

                if (blockIndex === 1 || blockIndex === 2 || isVehicleName(name)) {
                    if (isCrate) {
                        category = 'crate_vehicle';
                    } else {
                        category = 'vehicle';
                    }
                } else if (blockIndex === 3 || blockIndex === 4 || isStructureName(name)) {
                    category = 'structure';
                } else {
                    category = 'crate';
                }

                items[name] = { count, category };
            }
        });
    });

    if (hasMalformedLine) {
        return { error: 'csv_malformed_line' };
    }
    if (hasExtraItems) {
        return { error: 'csv_extra_items' };
    }

    let missingAny = false;
    for (const item of NORMALIZED_STANDARD_ITEMS) {
        if (!parsedItemNames.has(item)) {
            missingAny = true;
            break;
        }
    }
    if (missingAny) {
        return { error: 'csv_missing_items' };
    }

    return {
        location,
        timestamp,
        items
    };
}
