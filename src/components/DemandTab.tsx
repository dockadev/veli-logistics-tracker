import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Search, CheckCircle, Info,
    Package, ChevronDown, ChevronUp, BarChart3,
    Eye, EyeOff, Plus, Minus
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { CustomSelect } from './CustomSelect';
import { getItemIconUrl } from '../utils/itemIcons';
import type { Depot, StockpileTemplates, RegionSettings } from '../types';

interface CountUpStatProps {
    value: number;
    color?: string;
    durationMs?: number;
}

const useCountUp = (target: number, durationMs = 700): number => {
    const [display, setDisplay] = useState(target);
    const lastDisplayRef = useRef(target);
    const rafRef = useRef<number | null>(null);
    const reducedMotion = useRef(
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    useEffect(() => {
        if (reducedMotion.current) {
            if (lastDisplayRef.current !== target) {
                lastDisplayRef.current = target;
                setDisplay(target);
            }
            return;
        }
        const start = performance.now();
        const from = lastDisplayRef.current;
        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(1, elapsed / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = Math.round(from + (target - from) * eased);
            setDisplay(current);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                lastDisplayRef.current = target;
            }
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [target, durationMs]);

    return display;
};

const CountUpStat: React.FC<CountUpStatProps> = ({ value, color, durationMs }) => {
    const display = useCountUp(value, durationMs);
    return (
        <div className="demand-stat-box-value" style={color ? { color } : undefined}>
            {display.toLocaleString()}
        </div>
    );
};
CountUpStat.displayName = 'CountUpStat';

interface DemandCityChipProps {
    name: string;
    valueText: string;
    isNeeded: boolean;
    chipIndex: number;
}

const DemandCityChip: React.FC<DemandCityChipProps> = ({ name, valueText, isNeeded, chipIndex }) => {
    return (
        <span
            className="demand-city-chip"
            style={{ '--chip-index': chipIndex } as React.CSSProperties}
            title={`${name} (${valueText})`}
        >
            <span className="demand-city-chip-name">{name}</span>
            <span className={`demand-city-chip-badge ${isNeeded ? 'negative' : 'positive'}`}>
                {valueText}
            </span>
        </span>
    );
};
DemandCityChip.displayName = 'DemandCityChip';

interface DemandTabProps {
    depots: Record<string, Depot>;
    templates: StockpileTemplates;
    regionSettings: RegionSettings;
}

const OFFICIAL_CATEGORIES: OfficialCategory[] = [
    'small_arms',
    'heavy_arms',
    'heavy_ammunition',
    'utility',
    'medical',
    'materials',
    'uniforms',
    'aircraft_parts',
    'vehicles',
    'shippables',
    'vehicle_crates',
    'shippable_crates'
];



export const DemandTab: React.FC<DemandTabProps> = ({ depots, templates, regionSettings }) => {
    const { t, language } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'high_low' | 'low_high' | 'alpha'>('high_low');
    const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());

    const toggleCategory = (cat: string) => {
        setDisabledCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) {
                next.delete(cat);
            } else {
                next.add(cat);
            }
            return next;
        });
    };
    const toggleAllCategories = () => {
        setDisabledCategories(prev => {
            if (prev.size === 0) {
                return new Set(OFFICIAL_CATEGORIES);
            } else {
                return new Set();
            }
        });
    };

    const renderCategoryFilters = () => {
        const allDisabled = disabledCategories.size === OFFICIAL_CATEGORIES.length;

        return (
            <div className="demand-chips">
                <button
                    type="button"
                    onClick={toggleAllCategories}
                    className={`demand-chip ${allDisabled ? 'disabled' : ''}`}
                    style={{ marginRight: '0.25rem', fontWeight: 800 }}
                >
                    {allDisabled ? <EyeOff size={10} /> : <Eye size={10} />}
                    {language === 'tr' ? 'Tümü' : 'All'}
                </button>

                {OFFICIAL_CATEGORIES.map(cat => {
                    const isDisabled = disabledCategories.has(cat);
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className={`demand-chip ${isDisabled ? 'disabled' : ''}`}
                        >
                            {isDisabled ? <EyeOff size={10} /> : <Eye size={10} />}
                            {t(`cat_${cat}` as any)}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Pagination states
    const [neededPage, setNeededPage] = useState(1);
    const [surplusPage, setSurplusPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const CITY_CHIP_COLLAPSE_LIMIT = 2;
    const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
    const toggleCityExpansion = useCallback((itemName: string) => {
        setExpandedCities(prev => {
            const next = new Set(prev);
            if (next.has(itemName)) next.delete(itemName);
            else next.add(itemName);
            return next;
        });
    }, []);

    const neededGridAnimKey = useMemo(() => {
        const cats = Array.from(disabledCategories).sort().join(',');
        return `${neededPage}|${sortBy}|${searchTerm}|${cats}`;
    }, [neededPage, sortBy, searchTerm, disabledCategories]);

    // Reset pagination on filter change
    useEffect(() => {
        setNeededPage(1);
        setSurplusPage(1);
    }, [searchTerm, sortBy, disabledCategories]);

    // Collapsible states

    const [isNeededExpanded, setIsNeededExpanded] = useState(false);
    const [isSurplusExpanded, setIsSurplusExpanded] = useState(false);
    const [showDemandInfo, setShowDemandInfo] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowDemandInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

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
                const l = str.toLowerCase().trim();
                if (l === 'sableport') return false;
                return l.includes('seaport') || l.includes('depot') || (l.includes('port') && !l.includes('sableport'));
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

    // 1. Group depots by Town Groups ("Region - Town")
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
    // 1b. Canonical list of items for demand tracking (matching StockpileTemplatesTab)
    const allDemandItems = useMemo(() => {
        const itemsMap = new Map<string, OfficialCategory>();
        COLONIAL_NEUTRAL_ITEMS.forEach(rawName => {
            const cat = ITEM_CATEGORY_MAP[rawName] || getItemOfficialCategory(rawName);
            
            if (cat === 'vehicles' || cat === 'shippables') {
                itemsMap.set(rawName, cat);
                const crateCat = (cat === 'vehicles' ? 'vehicle_crates' : 'shippable_crates') as OfficialCategory;
                itemsMap.set(`${rawName} (Crate)`, crateCat);
            } else {
                const crateName = rawName.endsWith('(Crate)') ? rawName : `${rawName} (Crate)`;
                itemsMap.set(crateName, cat);
            }
        });
        return Array.from(itemsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, []);

    const getItemAvailable = (depotsList: Depot[], itemName: string, category: OfficialCategory): number => {
        const cleanName = itemName.replace(/\s*\(Crate\)$/i, '').trim();
        const crateName = itemName.endsWith('(Crate)') ? itemName : `${itemName} (Crate)`;
        
        return depotsList.reduce((sum, d) => {
            if (!d.current) return sum;
            if (category === 'vehicles' || category === 'shippables' || category === 'vehicle_crates' || category === 'shippable_crates') {
                return sum + (d.current[itemName]?.count || 0);
            }
            if (crateName === cleanName) {
                return sum + (d.current[itemName]?.count || 0);
            }
            return sum + (d.current[crateName]?.count || 0) + (d.current[cleanName]?.count || 0);
        }, 0);
    };

    // 2. Compute Target, Available, and Needed for ALL items across ALL town groups
    const demandItems = useMemo(() => {
        const itemsList: {
            name: string;
            category: OfficialCategory;
            target: number;
            available: number;
            needed: number;
            surplus: number;
            hasCriticalShortage?: boolean;
            citiesNeeded: { cityName: string; target: number; available: number; needed: number; surplus: number }[];
        }[] = [];

        allDemandItems.forEach(([itemName, category]) => {
            let totalTarget = 0;
            Object.keys(townGroups).forEach(subregionName => {
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
                // Skip if rule has min=0 & max=0
                if (rule.min === 0 && rule.max === 0) {
                    return;
                }
                const targetVal = Math.round(rule.max * (setting.demandPercentage / 100));
                totalTarget += targetVal;
            });

            const totalAvailable = getItemAvailable(Object.values(depots), itemName, category);

            let hasCriticalShortage = false;
            const citiesNeeded: { cityName: string; target: number; available: number; needed: number; surplus: number }[] = [];

            Object.entries(townGroups).forEach(([groupName, groupData]) => {
                const setting = regionSettings[groupName] || { 
                    regionName: groupName, 
                    templateType: 'backline', 
                    demandPercentage: 100 
                };
                const template = templates[setting.templateType] || {};
                
                let rule = template[itemName];
                if (!rule) {
                    return;
                }

                const minVal = (rule.min === 0 && rule.max === 0) 
                    ? 0 
                    : Math.round(rule.min * (setting.demandPercentage / 100));
                const maxVal = (rule.min === 0 && rule.max === 0) 
                    ? 0 
                    : Math.round(rule.max * (setting.demandPercentage / 100));
                
                const availableVal = getItemAvailable(groupData.depots, itemName, category);
                const neededVal = Math.max(0, maxVal - availableVal);
                const surplusVal = Math.max(0, availableVal - maxVal);
                if (availableVal < minVal) {
                    hasCriticalShortage = true;
                }

                if (maxVal > 0 || surplusVal > 0) {
                    citiesNeeded.push({
                        cityName: groupName,
                        target: maxVal,
                        available: availableVal,
                        needed: neededVal,
                        surplus: surplusVal
                    });
                }
            });

            // Only list items that have a positive target demand or some available stock somewhere
            if (totalTarget > 0 || totalAvailable > 0) {
                const globalNeeded = Math.max(0, totalTarget - totalAvailable);
                const globalSurplus = Math.max(0, totalAvailable - totalTarget);

                itemsList.push({
                    name: itemName,
                    category,
                    target: totalTarget,
                    available: totalAvailable,
                    needed: globalNeeded,
                    surplus: globalSurplus,
                    hasCriticalShortage,
                    citiesNeeded: citiesNeeded.sort((a, b) => (b.needed - b.surplus) - (a.needed - a.surplus))
                });
            }
        });

        return itemsList;
    }, [allDemandItems, townGroups, templates, regionSettings, depots]);

    // Global Statistics Calculations
    const globalStats = useMemo(() => {
        let target = 0;
        let available = 0;
        let needed = 0;

        demandItems.forEach(item => {
            target += item.target;
            available += Math.min(item.available, item.target);
            needed += item.needed;
        });

        const percent = target > 0 ? (available / target) * 100 : 0;

        return { target, available, needed, percent };
    }, [demandItems]);

    // Splitting list into Deficit (Needed) and Excess (Surplus)
    const splitItems = useMemo(() => {
        const neededList: typeof demandItems = [];
        const surplusList: typeof demandItems = [];

        demandItems.forEach(item => {
            if (disabledCategories.has(item.category)) {
                return;
            }
            if (item.available > item.target) {
                surplusList.push(item);
            } else if (item.needed > 0) {
                neededList.push(item);
            }
        });

        // Apply filtering and sorting to Needed list
        let fNeeded = [...neededList];
        if (searchTerm.trim() !== '') {
            const query = searchTerm.toLowerCase();
            fNeeded = fNeeded.filter(item => item.name.toLowerCase().includes(query));
        }
        if (sortBy === 'high_low') {
            fNeeded.sort((a, b) => b.needed - a.needed);
        } else if (sortBy === 'low_high') {
            fNeeded.sort((a, b) => a.needed - b.needed);
        } else {
            fNeeded.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Apply filtering and sorting to Surplus list (sort by surplus amount)
        let fSurplus = [...surplusList];
        if (searchTerm.trim() !== '') {
            const query = searchTerm.toLowerCase();
            fSurplus = fSurplus.filter(item => item.name.toLowerCase().includes(query));
        }
        if (sortBy === 'high_low') {
            fSurplus.sort((a, b) => b.surplus - a.surplus);
        } else if (sortBy === 'low_high') {
            fSurplus.sort((a, b) => a.surplus - b.surplus);
        } else {
            fSurplus.sort((a, b) => a.name.localeCompare(b.name));
        }

        return { needed: fNeeded, surplus: fSurplus };
    }, [demandItems, searchTerm, sortBy, disabledCategories]);


    // Vibrant HSL transition coloring (from 0 = red to 120 = green)
    const getFulfillColor = (percent: number) => {
        const hue = Math.min(120, (percent / 100) * 120);
        return `hsl(${hue}, 85%, 45%)`;
    };

    const sortOptions = [
        { value: 'high_low', label: t('demand_high_low') },
        { value: 'low_high', label: t('demand_low_high') },
        { value: 'alpha', label: t('demand_alphabetical') }
    ];

    return (
        <div className="demand-tab">
            
            {/* 1. Demand Overview Header */}
            <div className="demand-section">
                <div className="demand-section-header">
                    <h2>
                        <BarChart3 size={18} style={{ color: 'var(--accent-color)' }} />
                        {t('demand_overview')}
                    </h2>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="popover-trigger"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDemandInfo(!showDemandInfo);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: showDemandInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s'
                            }}
                        >
                            <Info size={14} />
                        </button>
                        {showDemandInfo && (
                            <div className="popover-card" style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                zIndex: 99999,
                                width: '320px',
                                background: 'rgba(16, 22, 19, 0.96)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
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
                                    {t('info_demand_overview_title')}
                                </strong>
                                <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <li>{t('info_demand_overview_bullet1')}</li>
                                    <li>{t('info_demand_overview_bullet2')}</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="demand-stats-grid">
                    <div className="demand-stat anim-row-in">
                        <span className="demand-stat-label">{t('demand_target')}</span>
                        <div className="demand-stat-value">{globalStats.target.toLocaleString()}</div>
                    </div>
                    <div className="demand-stat anim-row-in" style={{ animationDelay: '50ms' }}>
                        <span className="demand-stat-label">{t('demand_available')}</span>
                        <div className="demand-stat-value" style={{ color: '#10b981' }}>{globalStats.available.toLocaleString()}</div>
                    </div>
                    <div className="demand-stat anim-row-in" style={{ animationDelay: '100ms' }}>
                        <span className="demand-stat-label">{t('demand_needed')}</span>
                        <div className="demand-stat-value" style={{ color: '#ef4444' }}>{globalStats.needed.toLocaleString()}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="demand-progress-track">
                        <div className="demand-progress-fill" style={{ transform: `scaleX(${globalStats.percent / 100})`, background: getFulfillColor(globalStats.percent) }} />
                    </div>
                    <div className="demand-progress-label">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{globalStats.percent.toFixed(1)}%</span>
                        <span>{t('demand_fulfilled')}</span>
                    </div>
                </div>
            </div>



            {/* 3. Filters & View Toggles Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flex: '1', minWidth: '280px', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1 }}>
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder={t('search_items')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* CustomSelect Dropdown integration for sorting */}
                    <div style={{ width: '200px' }}>
                        <CustomSelect 
                            options={sortOptions} 
                            value={sortBy} 
                            onChange={(val) => setSortBy(val as any)} 
                        />
                    </div>
                </div>
            </div>

            {/* 4. Collapsible Needed Section (Collapsed by default, fits 4 columns) */}
            <div className="demand-section">
                <div 
                    onClick={() => setIsNeededExpanded(!isNeededExpanded)}
                    className="demand-collapse-header"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} style={{ color: '#ef4444' }} />
                            <h3>
                                {`${t('needed_demands')} (${splitItems.needed.length})`}
                            </h3>
                    </div>
                    {isNeededExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isNeededExpanded && (
                    <div style={{ marginTop: '1.25rem', animation: 'slideDown 0.2s ease-out' }}>
                        {renderCategoryFilters()}
                        {(() => {
                                const totalItemsCount = splitItems.needed.length;
                                const totalPages = Math.ceil(totalItemsCount / ITEMS_PER_PAGE);
                                const displayedItems = splitItems.needed.slice((neededPage - 1) * ITEMS_PER_PAGE, neededPage * ITEMS_PER_PAGE);

                                if (totalItemsCount === 0) {
                                    return (
                                        <div className="demand-empty">
                                            {language === 'tr' ? 'İhtiyaç duyulan talep bulunmamaktadır.' : 'No deficits found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div key={neededGridAnimKey} className="demand-cards-grid">
                                            {displayedItems.map((item, idx) => {
                                                const percent = item.target > 0 ? Math.min(100, (item.available / item.target) * 100) : 0;
                                                const itemIcon = getItemIconUrl(item.name);
                                                const citiesWithStatus = item.citiesNeeded.filter(c => c.needed > 0 || c.surplus > 0);
                                                const isCitiesExpanded = expandedCities.has(item.name);
                                                const visibleCities = isCitiesExpanded
                                                    ? citiesWithStatus
                                                    : citiesWithStatus.slice(0, CITY_CHIP_COLLAPSE_LIMIT);
                                                const hiddenCitiesCount = citiesWithStatus.length - visibleCities.length;

                                                return (
                                                    <div key={item.name} className={`demand-card needed is-spring-in ${citiesWithStatus.length === 0 ? 'no-cities' : ''}`} style={{ animationDelay: `${idx * 45}ms` }}>
                                                        <div className="demand-card-main">
                                                            {/* Header: Icon & Item Name */}
                                                            <div className="demand-card-header">
                                                                <div className="demand-card-icon">
                                                                    {itemIcon ? (
                                                                        <img src={itemIcon} alt={item.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                                                                    ) : (
                                                                        <Package size={16} style={{ color: '#ef4444' }} />
                                                                    )}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <strong className="demand-card-title" title={item.name}>
                                                                        {item.name}
                                                                    </strong>
                                                                </div>
                                                            </div>

                                                            {/* 3-Stat Numbers Box */}
                                                            <div className="demand-stat-box">
                                                                <div>
                                                                    <div className="demand-stat-box-label">{t('demand_target')}</div>
                                                                    <CountUpStat value={item.target} />
                                                                </div>
                                                                <div>
                                                                    <div className="demand-stat-box-label">{t('demand_available')}</div>
                                                                    <CountUpStat value={item.available} color="#10b981" />
                                                                </div>
                                                                <div>
                                                                    <div className="demand-stat-box-label">{t('demand_needed')}</div>
                                                                    <CountUpStat value={item.needed} color="#ef4444" />
                                                                </div>
                                                            </div>

                                                            {/* Progress Bar */}
                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                                        {t('demand_fulfilled')}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: getFulfillColor(percent) }}>
                                                                        {percent.toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                                <div className="demand-progress-thin-track">
                                                                    <div className="demand-progress-thin-fill" style={{ transform: `scaleX(${percent / 100})`, background: getFulfillColor(percent) }} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Status in Cities (chips layout) */}
                                                        {citiesWithStatus.length > 0 && (
                                                            <div className="demand-city-panel">
                                                                <div className="demand-rows-title">
                                                                    <span>{language === 'tr' ? 'Şehirlerdeki Durum' : 'Status in Cities'}</span>
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)' }}>({citiesWithStatus.length})</span>
                                                                </div>
                                                                <div className="demand-city-chip-list">
                                                                    {visibleCities.map((city, cIdx) => {
                                                                        const isNeeded = city.needed > 0;
                                                                        const valueText = isNeeded
                                                                            ? `-${city.needed.toLocaleString()}`
                                                                            : `+${city.surplus.toLocaleString()}`;
                                                                        return (
                                                                            <DemandCityChip
                                                                                key={city.cityName}
                                                                                name={city.cityName}
                                                                                valueText={valueText}
                                                                                isNeeded={isNeeded}
                                                                                chipIndex={cIdx}
                                                                            />
                                                                        );
                                                                    })}
                                                                    {hiddenCitiesCount > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="demand-show-more"
                                                                            data-expanded={isCitiesExpanded}
                                                                            onClick={() => toggleCityExpansion(item.name)}
                                                                        >
                                                                            <span className="demand-show-more-icon">
                                                                                {isCitiesExpanded ? <Minus size={10} /> : <Plus size={10} />}
                                                                            </span>
                                                                            {isCitiesExpanded
                                                                                ? t('show_less_cities')
                                                                                : (
                                                                                    <>
                                                                                        {t('show_more_cities')}
                                                                                        <span className="demand-show-more-count">+{hiddenCitiesCount}</span>
                                                                                    </>
                                                                                )
                                                                            }
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Pagination controls */}
                                        {totalPages > 1 && (
                                            <div className="pagination-container" style={{ marginTop: '1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                <div className="pagination-info">
                                                    {language === 'tr' 
                                                        ? `Sayfa ${neededPage} / ${totalPages} (Toplam ${totalItemsCount} malzeme)` 
                                                        : `Page ${neededPage} of ${totalPages} (Total ${totalItemsCount} items)`}
                                                </div>
                                                <div className="pagination-controls">
                                                    <button onClick={() => setNeededPage(1)} disabled={neededPage === 1} className="pagination-btn">&laquo;</button>
                                                    <button onClick={() => setNeededPage(prev => Math.max(1, prev - 1))} disabled={neededPage === 1} className="pagination-btn">{language === 'tr' ? 'Önceki' : 'Previous'}</button>
                                                    <button onClick={() => setNeededPage(prev => Math.min(totalPages, prev + 1))} disabled={neededPage === totalPages} className="pagination-btn">{language === 'tr' ? 'Sonraki' : 'Next'}</button>
                                                    <button onClick={() => setNeededPage(totalPages)} disabled={neededPage === totalPages} className="pagination-btn">&raquo;</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        }
                    </div>
                )}
            </div>

            {/* 5. Collapsible Surplus Section (Collapsed by default, fits 4 columns) */}
            <div className="demand-section">
                <div
                    onClick={() => setIsSurplusExpanded(!isSurplusExpanded)}
                    className="demand-collapse-header"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                            <h3>
                                {`${t('surplus_stocks')} (${splitItems.surplus.length})`}
                            </h3>
                    </div>
                    {isSurplusExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isSurplusExpanded && (
                    <div style={{ marginTop: '1.25rem', animation: 'slideDown 0.2s ease-out' }}>
                        {renderCategoryFilters()}
                        {(() => {
                                const totalItemsCount = splitItems.surplus.length;
                                const totalPages = Math.ceil(totalItemsCount / ITEMS_PER_PAGE);
                                const displayedItems = splitItems.surplus.slice((surplusPage - 1) * ITEMS_PER_PAGE, surplusPage * ITEMS_PER_PAGE);

                                if (totalItemsCount === 0) {
                                    return (
                                        <div className="demand-empty">
                                            {language === 'tr' ? 'Fazla stok bulunmamaktad�r.' : 'No surplus stocks found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div className="demand-cards-grid">
                                            {displayedItems.map((item, idx) => {
                                                const surplus = item.available - item.target;
                                                const percent = 100;
                                                const itemIcon = getItemIconUrl(item.name);
                                                const citiesWithStatus = item.citiesNeeded.filter(c => c.needed > 0 || c.surplus > 0);
                                                const isCitiesExpanded = expandedCities.has(item.name);
                                                const visibleCities = isCitiesExpanded
                                                    ? citiesWithStatus
                                                    : citiesWithStatus.slice(0, CITY_CHIP_COLLAPSE_LIMIT);
                                                const hiddenCitiesCount = citiesWithStatus.length - visibleCities.length;

                                                return (
                                                    <div key={item.name} className={`demand-card surplus is-spring-in ${citiesWithStatus.length === 0 ? 'no-cities' : ''}`} style={{ animationDelay: `${idx * 45}ms` }}>
                                                        <div className="demand-card-main">
                                                            <div className="demand-card-header">
                                                                <div className="demand-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                                    {itemIcon ? (
                                                                        <img src={itemIcon} alt={item.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                                                                    ) : (
                                                                        <Package size={16} style={{ color: '#10b981' }} />
                                                                    )}
                                                                </div>
                                                                <strong className="demand-card-title" title={item.name}>
                                                                    {item.name}
                                                                </strong>
                                                            </div>

                                                            <div className="demand-stat-box">
                                                                <div>
                                                                    <div className="demand-stat-box-label">{t('demand_target')}</div>
                                                                    <CountUpStat value={item.target} />
                                                                </div>
                                                                <div>
                                                                    <div className="demand-stat-box-label">{t('demand_available')}</div>
                                                                    <CountUpStat value={item.available} color="#10b981" />
                                                                </div>
                                                                <div>
                                                                    <div className="demand-stat-box-label">{language === 'tr' ? 'Fazla' : 'Surplus'}</div>
                                                                    <CountUpStat value={surplus} color="#10b981" />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                                        {t('demand_fulfilled')}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981' }}>
                                                                        {percent.toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                                <div className="demand-progress-thin-track">
                                                                    <div className="demand-progress-thin-fill" style={{ transform: `scaleX(${percent / 100})`, background: '#10b981' }} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Status in Cities (chips layout) */}
                                                        {citiesWithStatus.length > 0 && (
                                                            <div className="demand-city-panel">
                                                                <div className="demand-rows-title">
                                                                    <span>{language === 'tr' ? 'Şehirlerdeki Durum' : 'Status in Cities'}</span>
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)' }}>({citiesWithStatus.length})</span>
                                                                </div>
                                                                <div className="demand-city-chip-list">
                                                                    {visibleCities.map((city, cIdx) => {
                                                                        const isNeeded = city.needed > 0;
                                                                        const valueText = isNeeded
                                                                            ? `-${city.needed.toLocaleString()}`
                                                                            : `+${city.surplus.toLocaleString()}`;
                                                                        return (
                                                                            <DemandCityChip
                                                                                key={city.cityName}
                                                                                name={city.cityName}
                                                                                valueText={valueText}
                                                                                isNeeded={isNeeded}
                                                                                chipIndex={cIdx}
                                                                            />
                                                                        );
                                                                    })}
                                                                    {hiddenCitiesCount > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="demand-show-more"
                                                                            data-expanded={isCitiesExpanded}
                                                                            onClick={() => toggleCityExpansion(item.name)}
                                                                        >
                                                                            <span className="demand-show-more-icon">
                                                                                {isCitiesExpanded ? <Minus size={10} /> : <Plus size={10} />}
                                                                            </span>
                                                                            {isCitiesExpanded
                                                                                ? t('show_less_cities')
                                                                                : (
                                                                                    <>
                                                                                        {t('show_more_cities')}
                                                                                        <span className="demand-show-more-count">+{hiddenCitiesCount}</span>
                                                                                    </>
                                                                                )
                                                                            }
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {totalPages > 1 && (
                                            <div className="pagination-container" style={{ marginTop: '1.25rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                <div className="pagination-info">
                                                    {language === 'tr'
                                                        ? `Sayfa ${surplusPage} / ${totalPages} (Toplam ${totalItemsCount} malzeme)`
                                                        : `Page ${surplusPage} of ${totalPages} (Total ${totalItemsCount} items)`}
                                                </div>
                                                <div className="pagination-controls">
                                                    <button onClick={() => setSurplusPage(1)} disabled={surplusPage === 1} className="pagination-btn">&laquo;</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.max(1, prev - 1))} disabled={surplusPage === 1} className="pagination-btn">{language === 'tr' ? '�nceki' : 'Previous'}</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.min(totalPages, prev + 1))} disabled={surplusPage === totalPages} className="pagination-btn">{language === 'tr' ? 'Sonraki' : 'Next'}</button>
                                                    <button onClick={() => setSurplusPage(totalPages)} disabled={surplusPage === totalPages} className="pagination-btn">&raquo;</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        }
                    </div>
                )}
            </div>
        </div>
    );
};
