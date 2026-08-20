import type { Depot, ItemInfo, AuditLogEntry } from '../types';
import { COLONIAL_NEUTRAL_ITEMS } from './colonialItems';
import { ITEM_CATEGORY_MAP } from './itemCategories';

// Dynamically build ALL 200+ Colonial and Neutral items from official game definitions
export const ALL_TEST_ITEMS = Array.from(COLONIAL_NEUTRAL_ITEMS).map(name => {
    const officialCat = ITEM_CATEGORY_MAP[name];
    let category: 'crate' | 'vehicle' | 'structure' | 'crate_vehicle' = 'crate';
    
    if (officialCat === 'vehicles') {
        category = name.endsWith('(Crate)') ? 'crate_vehicle' : 'vehicle';
    } else if (officialCat === 'shippables') {
        category = 'structure';
    } else {
        category = 'crate';
    }

    return { name, category };
});

// Every region gets 3 subregions, each with 3 depots (Storage Depot + Seaport + Aircraft Depot)
const DEPOT_TYPES = ['Storage Depot', 'Seaport', 'Aircraft Depot'] as const;

const TEST_REGION_SUBREGIONS: [string, string[]][] = [
    ['Deadlands', ['Plaza', 'Harbor', 'Bitter Junction']],
    ['Linn of Mercy', ['Ulster Falls', 'North Gate', 'Dockside']],
    ['Marban Hollow', ['Spitrock', 'East Ridge', 'Quarry Town']],
    ['Callahans Passage', ['Whitegrove', 'Central', 'Old Port']],
    ['Drowned Vale', ['Salt Farms', 'South End', 'Mud Hollow']],
    ['Shackled Chasm', ['Silk Farms', 'Crossroads', 'West Bank']],
    ['Farranac Coast', ['Jade Cove', 'Factory Row', 'Finger Lake']],
    ['Westgate', ['Longstone', 'Garrison', 'Iron Junction']],
    ['Heartlands', ['Blemish', 'Airfield', 'Rustroad']],
    ['Umbral Wildwood', ['Hermits Rest', 'Outskirts', 'Dark Wood']],
    ['Brodytown', ['Main Square', 'River Docks', 'Mill Town']],
    ['Sun Haven', ['Central Port', 'Industrial Zone', 'Grain Fields']],
    ['Viper Pit', ['Kirknell', 'Rail Yard', 'Copper Hill']],
    ['Weathered Expanse', ['Weatherby', 'Mill District', 'Canyon Pass']],
    ['Great March', ['Scurvyshire', 'Market District', 'East March']],
    ['Fishermans Row', ['Partisan Island', 'Old Town', 'Reed Fields']],
    ['Oarbreaker', ['Skelio', 'Fortress', 'Storm Coast']],
    ['Stonewall', ['Main Port', 'Garrison North', 'Stone Quarry']],
    ['Red River', ['Cannonsmoke', 'River Mouth', 'Red Plains']],
    ['Kalokai', ['The Basin', 'East Docks', 'Volcanic Ridge']]
];

export const TEST_DEPOT_NAMES = TEST_REGION_SUBREGIONS.flatMap(([region, subregions]) =>
    subregions.flatMap(subregion =>
        DEPOT_TYPES.map(type => `TEST-${region} - ${type} - ${subregion}`)
    )
);

/**
 * SET 1: Initial State & 7-Day History
 * Populates ALL 200+ Colonial/Neutral items into 20 test depots with healthy initial stock + previous stock 7 days ago.
 */
export const generateTestDepotsSet1 = (): { depots: Record<string, Depot>; logs: AuditLogEntry[] } => {
    const generated: Record<string, Depot> = {};
    const logs: AuditLogEntry[] = [];
    const now = new Date();

    TEST_DEPOT_NAMES.forEach((name, depotIdx) => {
        const current: Record<string, ItemInfo> = {};
        const previous: Record<string, ItemInfo> = {};
        const subregion = name.split(' - ')[2] || '';

        // Include ALL 200+ Colonial/Neutral items per depot for 100% full analytics
        ALL_TEST_ITEMS.forEach((item, itemIdx) => {
            let initialCount = 0;
            let currentCount = 0;

            const officialCat = ITEM_CATEGORY_MAP[item.name] || 'small_arms';

            if (officialCat === 'heavy_ammunition' || item.name.includes('Supplies')) {
                // High volume ammunition & supplies
                const base = 80 + ((depotIdx * 19 + itemIdx * 29) % 450);
                initialCount = base + 120;
                currentCount = base + 50;
            } else if (officialCat === 'small_arms' || officialCat === 'heavy_arms' || officialCat === 'medical') {
                const base = 40 + ((depotIdx * 13 + itemIdx * 17) % 250);
                initialCount = base + 70;
                currentCount = base + 30;
            } else if (officialCat === 'vehicles' || officialCat === 'shippables') {
                const base = 2 + ((depotIdx + itemIdx) % 18);
                initialCount = base + 5;
                currentCount = base + 1;
            } else {
                const base = 30 + ((depotIdx * 11 + itemIdx * 23) % 200);
                initialCount = base + 50;
                currentCount = base + 20;
            }

            current[item.name] = {
                count: currentCount,
                category: item.category
            };

            previous[item.name] = {
                count: initialCount,
                category: item.category
            };
        });

        // 7 days ago timestamp
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 - depotIdx * 3600000)).toISOString();
        const updatedNow = new Date(now.getTime() - depotIdx * 1800000).toISOString();

        generated[name] = {
            name,
            customName: `[TEST] ${name.replace('TEST-', '')}`,
            lastUpdated: updatedNow,
            previous,
            current,
            isIntegrated: true,
            townName: subregion,
            subregion
        };

        // Add Audit Log
        logs.push({
            id: `test-log-set1-${depotIdx}-${Date.now()}`,
            timestamp: sevenDaysAgo,
            username: 'Test Logi Officer',
            role: 'developer',
            action: `Initial stock scan logged for ${name} (Set 1 - Full 200+ Items Baseline)`
        });
    });

    return { depots: generated, logs };
};

/**
 * SET 2: Update & Rapid Consumption Simulation
 * Overwrites the 20 test depots across ALL 200+ items, heavily consuming critical combat items.
 */
export const generateTestDepotsSet2 = (existingDepots?: Record<string, Depot>): { depots: Record<string, Depot>; logs: AuditLogEntry[] } => {
    const generated: Record<string, Depot> = {};
    const logs: AuditLogEntry[] = [];
    const now = new Date();

    // Critical frontline items to simulate rapid depletion
    const CRITICAL_ITEMS = [
        'Soldier Supplies (Crate)',
        'Garrison Supplies (Crate)',
        '7.62mm (Crate)',
        '12.7mm (Crate)',
        '40mm (Crate)',
        '68mm (Crate)',
        '120mm (Crate)',
        'Bandages (Crate)',
        'Blood Plasma (Crate)',
        'Bomastone Grenade (Crate)',
        'RPG (Crate)',
        'Ignifist 30 (Crate)',
        'Argenti r.II Rifle (Crate)'
    ];

    TEST_DEPOT_NAMES.forEach((name, depotIdx) => {
        const existing = existingDepots?.[name];
        const previous: Record<string, ItemInfo> = existing?.current ? { ...existing.current } : {};
        const current: Record<string, ItemInfo> = {};
        const subregion = name.split(' - ')[2] || '';

        // Copy baseline items and drop critical ones
        ALL_TEST_ITEMS.forEach((item, itemIdx) => {
            const prevCount = previous[item.name]?.count ?? (50 + ((depotIdx * 13 + itemIdx * 7) % 250));

            // Set previous if not present
            if (!previous[item.name]) {
                previous[item.name] = { count: prevCount, category: item.category };
            }

            let newCount = prevCount;

            if (CRITICAL_ITEMS.includes(item.name)) {
                // Massive drop to critical levels (2 - 15 crates left!)
                newCount = Math.max(1, Math.floor(prevCount * 0.06));
            } else if (item.category === 'crate') {
                // Moderate reduction
                newCount = Math.max(5, Math.floor(prevCount * 0.4));
            } else if (item.category === 'vehicle') {
                newCount = Math.max(0, prevCount - 3);
            } else {
                newCount = Math.max(1, Math.floor(prevCount * 0.5));
            }

            current[item.name] = {
                count: newCount,
                category: item.category
            };
        });

        const updatedNow = new Date(now.getTime() - depotIdx * 600000).toISOString();

        generated[name] = {
            name,
            customName: `[TEST] ${name.replace('TEST-', '')}`,
            lastUpdated: updatedNow,
            previous,
            current,
            isIntegrated: true,
            townName: subregion,
            subregion
        };

        // Add Audit Log for Set 2
        logs.push({
            id: `test-log-set2-${depotIdx}-${Date.now()}`,
            timestamp: updatedNow,
            username: 'Test Logi Officer',
            role: 'developer',
            action: `Heavy frontline depletion update for ${name} (Set 2 - Consumption Active)`
        });
    });

    return { depots: generated, logs };
};
