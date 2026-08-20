import React from 'react';
import { Search, Package, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { Depot, FilterState, SortField, StockpileTemplates, RegionSettings } from '../types';
import { getPaginationRange, getCategoryClass, resolveTemplateSetting, formatCanonicalItemName } from '../utils/helpers';
import { getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { getDefaultTemplates } from '../utils/defaultTemplates';
import { getItemIconUrl, getCategoryIconUrl } from '../utils/itemIcons';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';

const parseDepotNameDetails = (fullName: string, townName?: string | null) => {
    const parts = fullName.split(' - ')
        .map(s => s.trim())
        .filter(s => {
            const l = s.toLowerCase();
            return !(
                l.includes('seaport') || l.includes('storage depot') || l.includes('aircraft depot') ||
                l.includes('seehafen') || l.includes('lagerdepot') || l.includes('flugzeugdepot') ||
                l.includes('porto') || l.includes('depósito') ||
                l.includes('порт') || l.includes('склад') ||
                l.includes('dépôt')
            );
        });
    
    const code = parts[parts.length - 1] || fullName;
    const rawRegion = parts[0] || '';
    const region = (rawRegion === 'The Blemish' || rawRegion === 'The Blemsh') ? 'Blemish' : rawRegion;
    let subregion = '';

    if (parts.length >= 3) {
        subregion = parts[1];
    } else if (townName && townName.toLowerCase() !== region.toLowerCase()) {
        subregion = townName;
    }

    if (subregion) {
        const trimmed = subregion.trim();
        if (trimmed === 'Glimmerhaven') subregion = "Light's End";
        else if (trimmed === 'Loftmire' || trimmed === 'The Blemish' || trimmed === 'The Blemsh') subregion = 'Blemish';
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
        const matching: Record<string, { location: string; subregion: string; count: number; region: string; depotName: string }> = {};
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
                const depKey = dep.customName || dep.name;
                const details = parseDepotNameDetails(dep.customName || dep.name, dep.townName || null);
                const loc = details.location || 'Unknown Location';
                const region = dep.name.split(' - ')[0].trim();
                const subregion = loc.split(' - ').slice(1).join(' - ').trim() || region;
                if (!matching[depKey]) {
                    matching[depKey] = {
                        location: loc,
                        subregion,
                        count: 0,
                        region,
                        depotName: depKey
                    };
                }
                matching[depKey].count += count;
            }
        });

        // Convert to array and sort alphabetically by region, then by subregion, then by depot name
        return Object.values(matching).sort((a, b) => {
            if (a.region !== b.region) {
                return a.region.localeCompare(b.region);
            }
            if (a.subregion !== b.subregion) {
                return a.subregion.localeCompare(b.subregion);
            }
            return a.depotName.localeCompare(b.depotName);
        });
    }, [depots, activeDepot]);

    const [filters, setFilters] = React.useState<FilterState>({
        search: '',
        category: 'all',
        change: 'all',
        sortField: 'currVal',
        sortDirection: 'desc'
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
            const setting = resolveTemplateSetting(regionName, activeDepot?.townName || null, activeDepot?.subregion || null, regionSettings);
            const template = templates[setting.templateType] || {};
            let rule = template[itemName];
            if (!rule) {
                return;
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
            return (
                <span className="sort-icon-wrap">
                    <ArrowUpDown size={12} />
                </span>
            );
        }
        if (filters.sortDirection === 'asc') {
            return (
                <span className="sort-icon-wrap is-active">
                    <ArrowUp size={12} />
                </span>
            );
        }
        return (
            <span className="sort-icon-wrap is-active">
                <ArrowDown size={12} />
            </span>
        );
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
            sortField: 'currVal',
            sortDirection: 'desc'
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
        const rawKeys = [
            ...Object.keys(depot.previous || {}),
            ...Object.keys(depot.current || {})
        ];

        // 1. Canonicalize item names (Plasma -> Blood Plasma, Bandage -> Bandages, Supplies -> Maintenance Supplies)
        const canonicalKeys = rawKeys.map(k => formatCanonicalItemName(k));

        // 2. Filter out fake/invalid items that have no PNG icon AND are not valid Colonial items
        const validKeys = canonicalKeys.filter(name => {
            const clean = name.replace(/\s*\(Crate\)$/i, '').trim();
            if (clean === 'Rifle' || clean === 'Heavy Artillery') return false;
            // Non-crate Maintenance Supplies is an internal engine value; only the (Crate) form is meaningful
            if (name === 'Maintenance Supplies') return false;
            if (getItemIconUrl(name)) return true;
            if (COLONIAL_NEUTRAL_ITEMS.has(clean) || COLONIAL_NEUTRAL_ITEMS.has(name)) return true;
            return false;
        });

        const allItemNames = Array.from(new Set(validKeys)).sort();

        let totalCurrentQty = 0;
        let increasedCount = 0;
        let decreasedCount = 0;
        let newCount = 0;

        const getQty = (dict: Record<string, { count: number }> | null | undefined, targetName: string): number | null => {
            if (!dict) return null;
            let sum = 0;
            let found = false;
            Object.entries(dict).forEach(([k, v]) => {
                if (formatCanonicalItemName(k) === targetName) {
                    sum += (v?.count || 0);
                    found = true;
                }
            });
            return found ? sum : null;
        };

        const list = allItemNames.map(name => {
            const prevVal = getQty(depot.previous, name);
            const currVal = getQty(depot.current, name) ?? 0;
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
                        <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.4, display: 'block', color: 'var(--ink-100)' }} />
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--ink-100)', letterSpacing: '0.04em' }}>
                            {t('no_depots_imported')}
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--ink-60)', maxWidth: '400px', margin: '0 auto' }}>
                            {t('no_active_depot')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="tabContentInventory" className="tab-content-panel">
            {/* Metrics Panel - Bento */}
            <div className="metrics-container">
                <div className="stat-card-modern is-feature anim-bento" style={{ animationDelay: '0ms' }}>
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('total_items')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.totalCurrentQty}
                    </div>
                    <div className="stat-card-sub text-muted">{t('currently_in_stock')}</div>
                </div>
                <div className="stat-card-modern anim-bento text-positive" style={{ animationDelay: '60ms' }}>
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('increased_stock')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.increasedCount}
                    </div>
                    <div className="stat-card-sub">{t('items_higher_qty')}</div>
                </div>
                <div className="stat-card-modern anim-bento text-negative" style={{ animationDelay: '120ms' }}>
                    <div className="stat-card-header">
                        <div className="stat-card-title">{t('decreased_stock')}</div>
                    </div>
                    <div className="stat-card-value">
                        {stats.decreasedCount}
                    </div>
                    <div className="stat-card-sub">{t('items_lower_qty')}</div>
                </div>
                <div className="stat-card-modern anim-bento text-warning" style={{ animationDelay: '180ms' }}>
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
                        <div style={{ minWidth: '170px', flexShrink: 0 }}>
                            <CustomSelect
                                className="inventory-filter-select"
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
                                    gap: '0.35rem',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none'
                                }}
                            >
                                {isDisabled ? <EyeOff size={10} /> : (
                                    getCategoryIconUrl(cat) ? (
                                        <img 
                                            src={getCategoryIconUrl(cat)!} 
                                            alt={cat} 
                                            style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} 
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : <Eye size={10} />
                                )}
                                {t(`cat_${cat}` as any)}
                            </button>
                        );
                    })}
                </div>

                {/* Column Header - aligned with rows */}
                <div className="bento-row-header">
                    <div className="bento-row-header-spacer" />
                    <div className="bento-row-header-icon" />
                    <div className="bento-row-header-col is-name" onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        {t('item_name')}
                        {renderSortIcon('name')}
                    </div>
                    <div className="bento-row-header-col is-prev" onClick={() => handleSort('prevVal')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        {t('previous_qty')}
                        {renderSortIcon('prevVal')}
                    </div>
                    <div className="bento-row-header-col is-current" onClick={() => handleSort('currVal')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        {t('current_qty')}
                        {renderSortIcon('currVal')}
                    </div>
                    {showTargets && (
                        <div className="bento-row-header-col is-target" onClick={() => handleSort('target')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                            {language === 'tr' ? 'Hedef' : 'Target'}
                            {renderSortIcon('target')}
                        </div>
                    )}
                    {showTargets && (
                        <div className="bento-row-header-col is-needed" onClick={() => handleSort('needed')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                            {t('needed')}
                            {renderSortIcon('needed')}
                        </div>
                    )}
                    <div className="bento-row-header-col is-diff" onClick={() => handleSort('diff')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        {t('difference')}
                        {renderSortIcon('diff')}
                    </div>
                    <div className="bento-row-header-col is-expand" />
                </div>

                {/* Bento Grid */}
                <div className="table-wrapper" style={{ maxHeight: 'none', overflow: 'visible' }}>
                    {filteredItems.length === 0 ? (
                        <div className="empty-row" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                            <p>
                                {!activeDepot || !activeDepot.current || Object.keys(activeDepot.current).length === 0
                                    ? (t('depot_is_empty') || 'Bu depo şu anda boş.')
                                    : t('no_items_match')
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="bento-grid">
                            {paginatedItems.map((item, idx) => {
                                let changeIndicator = '';
                                if (item.changeType === 'increased') changeIndicator = 'increased';
                                else if (item.changeType === 'decreased') changeIndicator = 'decreased';
                                else if (item.changeType === 'new') changeIndicator = 'new';

                                let diffText = '';
                                if (item.changeType === 'new') diffText = 'NEW';
                                else {
                                    const d = item.diff as number;
                                    if (d > 0) diffText = `+${d}`;
                                    else if (d < 0) diffText = `${d}`;
                                    else diffText = '0';
                                }

                                const displayName = item.name;
                                const canExpandRow = canExpand && getDepotDistribution(item.name).length > 0;
                                const iconUrl = getItemIconUrl(item.name);
                                const isExpanded = expandedItem === item.name;

                                return (
                                    <React.Fragment key={item.name}>
                                        <div
                                            className={`bento-row anim-row-in ${isExpanded ? 'is-expanded' : ''}`}
                                            style={{ animationDelay: `${Math.min(idx * 25, 400)}ms` }}
                                            onClick={() => { if (canExpandRow) setExpandedItem(prev => prev === item.name ? null : item.name); }}
                                        >
                                            <div className={`bento-row-indicator ${changeIndicator}`} />
                                            <div className="bento-row-icon-wrap">
                                                {iconUrl && <img src={iconUrl} alt={displayName} className="bento-row-icon" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />}
                                            </div>
                                            <div className="bento-row-name">
                                                <span className="bento-row-name-text">{displayName}</span>
                                                <span className={`badge ${getCategoryClass(item.category)}`}>{t(`cat_${item.category}` as TranslationKey)}</span>
                                            </div>
                                            <div className="bento-row-cell is-prev">
                                                <span className="bento-cell-value is-prev">{item.prevVal ?? '—'}</span>
                                            </div>
                                            <div className="bento-row-cell is-current">
                                                <span className="bento-cell-value">{item.currVal}</span>
                                            </div>
                                            {showTargets && (
                                                <>
                                                    <div className="bento-row-cell is-target">
                                                        <span className="bento-cell-value is-target">{item.target}</span>
                                                    </div>
                                                    <div className="bento-row-cell is-needed">
                                                        <span className="bento-cell-label" style={{ color: item.needed > 0 ? 'var(--color-positive)' : item.needed < 0 ? 'var(--color-negative)' : 'var(--ink-80)' }}>
                                                            {item.needed > 0 ? (language === 'tr' ? 'Fazla' : 'Surplus') : item.needed < 0 ? (language === 'tr' ? 'Eksik' : 'Shortage') : (language === 'tr' ? 'Optimal' : 'OK')}
                                                        </span>
                                                        <span className="bento-cell-value is-needed" style={{ color: item.needed > 0 ? 'var(--color-positive)' : item.needed < 0 ? 'var(--color-negative)' : 'var(--ink-80)' }}>
                                                            {item.needed > 0 ? `+${item.needed}` : item.needed < 0 ? item.needed : '0'}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="bento-row-cell is-diff">
                                                <span className="bento-cell-value is-diff-val" style={{ color: item.changeType === 'new' ? 'var(--color-warning)' : item.changeType === 'increased' ? 'var(--color-positive)' : item.changeType === 'decreased' ? 'var(--color-negative)' : 'var(--ink-70)' }}>
                                                    {diffText}
                                                </span>
                                            </div>
                                            {canExpandRow ? (
                                                <div className="bento-row-expand">
                                                    <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                                </div>
                                            ) : (
                                                <div className="bento-row-expand is-empty" />
                                            )}
                                        </div>
                                        {isExpanded && canExpandRow && (
                                            <div className="bento-dist-panel">
                                                <div className="bento-dist-panel-header">
                                                    <ArrowRight size={14} />
                                                    <span>{language === 'tr' ? 'Depo Dağılımı' : 'Depot Distribution'}: {displayName}</span>
                                                    <span className="bento-dist-total">{item.currVal} {t('current')}</span>
                                                </div>
                                                {getDepotDistribution(item.name).reduce<{ region: string; subregions: { subregion: string; total: number; depots: { depotName: string; count: number }[] }[] }[]>((groups, distItem) => {
                                                    const { region, subregion, depotName, count } = distItem as any;
                                                    let rg = groups.find(g => g.region === region);
                                                    if (!rg) {
                                                        rg = { region, subregions: [] };
                                                        groups.push(rg);
                                                    }
                                                    let sg = rg.subregions.find(s => s.subregion === subregion);
                                                    if (!sg) {
                                                        sg = { subregion, total: 0, depots: [] };
                                                        rg.subregions.push(sg);
                                                    }
                                                    sg.total += count;
                                                    sg.depots.push({ depotName, count });
                                                    return groups;
                                                }, []).map(group => {
                                                    const regionTotal = group.subregions.reduce((sum, s) => sum + s.total, 0);
                                                    return (
                                                    <div key={group.region} className="bento-dist-region">
                                                        <div className="bento-dist-region-name">
                                                            {group.region}
                                                            <span className="bento-dist-region-total">{regionTotal.toLocaleString()} {language === 'tr' ? 'kasa' : 'crates'}</span>
                                                        </div>
                                                        {group.subregions.map(sub => (
                                                            <div key={sub.subregion} className="bento-dist-subregion">
                                                                <div className="bento-dist-subregion-name">
                                                                    {sub.subregion}
                                                                    <span className="bento-dist-subregion-total">{sub.total.toLocaleString()} {language === 'tr' ? 'kasa' : 'crates'}</span>
                                                                </div>
                                                                <div className="bento-dist-depots">
                                                                    {sub.depots.map(dep => (
                                                                        <div key={dep.depotName} className="bento-dist-depot">
                                                                            <span className="bento-dist-depot-name">{dep.depotName}</span>
                                                                            <span className="bento-dist-depot-count">{dep.count}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
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
