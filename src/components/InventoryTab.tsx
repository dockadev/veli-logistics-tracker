import React from 'react';
import { Search, Package, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { Depot, FilterState, SortField, StockpileTemplates, RegionSettings } from '../types';
import { getPaginationRange, getCategoryClass } from '../utils/helpers';
import { getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { getDefaultTemplates, getDefaultRuleForCategory } from '../utils/defaultTemplates';

const parseDepotNameDetails = (fullName: string, townName?: string | null) => {
    const parts = fullName.split(' - ')
        .map(s => s.trim())
        .filter(s => !s.toLowerCase().includes('seaport') && !s.toLowerCase().includes('storage depot'));
    
    const code = parts[parts.length - 1] || fullName;
    const region = parts[0] || '';
    let subregion = '';

    if (parts.length >= 3) {
        subregion = parts[1];
    } else if (townName && townName.toLowerCase() !== region.toLowerCase()) {
        subregion = townName;
    }

    if (subregion) {
        const trimmed = subregion.trim();
        if (trimmed === 'Glimmerhaven') subregion = "Light's End";
        else if (trimmed === 'Loftmire' || trimmed === 'The Blemish') subregion = 'Blemish';
        else if (trimmed === 'Rising Loom') subregion = 'Therizo';
    }

    let location = region;
    if (subregion) {
        location = `${region} - ${subregion}`;
    }

    return {
        code,
        location
    };
};

interface InventoryTabProps {
    depots: Record<string, Depot>;
    activeDepot: Depot | null;
    templates?: StockpileTemplates;
    regionSettings?: RegionSettings;
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



export const InventoryTab: React.FC<InventoryTabProps> = React.memo(({ depots, activeDepot, templates = getDefaultTemplates(), regionSettings = {} }) => {
    const { t, language } = useLanguage();
    const [expandedItem, setExpandedItem] = React.useState<string | null>(null);
    const [disabledCategories, setDisabledCategories] = React.useState<Set<string>>(new Set());
    const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null);

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
    const canExpand = activeDepot && (activeDepot.name === 'all' || activeDepot.name.startsWith('town:'));
    const showTargets = activeDepot && (activeDepot.name === 'all' || activeDepot.name.startsWith('town:'));

    React.useEffect(() => {
        setExpandedItem(null);
    }, [activeDepot?.name]);

    const getDepotDistribution = React.useCallback((itemName: string) => {
        if (!activeDepot) return [];
        const matching: Record<string, { location: string; count: number; region: string }> = {};
        const isTownFilter = activeDepot.name.startsWith('town:');
        const targetTown = isTownFilter ? activeDepot.name.substring(5) : '';

        const getDepotGroup = (dep: Depot): string => {
            if (dep.townName) return dep.townName;
            const parts = dep.name.split(' - ');
            if (parts.length >= 3) return parts[1];
            return parts[0];
        };

        Object.values(depots).forEach(dep => {
            if (isTownFilter && getDepotGroup(dep) !== targetTown) {
                return;
            }
            const count = dep.current?.[itemName]?.count || 0;
            if (count > 0) {
                const details = parseDepotNameDetails(dep.customName || dep.name, dep.townName || null);
                const loc = details.location || 'Unknown Location';
                const region = dep.name.split(' - ')[0].trim();
                if (!matching[loc]) {
                    matching[loc] = {
                        location: loc,
                        count: 0,
                        region
                    };
                }
                matching[loc].count += count;
            }
        });

        // Convert to array and sort alphabetically by region, then by total count descending
        return Object.values(matching).sort((a, b) => {
            if (a.region !== b.region) {
                return a.region.localeCompare(b.region);
            }
            return b.count - a.count;
        });
    }, [depots, activeDepot]);

    const [filters, setFilters] = React.useState<FilterState>({
        search: '',
        category: 'all',
        change: 'all',
        sortField: undefined,
        sortDirection: 'none'
    });

    const [searchInput, setSearchInput] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    
    const activeDepotName = activeDepot?.name || '';
    
    // Resolve active regions
    const activeRegions = React.useMemo(() => {
        const regions = new Set<string>();
        if (!activeDepotName || activeDepotName === 'all') {
            Object.values(depots).forEach(d => {
                const reg = d.name.split(' - ')[0].trim();
                if (reg) regions.add(reg);
            });
        } else if (activeDepotName.startsWith('town:')) {
            const townGroup = activeDepotName.substring(5);
            const reg = townGroup.split(' - ')[0].trim();
            if (reg) regions.add(reg);
        } else {
            const reg = activeDepotName.split(' - ')[0].trim();
            if (reg) regions.add(reg);
        }
        return Array.from(regions);
    }, [activeDepotName, depots]);

    // Functions to calculate target min and max for an item
    const getItemTargetMax = React.useCallback((itemName: string, category: string) => {
        if (!templates || !regionSettings) return 0;
        let totalTarget = 0;
        
        activeRegions.forEach(regionName => {
            const setting = regionSettings[regionName] || { regionName: regionName, templateType: 'backline', demandPercentage: 100 };
            const template = templates[setting.templateType] || {};
            let rule = template[itemName];
            if (!rule) {
                rule = getDefaultRuleForCategory(category, setting.templateType);
            }
            // Skip vehicles and shippables (non-crates) as they are not template categories
            if (category === 'vehicles' || category === 'shippables') {
                return;
            }
            const targetVal = Math.round(rule.max * (setting.demandPercentage / 100));
            totalTarget += targetVal;
        });
        
        return totalTarget;
    }, [activeRegions, templates, regionSettings]);

    // Persistent page size state (15, 25, 50)
    const [itemsPerPage, setItemsPerPageState] = React.useState<number>(() => {
        const stored = localStorage.getItem('foxhole_items_per_page');
        const parsed = stored ? parseInt(stored, 10) : 15;
        return (parsed === 15 || parsed === 25 || parsed === 50) ? parsed : 15;
    });

    const setItemsPerPage = (size: number) => {
        setItemsPerPageState(size);
        localStorage.setItem('foxhole_items_per_page', String(size));
        setCurrentPage(1);
    };

    // Toggle 3-state column sorting: none -> asc -> desc -> none
    const handleSort = (field: SortField) => {
        setFilters(prev => {
            if (prev.sortField !== field) {
                return { ...prev, sortField: field, sortDirection: 'asc' };
            }
            if (prev.sortDirection === 'asc') {
                return { ...prev, sortField: field, sortDirection: 'desc' };
            }
            if (prev.sortDirection === 'desc') {
                return { ...prev, sortField: undefined, sortDirection: 'none' };
            }
            return { ...prev, sortField: field, sortDirection: 'asc' };
        });
    };

    const renderSortIcon = (field: SortField) => {
        if (filters.sortField !== field || filters.sortDirection === 'none') {
            return <ArrowUpDown size={13} style={{ opacity: 0.3, marginLeft: '4px' }} />;
        }
        if (filters.sortDirection === 'asc') {
            return <ArrowUp size={13} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />;
        }
        return <ArrowDown size={13} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />;
    };

    // Reset filters and local search query when changing selected depot
    React.useEffect(() => {
        setSearchInput('');
        setDebouncedSearch('');
        setCurrentPage(1);
        setFilters({
            search: '',
            category: 'all',
            change: 'all',
            sortField: undefined,
            sortDirection: 'none'
        });
    }, [activeDepot?.name]);

    // Reset current page when search query or filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, filters.category, filters.change, filters.sortField, filters.sortDirection]);

    // Reset change filter when category becomes 'all'
    React.useEffect(() => {
        if (filters.category === 'all') {
            setFilters(prev => ({ ...prev, change: 'all' }));
        }
    }, [filters.category]);

    // Apply debounce effect on search input
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const depot = React.useMemo(() => {
        return activeDepot || { name: '', customName: '', current: {}, previous: null, lastUpdated: '' };
    }, [activeDepot]);

    // Collect and compute difference between scans & calculate statistics (single-pass cached)
    const { itemsList, stats } = React.useMemo(() => {
        const allItemNames = Array.from(
            new Set([
                ...Object.keys(depot.previous || {}),
                ...Object.keys(depot.current || {})
            ])
        ).sort();

        let totalCurrentQty = 0;
        let increasedCount = 0;
        let decreasedCount = 0;
        let newCount = 0;

        const list = allItemNames.map(name => {
            const prevVal = depot.previous ? (depot.previous[name]?.count ?? 0) : null;
            const currVal = depot.current ? (depot.current[name]?.count ?? 0) : 0;
            const officialCat = getItemOfficialCategory(name);
            const targetMax = getItemTargetMax(name, officialCat);
            const target = targetMax;
            const needed = currVal - target;

            totalCurrentQty += currVal;

            let diff: number | string;
            let changeType: 'increased' | 'decreased' | 'new' | 'nochange';

            if (prevVal === null) {
                diff = 'NEW';
                changeType = 'new';
                newCount++;
            } else {
                const numDiff = currVal - prevVal;
                diff = numDiff;
                if (numDiff > 0) {
                    changeType = 'increased';
                    increasedCount++;
                } else if (numDiff < 0) {
                    changeType = 'decreased';
                    decreasedCount++;
                } else {
                    changeType = 'nochange';
                }
            }

            return {
                name,
                category: officialCat,
                prevVal,
                currVal,
                diff,
                changeType,
                target,
                needed
            };
        });

        return {
            itemsList: list,
            stats: {
                totalCurrentQty,
                increasedCount,
                decreasedCount,
                newCount
            }
        };
    }, [depot, getItemTargetMax]);

    // Apply filtering and 3-state sorting (cached)
    const filteredItems = React.useMemo(() => {
        const query = debouncedSearch.trim().toLowerCase();
        let result = itemsList.filter(item => {
            // Search filter
            if (query && !item.name.toLowerCase().includes(query)) {
                return false;
            }

            // Category filter
            if (disabledCategories.has(item.category)) {
                return false;
            }

            // Change filter
            if (filters.change !== 'all' && item.changeType !== filters.change) {
                return false;
            }

            return true;
        });

        // 3-state Column Sorting
        if (filters.sortField && filters.sortDirection && filters.sortDirection !== 'none') {
            const field = filters.sortField;
            const isAsc = filters.sortDirection === 'asc';

            result = [...result].sort((a, b) => {
                let valA: any = a[field];
                let valB: any = b[field];

                if (field === 'prevVal') {
                    valA = valA ?? -1;
                    valB = valB ?? -1;
                } else if (field === 'diff') {
                    valA = typeof valA === 'number' ? valA : 999999;
                    valB = typeof valB === 'number' ? valB : 999999;
                } else if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return isAsc ? -1 : 1;
                if (valA > valB) return isAsc ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [itemsList, debouncedSearch, disabledCategories, filters.change, filters.sortField, filters.sortDirection]);

    const paginatedItems = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredItems.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredItems, currentPage, itemsPerPage]);

    if (Object.keys(depots).length === 0) {
        return (
            <div id="tabContentInventory" className="tab-content-panel">
                <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                    <div className="empty-row">
                        <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block', color: 'var(--accent-color)' }} />
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                            {t('no_depots_imported')}
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            {t('no_active_depot')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="tabContentInventory" className="tab-content-panel">
            {/* Metrics Panel */}
            <div className="metrics-container">
                <div className="stat-card-modern anim-fade-in">
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('total_items')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.totalCurrentQty}
                    </div>
                    <div className="stat-card-sub text-muted">{t('currently_in_stock')}</div>
                </div>
                <div className="stat-card-modern anim-fade-in text-positive">
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('increased_stock')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.increasedCount}
                    </div>
                    <div className="stat-card-sub">{t('items_higher_qty')}</div>
                </div>
                <div className="stat-card-modern anim-fade-in text-negative">
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('decreased_stock')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.decreasedCount}
                    </div>
                    <div className="stat-card-sub">{t('items_lower_qty')}</div>
                </div>
                <div className="stat-card-modern anim-fade-in text-warning">
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('new_items')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.newCount}
                    </div>
                    <div className="stat-card-sub">{t('newly_added')}</div>
                </div>
            </div>

            {/* Stock Table Card */}
            <div className="table-container">
                <div className="table-actions" style={{ gap: '0.75rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1 }}>
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder={t('search_item_placeholder')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <div style={{ width: '160px' }}>
                            <CustomSelect
                                options={[
                                    { value: 'all', label: t('all_items') },
                                    { value: 'increased', label: t('increased_stock') },
                                    { value: 'decreased', label: t('decreased_stock') },
                                    { value: 'new', label: t('new_items') },
                                    { value: 'nochange', label: t('unchanged') }
                                ]}
                                value={filters.change}
                                onChange={(val) => setFilters(prev => ({ ...prev, change: val as any }))}
                                placeholder={t('status')}
                            />
                        </div>
                    </div>
                </div>

                {/* Category Filter Pills (YENİLİK 1) */}
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
                            background: hoveredCategory === 'all_master' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : (disabledCategories.size === OFFICIAL_CATEGORIES.length ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.05)'),
                            border: hoveredCategory === 'all_master' 
                                ? '1px solid rgba(255, 255, 255, 0.55)' 
                                : (disabledCategories.size === OFFICIAL_CATEGORIES.length ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(255, 255, 255, 0.18)'),
                            color: disabledCategories.size === OFFICIAL_CATEGORIES.length ? 'var(--text-muted)' : 'var(--text-primary)',
                            opacity: disabledCategories.size === OFFICIAL_CATEGORIES.length && hoveredCategory !== 'all_master' ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            marginRight: '0.25rem'
                        }}
                    >
                        {disabledCategories.size === OFFICIAL_CATEGORIES.length ? <EyeOff size={10} /> : <Eye size={10} />}
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

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {t('item_name')}
                                        {renderSortIcon('name')}
                                    </div>
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {t('category')}
                                        {renderSortIcon('category')}
                                    </div>
                                </th>
                                <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('currVal')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {t('current_qty')}
                                        {renderSortIcon('currVal')}
                                    </div>
                                </th>
                                {showTargets && (
                                    <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('target')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            {language === 'tr' ? 'Hedef' : 'Target'}
                                            {renderSortIcon('target')}
                                        </div>
                                    </th>
                                )}
                                {showTargets && (
                                    <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('needed')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            {language === 'tr' ? 'Fark / İhtiyaç' : 'Diff / Needed'}
                                            {renderSortIcon('needed')}
                                        </div>
                                    </th>
                                )}
                                <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('prevVal')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {t('previous_qty')}
                                        {renderSortIcon('prevVal')}
                                    </div>
                                </th>
                                <th className="text-right" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('diff')}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        {t('difference')}
                                        {renderSortIcon('diff')}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={showTargets ? 7 : 5} className="empty-row">
                                        <p>
                                            {!activeDepot || !activeDepot.current || Object.keys(activeDepot.current).length === 0
                                                ? (t('depot_is_empty') || 'Bu depo şu anda boş.')
                                                : t('no_items_match')
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map(item => {
                                    let changeClass = '';
                                    if (item.changeType === 'increased') changeClass = 'td-change-positive';
                                    else if (item.changeType === 'decreased') changeClass = 'td-change-negative';
                                    else if (item.changeType === 'new') changeClass = 'td-change-new';

                                    let diffElement: React.ReactNode;
                                    if (item.changeType === 'new') {
                                        diffElement = <span className="diff-val diff-new">NEW</span>;
                                    } else {
                                        const d = item.diff as number;
                                        if (d > 0) {
                                            diffElement = <span className="diff-val diff-positive">+{d}</span>;
                                        } else if (d < 0) {
                                            diffElement = <span className="diff-val diff-negative">{d}</span>;
                                        } else {
                                            diffElement = <span className="diff-val diff-zero">0</span>;
                                        }
                                    }

                                    const isCrate = item.name.endsWith('(Crate)');
                                    const displayName = isCrate ? item.name.substring(0, item.name.length - 7).trim() : item.name;
                                    const canExpandRow = canExpand && getDepotDistribution(item.name).length > 0;

                                    return (
                                        <React.Fragment key={item.name}>
                                            <tr 
                                                onClick={() => {
                                                    if (canExpandRow) {
                                                        setExpandedItem(prev => prev === item.name ? null : item.name);
                                                    }
                                                }}
                                                style={canExpandRow ? { cursor: 'pointer' } : undefined}
                                                className={expandedItem === item.name ? 'row-expanded' : ''}
                                            >
                                                <td className={changeClass}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                                                        {isCrate && <Package size={12} style={{ color: 'var(--accent-color)', opacity: 0.8, flexShrink: 0 }} />}
                                                        <span style={{ wordBreak: 'break-word' }}>{displayName}</span>
                                                        {canExpandRow && (
                                                            <ChevronDown 
                                                                size={13} 
                                                                style={{ 
                                                                    transition: 'transform 0.2s ease', 
                                                                    transform: expandedItem === item.name ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    color: 'var(--text-secondary)',
                                                                    opacity: 0.5,
                                                                    marginLeft: 'auto'
                                                                }} 
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getCategoryClass(item.category)}`}>{t(`cat_${item.category}` as TranslationKey)}</span>
                                                </td>
                                                <td className="text-right">{item.currVal}</td>
                                                {showTargets && (
                                                    <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{item.target}</td>
                                                )}
                                                {showTargets && (() => {
                                                    const needed = item.needed;
                                                    let neededStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontWeight: 600 };
                                                    let neededLabel = `0 (${language === 'tr' ? 'Tamam' : 'Optimal'})`;
                                                    if (needed > 0) {
                                                        neededStyle = { color: '#10b981', fontWeight: 700 };
                                                        neededLabel = `+${needed} (${language === 'tr' ? 'Fazla' : 'Surplus'})`;
                                                    } else if (needed < 0) {
                                                        neededStyle = { color: '#ef4444', fontWeight: 700 };
                                                        neededLabel = `${needed} (${language === 'tr' ? 'Eksik' : 'Shortage'})`;
                                                    }
                                                    return (
                                                        <td className="text-right" style={neededStyle}>{neededLabel}</td>
                                                    );
                                                })()}
                                                <td className="text-right">{item.prevVal ?? '-'}</td>
                                                <td className="text-right">{diffElement}</td>
                                            </tr>
                                            {expandedItem === item.name && canExpandRow && (
                                                <tr className="expanded-row-details">
                                                    <td colSpan={showTargets ? 7 : 5} style={{ background: 'rgba(0, 0, 0, 0.12)', padding: '0.75rem 1rem', borderBottom: '1px dashed var(--border-color)' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <Package size={12} />
                                                                <span>{language === 'tr' ? 'Depo Dağılımı:' : 'Depot Distribution:'}</span>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                                                                {getDepotDistribution(item.name).map((distItem) => {
                                                                    const { location, count } = distItem as any;
                                                                    return (
                                                                        <div key={location} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', fontSize: '0.7rem' }}>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
                                                                                <span style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                    {location}
                                                                                </span>
                                                                            </div>
                                                                            <span style={{ fontWeight: 750, color: 'var(--accent-color)', marginLeft: '0.75rem', fontSize: '0.78rem', flexShrink: 0 }}>
                                                                                {count}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {filteredItems.length > 0 && (
                    <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div className="pagination-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span>
                                {t('showing')} {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)} {t('to')} {Math.min(filteredItems.length, currentPage * itemsPerPage)} {t('of')} {filteredItems.length} {t('entries')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t('items_per_page')}:</span>
                                {[15, 25, 50].map(size => (
                                    <button
                                        key={size}
                                        className={`pagination-btn ${itemsPerPage === size ? 'active' : ''}`}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                        onClick={() => setItemsPerPage(size)}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {filteredItems.length > itemsPerPage && (
                            <div className="pagination-controls">
                                <button
                                    className="pagination-btn"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    {t('previous')}
                                </button>
                                {getPaginationRange(currentPage, Math.ceil(filteredItems.length / itemsPerPage)).map((page, idx) => {
                                    if (page === 'DOTS') {
                                        return (
                                            <span key={`dots-${idx}`} className="pagination-dots">
                                                ...
                                            </span>
                                        );
                                    }
                                    return (
                                        <button
                                            key={page}
                                            className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
                                <button
                                    className="pagination-btn"
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredItems.length / itemsPerPage), prev + 1))}
                                    disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
                                >
                                    {t('next')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

InventoryTab.displayName = 'InventoryTab';
