import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, CheckCircle, Info,
    Package, MapPin, ChevronDown, ChevronUp, BarChart3,
    Eye, EyeOff
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { getDefaultRuleForCategory } from '../utils/defaultTemplates';
import { CustomSelect } from './CustomSelect';
import type { Depot, StockpileTemplates, RegionSettings } from '../types';

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
    const [viewMode, setViewMode] = useState<'items' | 'cities'>('items');
    const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
        const isAllHovered = hoveredCategory === 'all_master';

        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.25rem' }}>
                <button
                    type="button"
                    onClick={toggleAllCategories}
                    onMouseEnter={() => setHoveredCategory('all_master')}
                    onMouseLeave={() => setHoveredCategory(null)}
                    style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isAllHovered 
                            ? 'rgba(255, 255, 255, 0.08)' 
                            : (allDisabled ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.05)'),
                        border: isAllHovered 
                            ? '1px solid rgba(255, 255, 255, 0.55)' 
                            : (allDisabled ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(255, 255, 255, 0.18)'),
                        color: allDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
                        opacity: allDisabled && !isAllHovered ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        marginRight: '0.25rem'
                    }}
                >
                    {allDisabled ? <EyeOff size={10} /> : <Eye size={10} />}
                    {language === 'tr' ? 'Tümü' : 'All'}
                </button>

                {OFFICIAL_CATEGORIES.map(cat => {
                    const isDisabled = disabledCategories.has(cat);
                    const isHovered = hoveredCategory === cat;
                    return (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            onMouseEnter={() => setHoveredCategory(cat)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '4px',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isHovered 
                                    ? 'rgba(255, 255, 255, 0.08)' 
                                    : (isDisabled ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.05)'),
                                border: isHovered 
                                    ? '1px solid rgba(255, 255, 255, 0.55)' 
                                    : (isDisabled ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(255, 255, 255, 0.18)'),
                                color: isDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
                                opacity: isDisabled && !isHovered ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                userSelect: 'none',
                                WebkitUserSelect: 'none'
                            }}
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

    // Reset pagination on filter change
    useEffect(() => {
        setNeededPage(1);
        setSurplusPage(1);
    }, [searchTerm, sortBy, viewMode, disabledCategories]);

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
        return parts[0] || 'Unknown Region';
    };

    const getDepotTown = (depName: string, depotTownField?: string | null): string | null => {
        let town = depotTownField || null;
        if (!town) {
            const parts = depName.split(' - ').map(s => s.trim()).filter(Boolean);
            const isDepotType = (str: string) => {
                const l = str.toLowerCase();
                return l.includes('seaport') || l.includes('depot') || l.includes('port');
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
            const town = getDepotTown(dep.name, dep.townName) || 'General';
            const groupKey = `${region} - ${town}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = { region, town, depots: [] };
            }
            groups[groupKey].depots.push(dep);
        });
        
        return groups;
    }, [depots]);

    // 2. Compute Target, Available, and Needed for ALL items across ALL town groups (skipping single vehicles and shippables)
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

        Array.from(COLONIAL_NEUTRAL_ITEMS).forEach(itemName => {
            const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);
            

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
                    rule = getDefaultRuleForCategory(category, setting.templateType);
                }
                // Skip if rule has min=0 & max=0
                if (rule.min === 0 && rule.max === 0) {
                    return;
                }
                const targetVal = Math.round(rule.max * (setting.demandPercentage / 100));
                totalTarget += targetVal;
            });

            const totalAvailable = Object.values(depots).reduce(
                (sum, d) => sum + (d.current?.[itemName]?.count || 0), 
                0
            );

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
                    rule = getDefaultRuleForCategory(category, setting.templateType);
                }

                const minVal = (rule.min === 0 && rule.max === 0) 
                    ? 0 
                    : Math.round(rule.min * (setting.demandPercentage / 100));
                const maxVal = (rule.min === 0 && rule.max === 0) 
                    ? 0 
                    : Math.round(rule.max * (setting.demandPercentage / 100));
                
                const availableVal = groupData.depots.reduce((sum, d) => sum + (d.current?.[itemName]?.count || 0), 0);
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
    }, [townGroups, templates, regionSettings]);

    // 3. Compute stats for each Town Group (City View) (skipping single vehicles and shippables)
    const demandCities = useMemo(() => {
        const citiesList: {
            name: string;
            region: string;
            town: string;
            target: number;
            available: number;
            needed: number;
            surplus: number;
            itemsNeeded: { name: string; target: number; available: number; needed: number; surplus: number }[];
        }[] = [];

        Object.entries(townGroups).forEach(([groupName, groupData]) => {
            let cityTarget = 0;
            let cityAvailable = 0;
            let cityNeeded = 0;
            let citySurplus = 0;
            const itemsNeeded: { name: string; target: number; available: number; needed: number; surplus: number }[] = [];

            Array.from(COLONIAL_NEUTRAL_ITEMS).forEach(itemName => {
                const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);
                if (disabledCategories.has(category)) {
                    return;
                }
                

                const setting = regionSettings[groupName] || { 
                    regionName: groupName, 
                    templateType: 'backline', 
                    demandPercentage: 100 
                };
                const template = templates[setting.templateType] || {};
                
                let rule = template[itemName];
                if (!rule) {
                    rule = getDefaultRuleForCategory(category, setting.templateType);
                }

                const maxVal = (rule.min === 0 && rule.max === 0) 
                    ? 0 
                    : Math.round(rule.max * (setting.demandPercentage / 100));
                
                const availableVal = groupData.depots.reduce((sum, d) => sum + (d.current?.[itemName]?.count || 0), 0);
                const neededVal = Math.max(0, maxVal - availableVal);
                const surplusVal = Math.max(0, availableVal - maxVal);

                cityAvailable += availableVal;
                citySurplus += surplusVal;

                if (maxVal > 0) {
                    cityTarget += maxVal;
                    cityNeeded += neededVal;

                    itemsNeeded.push({
                        name: itemName,
                        target: maxVal,
                        available: availableVal,
                        needed: neededVal,
                        surplus: surplusVal
                    });
                } else if (surplusVal > 0) {
                    itemsNeeded.push({
                        name: itemName,
                        target: 0,
                        available: availableVal,
                        needed: 0,
                        surplus: surplusVal
                    });
                }
            });

            citiesList.push({
                name: groupName,
                region: groupData.region,
                town: groupData.town,
                target: cityTarget,
                available: cityAvailable,
                needed: cityNeeded,
                surplus: citySurplus,
                itemsNeeded: itemsNeeded.sort((a, b) => b.needed - a.needed)
            });
        });

        return citiesList;
    }, [townGroups, templates, regionSettings, disabledCategories]);

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

    const splitCities = useMemo(() => {
        const neededList: typeof demandCities = [];
        const surplusList: typeof demandCities = [];

        demandCities.forEach(city => {
            if (city.available > city.target) {
                surplusList.push(city);
            } else if (city.needed > 0) {
                neededList.push(city);
            }
        });

        // Apply filtering and sorting to Needed list
        let fNeeded = [...neededList];
        if (searchTerm.trim() !== '') {
            const query = searchTerm.toLowerCase();
            fNeeded = fNeeded.filter(city => city.name.toLowerCase().includes(query));
        }
        if (sortBy === 'high_low') {
            fNeeded.sort((a, b) => b.needed - a.needed);
        } else if (sortBy === 'low_high') {
            fNeeded.sort((a, b) => a.needed - b.needed);
        } else {
            fNeeded.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Apply filtering and sorting to Surplus list
        let fSurplus = [...surplusList];
        if (searchTerm.trim() !== '') {
            const query = searchTerm.toLowerCase();
            fSurplus = fSurplus.filter(city => city.name.toLowerCase().includes(query));
        }
        if (sortBy === 'high_low') {
            fSurplus.sort((a, b) => b.surplus - a.surplus);
        } else if (sortBy === 'low_high') {
            fSurplus.sort((a, b) => a.surplus - b.surplus);
        } else {
            fSurplus.sort((a, b) => a.name.localeCompare(b.name));
        }

        return { needed: fNeeded, surplus: fSurplus };
    }, [demandCities, searchTerm, sortBy]);



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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', animation: 'fadeIn 0.25s ease-out' }}>
            
            {/* 1. Demand Overview Header */}
            <div className="panel-card" style={{ 
                padding: '1.5rem', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 1.25rem 0' }}>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ 
                        padding: '1.25rem', 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                    }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('demand_target')}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {globalStats.target.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ 
                        padding: '1.25rem', 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                    }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('demand_available')}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-heading)' }}>
                            {globalStats.available.toLocaleString()}
                        </div>
                    </div>
                    <div style={{ 
                        padding: '1.25rem', 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                    }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {t('demand_needed')}
                        </span>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-heading)' }}>
                            {globalStats.needed.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${globalStats.percent}%`, background: getFulfillColor(globalStats.percent), borderRadius: '4px', transition: 'width 0.5s ease-out' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{globalStats.percent.toFixed(1)}%</span>
                        <span style={{ marginLeft: '0.25rem' }}>{t('demand_fulfilled')}</span>
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

                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <button
                        onClick={() => setViewMode('items')}
                        style={{
                            padding: '0.4rem 1rem',
                            background: viewMode === 'items' ? 'var(--btn-primary-bg, #3b82f6)' : 'transparent',
                            color: viewMode === 'items' ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {t('demand_items_view')}
                    </button>
                    <button
                        onClick={() => setViewMode('cities')}
                        style={{
                            padding: '0.4rem 1rem',
                            background: viewMode === 'cities' ? 'var(--btn-primary-bg, #3b82f6)' : 'transparent',
                            color: viewMode === 'cities' ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {t('demand_cities_view')}
                    </button>
                </div>
            </div>

            {/* 4. Collapsible Needed Section (Collapsed by default, fits 4 columns) */}
            <div className="panel-card" style={{ padding: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div 
                    onClick={() => setIsNeededExpanded(!isNeededExpanded)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} style={{ color: '#ef4444' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                            {viewMode === 'items' 
                                ? `${t('needed_demands')} (${(viewMode === 'items' ? splitItems.needed.length : splitCities.needed.length)})` 
                                : `${t('needed_cities_title')} (${splitCities.needed.length})`}
                        </h3>
                    </div>
                    {isNeededExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isNeededExpanded && (
                    <div style={{ marginTop: '1.25rem', animation: 'slideDown 0.2s ease-out' }}>
                        {renderCategoryFilters()}
                        {viewMode === 'items' ? (
                            (() => {
                                const totalItemsCount = splitItems.needed.length;
                                const totalPages = Math.ceil(totalItemsCount / ITEMS_PER_PAGE);
                                const displayedItems = splitItems.needed.slice((neededPage - 1) * ITEMS_PER_PAGE, neededPage * ITEMS_PER_PAGE);

                                if (totalItemsCount === 0) {
                                    return (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {language === 'tr' ? 'İhtiyaç duyulan talep bulunmamaktadır.' : 'No deficits found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {displayedItems.map(item => {
                                                const percent = item.target > 0 ? Math.min(100, (item.available / item.target) * 100) : 0;
                                                const surplus = Math.max(0, item.available - item.target);
                                                return (
                                                    <div key={item.name} className="panel-card needed-demand-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <Package size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={item.name}>
                                                                {item.name}
                                                            </strong>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_target')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.target.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_available')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.15rem', flexWrap: 'wrap' }}>
                                                                    {item.available.toLocaleString()}
                                                                    {surplus > 0 && (
                                                                        <span style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: 600 }}>
                                                                            (+{surplus})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_needed')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>{item.needed.toLocaleString()}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15rem' }}>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: getFulfillColor(percent) }}>
                                                                    {percent.toFixed(0)}%
                                                                </span>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                                    {t('demand_fulfilled').toLowerCase()}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${percent}%`, background: getFulfillColor(percent), borderRadius: '2px' }} />
                                                            </div>
                                                        </div>

                                                        {item.citiesNeeded.filter(c => c.needed > 0 || c.surplus > 0).length > 0 && (
                                                            <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                                                                    {language === 'tr' ? 'Şehirlerdeki Durum:' : 'Status in Cities:'}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '60px', overflowY: 'auto' }}>
                                                                    {item.citiesNeeded.filter(c => c.needed > 0 || c.surplus > 0).map(city => {
                                                                        const isNeeded = city.needed > 0;
                                                                        const valueText = isNeeded ? `-${city.needed.toLocaleString()}` : `+${city.surplus.toLocaleString()}`;
                                                                        const valueColor = isNeeded ? '#ef4444' : '#10b981';
                                                                        return (
                                                                            <div key={city.cityName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', padding: '0.05rem 0.2rem', background: 'rgba(255,255,255,0.01)' }}>
                                                                                <span style={{ color: 'var(--text-primary)' }}>{city.cityName}</span>
                                                                                <span style={{ color: valueColor, fontWeight: 600 }}>{valueText}</span>
                                                                            </div>
                                                                        );
                                                                    })}
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
                        ) : (
                            (() => {
                                const totalCitiesCount = splitCities.needed.length;
                                const totalPages = Math.ceil(totalCitiesCount / ITEMS_PER_PAGE);
                                const displayedCities = splitCities.needed.slice((neededPage - 1) * ITEMS_PER_PAGE, neededPage * ITEMS_PER_PAGE);

                                if (totalCitiesCount === 0) {
                                    return (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {language === 'tr' ? 'İhtiyaç duyulan şehir bulunmamaktadır.' : 'No cities with deficits found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {displayedCities.map(city => {
                                                const percent = city.target > 0 ? Math.min(100, (city.available / city.target) * 100) : 0;
                                                return (
                                                    <div key={city.name} className="panel-card needed-demand-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <MapPin size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={city.name}>
                                                                {city.name}
                                                            </strong>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_target')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{city.target.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_available')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{city.available.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_needed')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>{city.needed.toLocaleString()}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15rem' }}>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: getFulfillColor(percent) }}>
                                                                    {percent.toFixed(0)}%
                                                                </span>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                                    {t('demand_fulfilled').toLowerCase()}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${percent}%`, background: getFulfillColor(percent), borderRadius: '2px' }} />
                                                            </div>
                                                        </div>

                                                        {city.itemsNeeded.length > 0 && (
                                                            <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                                                                    {t('needed_items')}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '90px', overflowY: 'auto' }}>
                                                                    {city.itemsNeeded.filter(i => i.needed > 0).map(item => (
                                                                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', padding: '0.05rem 0.2rem', background: 'rgba(255,255,255,0.01)' }}>
                                                                            <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.name}>
                                                                                {item.name}
                                                                            </span>
                                                                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{item.needed.toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
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
                                                        ? `Sayfa ${neededPage} / ${totalPages} (Toplam ${totalCitiesCount} şehir)` 
                                                        : `Page ${neededPage} of ${totalPages} (Total ${totalCitiesCount} cities)`}
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
                        )}
                    </div>
                )}
            </div>

            {/* 5. Collapsible Surplus Section (Collapsed by default, fits 4 columns) */}
            <div className="panel-card" style={{ padding: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div 
                    onClick={() => setIsSurplusExpanded(!isSurplusExpanded)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                            {viewMode === 'items' 
                                ? `${t('surplus_stocks')} (${(viewMode === 'items' ? splitItems.surplus.length : splitCities.surplus.length)})` 
                                : `${t('surplus_cities')} (${splitCities.surplus.length})`}
                        </h3>
                    </div>
                    {isSurplusExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isSurplusExpanded && (
                    <div style={{ marginTop: '1.25rem', animation: 'slideDown 0.2s ease-out' }}>
                        {renderCategoryFilters()}
                        {viewMode === 'items' ? (
                            (() => {
                                const totalItemsCount = splitItems.surplus.length;
                                const totalPages = Math.ceil(totalItemsCount / ITEMS_PER_PAGE);
                                const displayedItems = splitItems.surplus.slice((surplusPage - 1) * ITEMS_PER_PAGE, surplusPage * ITEMS_PER_PAGE);

                                if (totalItemsCount === 0) {
                                    return (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {language === 'tr' ? 'Fazla stok bulunmamaktadır.' : 'No surplus stocks found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {displayedItems.map(item => {
                                                const surplus = item.available - item.target;
                                                const percent = 100;
                                                return (
                                                    <div key={item.name} className="panel-card surplus-stock-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <Package size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={item.name}>
                                                                {item.name}
                                                            </strong>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_target')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.target.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_available')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.available.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{language === 'tr' ? 'Fazla' : 'Surplus'}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>+{surplus.toLocaleString()}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15rem' }}>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                                                                    {percent.toFixed(0)}%
                                                                </span>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                                    {t('demand_fulfilled').toLowerCase()}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${percent}%`, background: '#10b981', borderRadius: '2px' }} />
                                                            </div>
                                                        </div>

                                                        {item.citiesNeeded.length > 0 && (
                                                            <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                                                                    {language === 'tr' ? 'Şehirlerdeki Durum:' : 'Status in Cities:'}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '60px', overflowY: 'auto' }}>
                                                                    {item.citiesNeeded.filter(c => c.needed > 0 || c.surplus > 0).map(city => {
                                                                        const isNeeded = city.needed > 0;
                                                                        const valueText = isNeeded ? `-${city.needed.toLocaleString()}` : `+${city.surplus.toLocaleString()}`;
                                                                        const valueColor = isNeeded ? '#ef4444' : '#10b981';
                                                                        return (
                                                                            <div key={city.cityName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', padding: '0.05rem 0.2rem', background: 'rgba(255,255,255,0.01)' }}>
                                                                                <span style={{ color: 'var(--text-primary)' }}>{city.cityName}</span>
                                                                                <span style={{ color: valueColor, fontWeight: 600 }}>{valueText}</span>
                                                                            </div>
                                                                        );
                                                                    })}
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
                                                        ? `Sayfa ${surplusPage} / ${totalPages} (Toplam ${totalItemsCount} malzeme)` 
                                                        : `Page ${surplusPage} of ${totalPages} (Total ${totalItemsCount} items)`}
                                                </div>
                                                <div className="pagination-controls">
                                                    <button onClick={() => setSurplusPage(1)} disabled={surplusPage === 1} className="pagination-btn">&laquo;</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.max(1, prev - 1))} disabled={surplusPage === 1} className="pagination-btn">{language === 'tr' ? 'Önceki' : 'Previous'}</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.min(totalPages, prev + 1))} disabled={surplusPage === totalPages} className="pagination-btn">{language === 'tr' ? 'Sonraki' : 'Next'}</button>
                                                    <button onClick={() => setSurplusPage(totalPages)} disabled={surplusPage === totalPages} className="pagination-btn">&raquo;</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        ) : (
                            (() => {
                                const totalCitiesCount = splitCities.surplus.length;
                                const totalPages = Math.ceil(totalCitiesCount / ITEMS_PER_PAGE);
                                const displayedCities = splitCities.surplus.slice((surplusPage - 1) * ITEMS_PER_PAGE, surplusPage * ITEMS_PER_PAGE);

                                if (totalCitiesCount === 0) {
                                    return (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {language === 'tr' ? 'Fazla stoklu şehir bulunmamaktadır.' : 'No cities with surplus stocks found.'}
                                        </div>
                                    );
                                }

                                return (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                                            {displayedCities.map(city => {
                                                const percent = 100;
                                                return (
                                                    <div key={city.name} className="panel-card surplus-stock-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <MapPin size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                                                            <strong style={{ fontSize: '0.75rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={city.name}>
                                                                {city.name}
                                                            </strong>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_target')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{city.target.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('demand_available')}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{city.available.toLocaleString()}</div>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{language === 'tr' ? 'Fazla' : 'Surplus'}</div>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>+{city.surplus.toLocaleString()}</div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.15rem' }}>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                                                                    {percent.toFixed(0)}%
                                                                </span>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                                    {t('demand_fulfilled').toLowerCase()}
                                                                </span>
                                                            </div>
                                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${percent}%`, background: '#10b981', borderRadius: '2px' }} />
                                                            </div>
                                                        </div>

                                                        {city.itemsNeeded.length > 0 && (
                                                            <div style={{ marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                                                                    {language === 'tr' ? 'Fazla Stoklu Malzemeler:' : 'Surplus Items:'}
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '90px', overflowY: 'auto' }}>
                                                                    {city.itemsNeeded.filter(i => i.surplus > 0).map(item => (
                                                                        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', padding: '0.05rem 0.2rem', background: 'rgba(255,255,255,0.01)' }}>
                                                                            <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={item.name}>
                                                                                {item.name}
                                                                            </span>
                                                                            <span style={{ color: '#10b981', fontWeight: 600 }}>+{item.surplus.toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
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
                                                        ? `Sayfa ${surplusPage} / ${totalPages} (Toplam ${totalCitiesCount} şehir)` 
                                                        : `Page ${surplusPage} of ${totalPages} (Total ${totalCitiesCount} cities)`}
                                                </div>
                                                <div className="pagination-controls">
                                                    <button onClick={() => setSurplusPage(1)} disabled={surplusPage === 1} className="pagination-btn">&laquo;</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.max(1, prev - 1))} disabled={surplusPage === 1} className="pagination-btn">{language === 'tr' ? 'Önceki' : 'Previous'}</button>
                                                    <button onClick={() => setSurplusPage(prev => Math.min(totalPages, prev + 1))} disabled={surplusPage === totalPages} className="pagination-btn">{language === 'tr' ? 'Sonraki' : 'Next'}</button>
                                                    <button onClick={() => setSurplusPage(totalPages)} disabled={surplusPage === totalPages} className="pagination-btn">&raquo;</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
