import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, 
    Package, Truck, Warehouse, Info,
    BarChart3, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import type { Depot, SupplyRequest, AuditLogEntry, RegionSettings, StockpileTemplates, ItemInfo } from '../types';

interface AnalyticsTabProps {
    depots?: Record<string, Depot>;
    activeDepotName: string | null;
    activeSubDepotFilter?: string;
    theme?: 'dark' | 'light';
    supplyRequests?: SupplyRequest[];
    auditLogs?: AuditLogEntry[];
    templates?: StockpileTemplates;
    regionSettings?: RegionSettings;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = React.memo(({ 
    depots = {}, 
    activeDepotName,
    activeSubDepotFilter = 'all',
    auditLogs = [] as AuditLogEntry[],
    templates = {},
    regionSettings = {}
}) => {
    const { t, language } = useLanguage();

    const depotList = Object.values(depots);

    // Selected Depot and Info State
    const selectedDepotName = React.useMemo(() => {
        if (!activeDepotName) return 'all';
        if (activeDepotName.startsWith('town:')) {
            return activeSubDepotFilter !== 'all' ? activeSubDepotFilter : activeDepotName;
        }
        return activeDepotName;
    }, [activeDepotName, activeSubDepotFilter]);

    const [showIncreasedInfo, setShowIncreasedInfo] = useState(false);
    const [showDecreasedInfo, setShowDecreasedInfo] = useState(false);
    const [showHeatmapInfo, setShowHeatmapInfo] = useState(false);
    const [showPrioHealthInfo, setShowPrioHealthInfo] = useState(false);
    const [showFrontlineHealthInfo, setShowFrontlineHealthInfo] = useState(false);
    const [showBacklineHealthInfo, setShowBacklineHealthInfo] = useState(false);
    const [showDetailHealthInfo, setShowDetailHealthInfo] = useState(false);
    const [tooltipState, setTooltipState] = useState<{ visible: boolean; content: string; x: number; y: number }>({ visible: false, content: '', x: 0, y: 0 });
    const [healthViewMode, setHealthViewMode] = useState<'category' | 'region'>('category');

    const getFulfillColor = (percent: number) => {
        const hue = Math.min(120, (percent / 100) * 120);
        return `hsl(${hue}, 85%, 45%)`;
    };

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowIncreasedInfo(false);
                setShowDecreasedInfo(false);
                setShowHeatmapInfo(false);
                setShowPrioHealthInfo(false);
                setShowFrontlineHealthInfo(false);
                setShowBacklineHealthInfo(false);
                setShowDetailHealthInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, []);

    if (depotList.length === 0) {
        return (
            <div className="panel-card anim-fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                <Warehouse size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h2 style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    {language === 'tr' ? 'VERİTABANI BOŞ' : 'DATABASE EMPTY'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    {language === 'tr' 
                        ? 'Analitik verilerini görüntülemek için lütfen enaz bir depo envanter CSV verisi içe aktarın.' 
                        : 'Please import at least one depot inventory CSV file to view analytics metrics.'}
                </p>
            </div>
        );
    }

    // Selected Depot (resolved with All Depots aggregation support)
    const targetDepot = React.useMemo<Depot>(() => {
        if (selectedDepotName === 'all') {
            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';

            depotList.forEach(dep => {
                if (dep.lastUpdated && dep.lastUpdated > latestUpdated) {
                    latestUpdated = dep.lastUpdated;
                }
                if (dep.current) {
                    Object.entries(dep.current).forEach(([itemName, itemInfo]) => {
                        if (!mergedCurrent[itemName]) {
                            mergedCurrent[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedCurrent[itemName].count += itemInfo.count;
                    });
                }
                if (dep.previous) {
                    Object.entries(dep.previous).forEach(([itemName, itemInfo]) => {
                        if (!mergedPrevious[itemName]) {
                            mergedPrevious[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedPrevious[itemName].count += itemInfo.count;
                    });
                }
            });

            return {
                name: 'all',
                customName: language === 'tr' ? 'Tüm Depolar' : 'All Depots',
                lastUpdated: latestUpdated || new Date().toISOString(),
                current: mergedCurrent,
                previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null
            };
        }

        if (selectedDepotName.startsWith('town:')) {
            const town = selectedDepotName.substring(5);
            const getDepotRegion = (dep: Depot): string => {
                const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
                return parts[0] || 'Unknown Region';
            };

            const isDepotType = (str: string): boolean => {
                const lower = str.toLowerCase();
                return (
                    lower.includes('seaport') || lower.includes('storage depot') || lower.includes('depot') ||
                    lower.includes('seehafen') || lower.includes('lagerdepot') || lower.includes('porto') ||
                    lower.includes('depósito') || lower.includes('порт') || lower.includes('склад') ||
                    lower.includes('dépôt')
                );
            };

            const getDepotTown = (dep: Depot) => {
                let townNameVal = dep.townName;
                if (townNameVal && !isDepotType(townNameVal)) {
                    const trimmed = townNameVal.trim();
                    if (trimmed === 'Glimmerhaven') return "Light's End";
                    if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
                    if (trimmed === 'Rising Loom') return 'Therizo';
                    return townNameVal;
                }
                const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 3 && !isDepotType(parts[1])) {
                    const trimmed = parts[1];
                    if (trimmed === 'Glimmerhaven') return "Light's End";
                    if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
                    if (trimmed === 'Rising Loom') return 'Therizo';
                    return parts[1];
                }
                return null;
            };

            const getDepotGroup = (dep: Depot): string => {
                const region = getDepotRegion(dep);
                const townVal = getDepotTown(dep);
                return townVal ? `${region} - ${townVal}` : region;
            };

            const townDepots = Object.values(depots).filter(dep => getDepotGroup(dep) === town);

            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';

            townDepots.forEach(dep => {
                if (dep.lastUpdated && dep.lastUpdated > latestUpdated) {
                    latestUpdated = dep.lastUpdated;
                }
                if (dep.current) {
                    Object.entries(dep.current).forEach(([itemName, itemInfo]) => {
                        if (!mergedCurrent[itemName]) {
                            mergedCurrent[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedCurrent[itemName].count += itemInfo.count;
                    });
                }
                if (dep.previous) {
                    Object.entries(dep.previous).forEach(([itemName, itemInfo]) => {
                        if (!mergedPrevious[itemName]) {
                            mergedPrevious[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedPrevious[itemName].count += itemInfo.count;
                    });
                }
            });

            return {
                name: selectedDepotName,
                customName: town,
                lastUpdated: latestUpdated || new Date().toISOString(),
                current: mergedCurrent,
                previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null
            };
        }

        return depots[selectedDepotName] || depotList[0];
    }, [selectedDepotName, depots, depotList, language]);

    // Calculate changes
    const increasedItems: { name: string; diff: number; category: string }[] = [];
    const decreasedItems: { name: string; diff: number; category: string }[] = [];

    let totalAdded = 0;
    let totalConsumed = 0;

    const hasPreviousData = !!targetDepot.previous;

    if (targetDepot && hasPreviousData) {
        const currentItems = targetDepot.current || {};
        const previousItems = targetDepot.previous || {};
        const allKeys = new Set([...Object.keys(currentItems), ...Object.keys(previousItems)]);

        allKeys.forEach(name => {
            const curVal = currentItems[name]?.count || 0;
            const prevVal = previousItems[name]?.count || 0;
            const diff = curVal - prevVal;

            if (diff > 0) {
                increasedItems.push({ name, diff, category: currentItems[name]?.category || 'item' });
                totalAdded += diff;
            } else if (diff < 0) {
                decreasedItems.push({ name, diff: Math.abs(diff), category: previousItems[name]?.category || 'item' });
                totalConsumed += Math.abs(diff);
            }
        });
    }

    // Sort descending
    increasedItems.sort((a, b) => b.diff - a.diff);
    decreasedItems.sort((a, b) => b.diff - a.diff);

    const topIncreased = increasedItems.slice(0, 15);
    const topDecreased = decreasedItems.slice(0, 15);

    const maxInc = topIncreased.length > 0 ? topIncreased[0].diff : 1;
    const maxDec = topDecreased.length > 0 ? topDecreased[0].diff : 1;



    // Selected Depot Overview details
    let selectedDepotTotalItems = 0;
    const selectedDepotCategoryCounts: Record<string, number> = {
        crate: 0,
        vehicle: 0,
        structure: 0
    };

    Object.values(targetDepot.current || {}).forEach(item => {
        selectedDepotTotalItems += item.count;
        if (item.category === 'crate' || item.category === 'crate_vehicle' || item.category === 'item') {
            selectedDepotCategoryCounts.crate += item.count;
        } else if (item.category === 'vehicle') {
            selectedDepotCategoryCounts.vehicle += item.count;
        } else if (item.category === 'structure') {
            selectedDepotCategoryCounts.structure += item.count;
        }
    });

    const crateVehiclesCount = useMemo(() => {
        return Object.values(targetDepot.current || {}).reduce((acc, item) => {
            return item.category === 'crate_vehicle' ? acc + item.count : acc;
        }, 0);
    }, [targetDepot]);



    // Helper functions for region/town parsing matching main app logic
    const getDepotRegion = (depName: string): string => {
        const parts = depName.split(' - ').map(s => s.trim()).filter(Boolean);
        const reg = parts[0] || 'Unknown Region';
        if (reg === 'The Blemish' || reg === 'The Blemsh') return 'Blemish';
        return reg;
    };

    const getDepotTown = (depName: string, depotTownField?: string | null): string | null => {
        let town = depotTownField || null;
        if (!town) {
            const parts = depName.split(' - ').map(s => s.trim()).filter(Boolean);
            const isDepotType = (str: string) => {
                const l = str.toLowerCase();
                return (
                    l.includes('seaport') || l.includes('depot') || l.includes('port') ||
                    l.includes('seehafen') || l.includes('lagerdepot') || l.includes('porto') ||
                    l.includes('depósito') || l.includes('порт') || l.includes('склад') ||
                    l.includes('dépôt')
                );
            };
            if (parts.length >= 3 && !isDepotType(parts[1])) {
                town = parts[1];
            }
        }
        if (town) {
            const trimmed = town.trim();
            if (trimmed === 'Glimmerhaven') return "Light's End";
            if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
            if (trimmed === 'Rising Loom') return 'Therizo';
            return town;
        }
        return null;
    };

    // Group depots by Town Groups ("Region - Town")
    const townGroups = useMemo(() => {
        const groups: Record<string, { region: string; town: string; depots: Depot[] }> = {};
        Object.values(depots).forEach(dep => {
            const region = getDepotRegion(dep.name);
            const town = getDepotTown(dep.name, dep.subregion || dep.townName);
            const groupKey = town ? `${region} - ${town}` : region;
            if (!groups[groupKey]) {
                groups[groupKey] = { region, town: town || '', depots: [] };
            }
            groups[groupKey].depots.push(dep);
        });
        return groups;
    }, [depots]);

    // Top Surplus and Shortage items for the selected targetDepot (YENİLİK 4)
    const { topSurplus, topShortage } = useMemo(() => {
        const surplusList: { name: string; amount: number; category: string }[] = [];
        const shortageList: { name: string; amount: number; category: string }[] = [];

        // Determine which subregions to sum targets for
        const subregionsToSum: string[] = [];
        if (selectedDepotName === 'all') {
            subregionsToSum.push(...Object.keys(townGroups));
        } else if (selectedDepotName.startsWith('town:')) {
            const townName = selectedDepotName.substring(5);
            subregionsToSum.push(townName);
        } else {
            const dep = depots[selectedDepotName];
            if (dep) {
                const region = dep.name.split(' - ')[0].trim();
                let town = dep.townName || null;
                if (!town) {
                    const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
                    const isDepotType = (str: string) => {
                        const l = str.toLowerCase();
                        return (
                            l.includes('seaport') || l.includes('depot') || l.includes('port') ||
                            l.includes('seehafen') || l.includes('lagerdepot') || l.includes('porto') ||
                            l.includes('depósito') || l.includes('порт') || l.includes('склад') ||
                            l.includes('dépôt')
                        );
                    };
                    if (parts.length >= 3 && !isDepotType(parts[1])) {
                        town = parts[1];
                    }
                }
                if (town) {
                    const trimmed = town.trim();
                    if (trimmed === 'Glimmerhaven') town = "Light's End";
                    else if (trimmed === 'Loftmire' || trimmed === 'The Blemish') town = 'Blemish';
                    else if (trimmed === 'Rising Loom') town = 'Therizo';
                }
                const townVal = town || 'General';
                subregionsToSum.push(`${region} - ${townVal}`);
            }
        }

        Array.from(COLONIAL_NEUTRAL_ITEMS).forEach(itemName => {
            const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);

            let targetMax = 0;

            subregionsToSum.forEach(subregionName => {
                const setting = regionSettings[subregionName] || { 
                    regionName: subregionName, 
                    templateType: 'backline', 
                    demandPercentage: 100 
                };
                const template = templates[setting.templateType] || {};
                let rule = template[itemName];
                if (!rule) {
                    return;
                }

                targetMax += Math.round(rule.max * (setting.demandPercentage / 100));
            });

            const available = targetDepot.current?.[itemName]?.count || 0;

            const shortageVal = Math.max(0, targetMax - available);
            const surplusVal = Math.max(0, available - targetMax);

            if (shortageVal > 0) {
                shortageList.push({ name: itemName, amount: shortageVal, category });
            }
            if (surplusVal > 0) {
                surplusList.push({ name: itemName, amount: surplusVal, category });
            }
        });

        surplusList.sort((a, b) => b.amount - a.amount);
        shortageList.sort((a, b) => b.amount - a.amount);

        return {
            topSurplus: surplusList.slice(0, 15),
            topShortage: shortageList.slice(0, 15)
        };
    }, [selectedDepotName, depots, townGroups, regionSettings, templates, targetDepot]);

    const maxSurplus = topSurplus.length > 0 ? topSurplus[0].amount : 1;
    const maxShortage = topShortage.length > 0 ? topShortage[0].amount : 1;

    // List of calculated health entries for each demanded item in each subregion (town group)
    const itemSubregionHealths = useMemo(() => {
        const list: {
            itemName: string;
            category: OfficialCategory;
            subregionName: string;
            regionName: string;
            targetMin: number;
            targetMax: number;
            available: number;
            healthPercent: number;
            isPriority: boolean;
            templateType: 'frontline' | 'backline';
        }[] = [];

        Object.entries(townGroups).forEach(([groupName, groupData]) => {
            const setting = regionSettings[groupName] || { 
                regionName: groupName, 
                templateType: 'backline', 
                demandPercentage: 100 
            };
            const template = templates[setting.templateType] || {};

            Array.from(COLONIAL_NEUTRAL_ITEMS).forEach(itemName => {
                const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);

                let rule = template[itemName];
                if (!rule) {
                    return;
                }

                // Exclude items whose min and max are both 0 in the template rule (ignored)
                if (rule.min === 0 && rule.max === 0) {
                    return;
                }

                const targetMin = Math.round(rule.min * (setting.demandPercentage / 100));
                const targetMax = Math.round(rule.max * (setting.demandPercentage / 100));
                const available = groupData.depots.reduce((sum, d) => sum + (d.current?.[itemName]?.count || 0), 0);
                const healthPercent = targetMax === 0 ? 100 : Math.min(100, (available / targetMax) * 100);

                list.push({
                    itemName,
                    category,
                    subregionName: groupName,
                    regionName: groupData.region,
                    targetMin,
                    targetMax,
                    available,
                    healthPercent,
                    isPriority: !!rule.isPriority,
                    templateType: setting.templateType as 'frontline' | 'backline'
                });
            });
        });

        return list;
    }, [townGroups, templates, regionSettings]);

    // Priority Items Health (Öncelikli Malzeme Sağlığı)
    const priorityStats = useMemo(() => {
        const priorityItems = itemSubregionHealths.filter(h => h.isPriority);
        if (priorityItems.length === 0) return { score: 100, fulfilledCount: 0, totalCount: 0 };

        const totalTarget = priorityItems.reduce((acc, h) => acc + h.targetMax, 0);
        const totalAvailable = priorityItems.reduce((acc, h) => acc + h.available, 0);
        const score = totalTarget === 0 ? 100 : Math.min(100, Math.round((totalAvailable / totalTarget) * 100));

        return {
            score,
            fulfilledCount: totalAvailable,
            totalCount: totalTarget
        };
    }, [itemSubregionHealths]);

    // Frontline Regions Health (Cephe Hattı Sağlığı)
    const frontlineStats = useMemo(() => {
        const frontlineItems = itemSubregionHealths.filter(h => h.templateType === 'frontline');
        if (frontlineItems.length === 0) return { score: 100, fulfilledCount: 0, totalCount: 0 };

        const totalTarget = frontlineItems.reduce((acc, h) => acc + h.targetMax, 0);
        const totalAvailable = frontlineItems.reduce((acc, h) => acc + h.available, 0);
        const score = totalTarget === 0 ? 100 : Math.min(100, Math.round((totalAvailable / totalTarget) * 100));

        return {
            score,
            fulfilledCount: totalAvailable,
            totalCount: totalTarget
        };
    }, [itemSubregionHealths]);

    // Backline Regions Health (Arka Hat Sağlığı)
    const backlineStats = useMemo(() => {
        const backlineItems = itemSubregionHealths.filter(h => h.templateType === 'backline');
        if (backlineItems.length === 0) return { score: 100, fulfilledCount: 0, totalCount: 0 };

        const totalTarget = backlineItems.reduce((acc, h) => acc + h.targetMax, 0);
        const totalAvailable = backlineItems.reduce((acc, h) => acc + h.available, 0);
        const score = totalTarget === 0 ? 100 : Math.min(100, Math.round((totalAvailable / totalTarget) * 100));

        return {
            score,
            fulfilledCount: totalAvailable,
            totalCount: totalTarget
        };
    }, [itemSubregionHealths]);

    // Health by Category (Kategori Bazlı Sağlık)
    const categoryHealth = useMemo(() => {
        const catMap: Record<string, { totalTarget: number; totalAvailable: number; itemsMap: Record<string, { target: number; available: number }> }> = {};

        itemSubregionHealths.forEach(h => {
            if (!catMap[h.category]) {
                catMap[h.category] = { totalTarget: 0, totalAvailable: 0, itemsMap: {} };
            }
            catMap[h.category].totalTarget += h.targetMax;
            catMap[h.category].totalAvailable += h.available;

            if (!catMap[h.category].itemsMap[h.itemName]) {
                catMap[h.category].itemsMap[h.itemName] = { target: 0, available: 0 };
            }
            catMap[h.category].itemsMap[h.itemName].target += h.targetMax;
            catMap[h.category].itemsMap[h.itemName].available += h.available;
        });

        const result = Object.entries(catMap).map(([catName, data]) => {
            const score = data.totalTarget === 0 ? 100 : Math.min(100, Math.round((data.totalAvailable / data.totalTarget) * 100));

            const itemsDetails = Object.entries(data.itemsMap).map(([itemName, itemData]) => {
                const percent = itemData.target === 0 ? 100 : Math.min(100, Math.round((itemData.available / itemData.target) * 100));
                return {
                    name: itemName,
                    percent,
                    fulfilledText: `${itemData.available.toLocaleString()} / ${itemData.target.toLocaleString()}`,
                    target: itemData.target,
                    available: itemData.available,
                    met: itemData.available >= itemData.target
                };
            });

            itemsDetails.sort((a, b) => a.name.localeCompare(b.name));

            return {
                name: catName as OfficialCategory,
                fulfilledCount: data.totalAvailable,
                totalCount: data.totalTarget,
                score,
                itemsDetails
            };
        });

        return result.sort((a, b) => a.score - b.score);
    }, [itemSubregionHealths]);

    // Health by Region / Town (Bölge-Kasaba Sağlığı)
    const subregionHealth = useMemo(() => {
        const subMap: Record<string, {
            name: string;
            totalTarget: number;
            totalAvailable: number;
            itemsDetails: { name: string; target: number; available: number; percent: number; met: boolean }[];
        }> = {};

        itemSubregionHealths.forEach(h => {
            if (!subMap[h.subregionName]) {
                subMap[h.subregionName] = {
                    name: h.subregionName,
                    totalTarget: 0,
                    totalAvailable: 0,
                    itemsDetails: []
                };
            }
            subMap[h.subregionName].totalTarget += h.targetMax;
            subMap[h.subregionName].totalAvailable += h.available;
            
            const isMet = h.available >= h.targetMax;
            subMap[h.subregionName].itemsDetails.push({
                name: h.itemName,
                target: h.targetMax,
                available: h.available,
                percent: h.targetMax === 0 ? 100 : Math.min(100, Math.round((h.available / h.targetMax) * 100)),
                met: isMet
            });
        });

        const result = Object.values(subMap).map(sub => {
            sub.itemsDetails.sort((a, b) => a.name.localeCompare(b.name));
            const score = sub.totalTarget === 0 ? 100 : Math.min(100, Math.round((sub.totalAvailable / sub.totalTarget) * 100));
            return {
                name: sub.name,
                fulfilledCount: sub.totalAvailable,
                totalCount: sub.totalTarget,
                score,
                itemsDetails: sub.itemsDetails
            };
        });

        return result.sort((a, b) => a.score - b.score);
    }, [itemSubregionHealths]);



    // 4. Activity Heatmap
    const heatmapData = useMemo(() => {
        const grid = Array(7).fill(null).map(() => Array(24).fill(0));
        let maxCount = 0;

        auditLogs.forEach(log => {
            if (log.timestamp) {
                try {
                    const date = new Date(log.timestamp);
                    let day = date.getDay();
                    day = day === 0 ? 6 : day - 1;
                    const hour = date.getHours();

                    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
                        grid[day][hour]++;
                        if (grid[day][hour] > maxCount) {
                            maxCount = grid[day][hour];
                        }
                    }
                } catch (e) {
                    // skip
                }
            }
        });

        return { grid, maxCount };
    }, [auditLogs]);



    return (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
            
            {/* Header with Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                <BarChart3 size={20} style={{ color: 'var(--accent-color)' }} />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                    {t('analytics_title')}
                </h2>
            </div>



            {/* General Metrics Row for Selected Depot */}
            <div className="analytics-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Package size={20} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DEPO TOPLAM STOK' : 'DEPOT TOTAL STOCK'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {selectedDepotTotalItems.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(232, 121, 249, 0.1)', border: '1px solid rgba(232, 121, 249, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={20} style={{ color: '#e879f9' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'KUTU ARAÇLAR' : 'CRATE VEHICLES'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {crateVehiclesCount.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <TrendingUp size={20} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DÖNEM İÇİ ÜRETİM' : 'PRODUCTION IN RANGE'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-heading)' }}>
                            +{totalAdded.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <TrendingDown size={20} style={{ color: '#ef4444' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DÖNEM İÇİ TÜKETİM' : 'CONSUMPTION IN RANGE'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-heading)' }}>
                            -{totalConsumed.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Graphs Panel */}
            <style>{`
                .analytics-graphs-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.25rem;
                }
                @media (max-width: 1200px) {
                    .analytics-graphs-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
            <div className="analytics-graphs-grid">
                
                {/* Top Increased Items */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={16} style={{ color: '#10b981' }} />
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'EN ÇOK ARTAN MALZEMELER' : 'TOP INCREASED ITEMS'}
                            </h3>
                        </div>
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowIncreasedInfo(!showIncreasedInfo);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showIncreasedInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                            >
                                <Info size={14} />
                            </button>
                            {showIncreasedInfo && (
                                <div className="popover-card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 99999,
                                    width: '300px',
                                    background: 'rgba(20, 20, 23, 0.96)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '0.85rem',
                                    marginTop: '0.35rem',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.45',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.6)'
                                }}>
                                    <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                        {t('info_increased_title')}
                                    </strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <li>{t('info_increased_bullet1')}</li>
                                        <li>{t('info_increased_bullet2')}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {!hasPreviousData ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Karşılaştırılacak önceki tarama verisi bulunamadı.' : 'No previous scan data found to compare changes.'}
                        </div>
                    ) : topIncreased.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Bu zaman aralığında artış gösteren malzeme bulunmamaktadır.' : 'No items increased within this range.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {topIncreased.map(item => {
                                const pct = Math.round((item.diff / maxInc) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#10b981', fontWeight: 700 }}>+{item.diff.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Decreased Items */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingDown size={16} style={{ color: '#ef4444' }} />
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'EN ÇOK AZALAN MALZEMELER' : 'TOP DECREASED ITEMS'}
                            </h3>
                        </div>
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDecreasedInfo(!showDecreasedInfo);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showDecreasedInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                            >
                                <Info size={14} />
                            </button>
                            {showDecreasedInfo && (
                                <div className="popover-card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 99999,
                                    width: '300px',
                                    background: 'rgba(20, 20, 23, 0.96)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '0.85rem',
                                    marginTop: '0.35rem',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.45',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.6)'
                                }}>
                                    <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                        {t('info_decreased_title')}
                                    </strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <li>{t('info_decreased_bullet1')}</li>
                                        <li>{t('info_decreased_bullet2')}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {!hasPreviousData ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Karşılaştırılacak önceki tarama verisi bulunamadı.' : 'No previous scan data found to compare changes.'}
                        </div>
                    ) : topDecreased.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Bu zaman aralığında azalış gösteren malzeme bulunmamaktadır.' : 'No items decreased within this range.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {topDecreased.map(item => {
                                const pct = Math.round((item.diff / maxDec) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#ef4444', fontWeight: 700 }}>-{item.diff.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Shortage Items (YENİLİK 4) */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'EN ÇOK İHTİYAÇ DUYULANLAR' : 'TOP SHORTAGE ITEMS'}
                        </h3>
                    </div>
                    
                    {topShortage.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'İhtiyaç duyulan malzeme bulunmamaktadır.' : 'No shortage items.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {topShortage.map(item => {
                                const pct = Math.round((item.amount / maxShortage) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#ef4444', fontWeight: 700 }}>{item.amount.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Surplus Items (YENİLİK 4) */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'EN ÇOK FAZLASI OLANLAR' : 'TOP SURPLUS ITEMS'}
                        </h3>
                    </div>
                    
                    {topSurplus.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Fazla malzeme bulunmamaktadır.' : 'No surplus items.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {topSurplus.map(item => {
                                const pct = Math.round((item.amount / maxSurplus) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#10b981', fontWeight: 700 }}>+{item.amount.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Section: Logistical Health Analysis Dashboard */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 3 Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    {/* Card 1: Priority Items Health */}
                    <div className="panel-card" style={{ position: 'relative', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'ÖNCELİKLİ MALZEME SAĞLIĞI' : 'PRIORITY ITEMS HEALTH'}
                            </span>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="popover-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowPrioHealthInfo(!showPrioHealthInfo);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: showPrioHealthInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.15s'
                                    }}
                                >
                                    <Info size={14} />
                                </button>
                                {showPrioHealthInfo && (
                                    <div className="popover-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        zIndex: 99999,
                                        width: '280px',
                                        background: 'rgba(20, 20, 23, 0.96)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.85rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.45',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                        textTransform: 'none',
                                        fontWeight: 'normal',
                                        letterSpacing: 'normal'
                                    }}>
                                        <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                            {t('info_prio_health_title')}
                                        </strong>
                                        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <li>{t('info_prio_health_bullet1')}</li>
                                            <li>{t('info_prio_health_bullet2')}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${priorityStats.score}%`, height: '100%', background: getFulfillColor(priorityStats.score), borderRadius: '4px', transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: getFulfillColor(priorityStats.score), fontFamily: 'var(--font-heading)', minWidth: '45px', textAlign: 'right' }}>
                                {priorityStats.score}%
                            </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' 
                                ? `${priorityStats.fulfilledCount.toLocaleString()} / ${priorityStats.totalCount.toLocaleString()} kutu tamamlandı` 
                                : `${priorityStats.fulfilledCount.toLocaleString()} / ${priorityStats.totalCount.toLocaleString()} crates completed`}
                        </div>
                    </div>

                    {/* Card 2: Frontline Health */}
                    <div className="panel-card" style={{ position: 'relative', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'CEPHE HATTI BÖLGELERİ SAĞLIĞI' : 'FRONTLINE REGIONS HEALTH'}
                            </span>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="popover-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFrontlineHealthInfo(!showFrontlineHealthInfo);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: showFrontlineHealthInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.15s'
                                    }}
                                >
                                    <Info size={14} />
                                </button>
                                {showFrontlineHealthInfo && (
                                    <div className="popover-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        zIndex: 99999,
                                        width: '280px',
                                        background: 'rgba(20, 20, 23, 0.96)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.85rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.45',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                        textTransform: 'none',
                                        fontWeight: 'normal',
                                        letterSpacing: 'normal'
                                    }}>
                                        <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                            {t('info_frontline_health_title')}
                                        </strong>
                                        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <li>{t('info_frontline_health_bullet1')}</li>
                                            <li>{t('info_frontline_health_bullet2')}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${frontlineStats.score}%`, height: '100%', background: getFulfillColor(frontlineStats.score), borderRadius: '4px', transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: getFulfillColor(frontlineStats.score), fontFamily: 'var(--font-heading)', minWidth: '45px', textAlign: 'right' }}>
                                {frontlineStats.score}%
                            </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' 
                                ? `${frontlineStats.fulfilledCount.toLocaleString()} / ${frontlineStats.totalCount.toLocaleString()} kutu tamamlandı` 
                                : `${frontlineStats.fulfilledCount.toLocaleString()} / ${frontlineStats.totalCount.toLocaleString()} crates completed`}
                        </div>
                    </div>

                    {/* Card 3: Backline Health */}
                    <div className="panel-card" style={{ position: 'relative', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'ARKA HAT BÖLGELERİ SAĞLIĞI' : 'BACKLINE REGIONS HEALTH'}
                            </span>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="popover-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowBacklineHealthInfo(!showBacklineHealthInfo);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: showBacklineHealthInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.15s'
                                    }}
                                >
                                    <Info size={14} />
                                </button>
                                {showBacklineHealthInfo && (
                                    <div className="popover-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        zIndex: 99999,
                                        width: '280px',
                                        background: 'rgba(20, 20, 23, 0.96)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.85rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.45',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                        textTransform: 'none',
                                        fontWeight: 'normal',
                                        letterSpacing: 'normal'
                                    }}>
                                        <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                            {t('info_backline_health_title')}
                                        </strong>
                                        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <li>{t('info_backline_health_bullet1')}</li>
                                            <li>{t('info_backline_health_bullet2')}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${backlineStats.score}%`, height: '100%', background: getFulfillColor(backlineStats.score), borderRadius: '4px', transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: getFulfillColor(backlineStats.score), fontFamily: 'var(--font-heading)', minWidth: '45px', textAlign: 'right' }}>
                                {backlineStats.score}%
                            </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' 
                                ? `${backlineStats.fulfilledCount.toLocaleString()} / ${backlineStats.totalCount.toLocaleString()} kutu tamamlandı` 
                                : `${backlineStats.fulfilledCount.toLocaleString()} / ${backlineStats.totalCount.toLocaleString()} crates completed`}
                        </div>
                    </div>
                </div>

                {/* Detailed Category and Subregion Health Cards (Consolidated inside a single panel-card with toggle buttons) */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'DETAYLI SAĞLIK GÖSTERİMİ' : 'DETAILED HEALTH VIEW'}
                            </h3>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    className="popover-trigger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDetailHealthInfo(!showDetailHealthInfo);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: showDetailHealthInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.15s'
                                    }}
                                >
                                    <Info size={14} />
                                </button>
                                {showDetailHealthInfo && (
                                    <div className="popover-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        zIndex: 99999,
                                        width: '320px',
                                        background: 'rgba(20, 20, 23, 0.96)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.85rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.45',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                        textTransform: 'none',
                                        fontWeight: 'normal',
                                        letterSpacing: 'normal',
                                        textAlign: 'left'
                                    }}>
                                        <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                            {t('info_detail_health_title')}
                                        </strong>
                                        <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <li>{t('info_detail_health_bullet1')}</li>
                                            <li>{t('info_detail_health_bullet2')}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '4px' }}>
                            <button 
                                onClick={() => setHealthViewMode('category')}
                                style={{ 
                                    fontSize: '0.7rem', 
                                    padding: '0.25rem 0.6rem', 
                                    borderRadius: '3px',
                                    background: healthViewMode === 'category' ? 'var(--accent-color)' : 'transparent',
                                    color: healthViewMode === 'category' ? '#000' : 'var(--text-secondary)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {language === 'tr' ? 'Kategori Bazlı' : 'By Category'}
                            </button>
                            <button 
                                onClick={() => setHealthViewMode('region')}
                                style={{ 
                                    fontSize: '0.7rem', 
                                    padding: '0.25rem 0.6rem', 
                                    borderRadius: '3px',
                                    background: healthViewMode === 'region' ? 'var(--accent-color)' : 'transparent',
                                    color: healthViewMode === 'region' ? '#000' : 'var(--text-secondary)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {language === 'tr' ? 'Bölge / Kasaba Bazlı' : 'By Region / Town'}
                            </button>
                        </div>
                    </div>

                    {healthViewMode === 'category' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
                            {categoryHealth.map(cat => {
                                const scoreColor = getFulfillColor(cat.score);
                                return (
                                    <div key={cat.name} style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {t(`cat_${cat.name}` as any)}
                                            </span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: scoreColor }}>{cat.score}%</span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${cat.score}%`, height: '100%', background: scoreColor, borderRadius: '2px' }} />
                                        </div>

                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                            {language === 'tr' 
                                                ? `${cat.fulfilledCount.toLocaleString()} / ${cat.totalCount.toLocaleString()} kutu tamamlandı` 
                                                : `${cat.fulfilledCount.toLocaleString()} / ${cat.totalCount.toLocaleString()} crates completed`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
                            {subregionHealth.map(sub => {
                                const scoreColor = getFulfillColor(sub.score);
                                return (
                                    <div key={sub.name} style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }} title={sub.name}>
                                                {sub.name}
                                            </span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: scoreColor }}>{sub.score}%</span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${sub.score}%`, height: '100%', background: scoreColor, borderRadius: '2px' }} />
                                        </div>

                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                            {language === 'tr' 
                                                ? `${sub.fulfilledCount.toLocaleString()} / ${sub.totalCount.toLocaleString()} kutu tamamlandı` 
                                                : `${sub.fulfilledCount.toLocaleString()} / ${sub.totalCount.toLocaleString()} crates completed`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>


            {/* Section: Activity Heatmap */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={16} style={{ color: 'var(--accent-color)' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'LOJİSTİK AKTİVİTE ISI HARİTASI' : 'LOGISTICAL ACTIVITY HEATMAP'}
                        </h3>
                    </div>
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHeatmapInfo(!showHeatmapInfo);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showHeatmapInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                            >
                                <Info size={14} />
                            </button>
                            {showHeatmapInfo && (
                                <div className="popover-card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 99999,
                                    width: '300px',
                                    background: 'rgba(20, 20, 23, 0.96)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '0.85rem',
                                    marginTop: '0.35rem',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.45',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.6)'
                                }}>
                                    <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                        {t('info_heatmap_title')}
                                    </strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <li>{t('info_heatmap_bullet1')}</li>
                                        <li>{t('info_heatmap_bullet2')}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                </div>

                {auditLogs.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Aktivite ısı haritası için veri bulunmuyor.' : 'No activity logs available to plot heatmap.'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        <div style={{ minWidth: '680px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {/* Hours Header Row */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '45px', flexShrink: 0 }} />
                                <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                    {Array(24).fill(0).map((_, i) => (
                                        <div key={i} style={{ width: '22px', textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            {i.toString().padStart(2, '0')}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Days Rows */}
                            {(() => {
                                const dayLabels = language === 'tr' 
                                    ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
                                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                                return heatmapData.grid.map((row, dayIdx) => (
                                    <div key={dayIdx} style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ width: '45px', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, flexShrink: 0 }}>
                                            {dayLabels[dayIdx]}
                                        </div>
                                        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                            {row.map((count, hourIdx) => {
                                                const alpha = heatmapData.maxCount > 0 ? (count / heatmapData.maxCount) : 0;
                                                const bg = count > 0 
                                                    ? `rgba(249, 115, 22, ${Math.max(0.12, alpha * 0.85)})` 
                                                    : 'rgba(255, 255, 255, 0.01)';
                                                const border = count > 0 
                                                    ? '1px solid rgba(249, 115, 22, 0.3)' 
                                                    : '1px solid rgba(255, 255, 255, 0.02)';
                                                const tooltip = language === 'tr'
                                                    ? `${dayLabels[dayIdx]} Saat ${hourIdx}:00 - ${count} İşlem`
                                                    : `${dayLabels[dayIdx]} at ${hourIdx}:00 - ${count} Actions`;

                                                return (
                                                    <div 
                                                        key={hourIdx} 
                                                        onMouseEnter={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setTooltipState({
                                                                visible: true,
                                                                content: tooltip,
                                                                x: rect.left + rect.width / 2,
                                                                y: rect.top - 8
                                                            });
                                                        }}
                                                        onMouseLeave={() => {
                                                            setTooltipState(prev => ({ ...prev, visible: false }));
                                                        }}
                                                        style={{ 
                                                            width: '22px', 
                                                            height: '22px', 
                                                            background: bg, 
                                                            border: border, 
                                                            borderRadius: '4px',
                                                            transition: 'all 0.15s',
                                                            cursor: count > 0 ? 'pointer' : 'default'
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Custom HTML Tooltip */}
            {tooltipState.visible && (
                <div 
                    style={{
                        position: 'fixed',
                        top: tooltipState.y,
                        left: tooltipState.x,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 99999,
                        background: 'rgba(15, 15, 20, 0.95)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.55rem',
                        fontSize: '0.68rem',
                        color: 'var(--text-primary)',
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                    }}
                >
                    {tooltipState.content}
                </div>
            )}

        </div>
    );
});

AnalyticsTab.displayName = 'AnalyticsTab';
