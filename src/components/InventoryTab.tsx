import React from 'react';
import { Search, Package } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { Depot, FilterState, ItemInfo } from '../types';
import { getPaginationRange } from '../utils/helpers';

interface InventoryTabProps {
    depots: Record<string, Depot>;
    activeDepotName: string | null;
}

export const InventoryTab: React.FC<InventoryTabProps> = React.memo(({ depots, activeDepotName }) => {
    const { t } = useLanguage();
    const [selectedDepotName, setSelectedDepotName] = React.useState<string>('all');

    const [filters, setFilters] = React.useState<FilterState>({
        search: '',
        category: 'all',
        change: 'all'
    });

    const [searchInput, setSearchInput] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 15;

    // Keep selectedDepotName in sync when activeDepotName changes from outside
    React.useEffect(() => {
        if (activeDepotName && depots[activeDepotName]) {
            setSelectedDepotName(activeDepotName);
        } else if (activeDepotName === 'all') {
            setSelectedDepotName('all');
        } else {
            setSelectedDepotName('all');
        }
    }, [activeDepotName, depots]);

    // Reset filters and local search query when changing selected depot
    React.useEffect(() => {
        setSearchInput('');
        setDebouncedSearch('');
        setCurrentPage(1);
        setFilters({
            search: '',
            category: 'all',
            change: 'all'
        });
    }, [selectedDepotName]);

    // Reset current page when search query or filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, filters.category, filters.change]);

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



    // Aggregation of all depots
    const aggregatedDepot = React.useMemo<Depot>(() => {
        const mergedCurrent: Record<string, ItemInfo> = {};
        const mergedPrevious: Record<string, ItemInfo> = {};

        Object.values(depots).forEach(dep => {
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
            customName: t('all_depots') || 'Tüm Depolar',
            current: mergedCurrent,
            previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null,
            lastUpdated: new Date().toISOString()
        };
    }, [depots, t]);

    const depot = React.useMemo(() => {
        if (selectedDepotName === 'all') {
            return aggregatedDepot;
        }
        return depots[selectedDepotName] || { name: '', customName: '', current: {}, previous: null, lastUpdated: '' };
    }, [selectedDepotName, depots, aggregatedDepot]);

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
            const category = (depot.current && depot.current[name]?.category) ?? (depot.previous && depot.previous[name]?.category) ?? 'item';

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
                category,
                prevVal,
                currVal,
                diff,
                changeType
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
    }, [depot]);

    // Apply filtering (cached)
    const filteredItems = React.useMemo(() => {
        const query = debouncedSearch.trim().toLowerCase();
        return itemsList.filter(item => {
            // Search filter
            if (query && !item.name.toLowerCase().includes(query)) {
                return false;
            }

            // Category filter
            if (filters.category === 'crate') {
                if (!item.name.includes('(Crate)') && item.category !== 'crate') {
                    return false;
                }
            } else if (filters.category === 'item') {
                if (item.name.includes('(Crate)') || item.category === 'crate') {
                    return false;
                }
            } else if (filters.category !== 'all' && item.category !== filters.category) {
                return false;
            }

            // Change filter
            if (filters.change !== 'all' && item.changeType !== filters.change) {
                return false;
            }

            return true;
        });
    }, [itemsList, debouncedSearch, filters.category, filters.change]);

    const paginatedItems = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredItems.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredItems, currentPage]);

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
                                    { value: 'crate', label: t('crates_only') },
                                    { value: 'item', label: t('individual_only') },
                                    { value: 'vehicle', label: t('vehicles') },
                                    { value: 'crate_vehicle', label: t('crate_vehicles') },
                                    { value: 'structure', label: t('structures') }
                                ]}
                                value={filters.category}
                                onChange={(val) => setFilters(prev => ({ ...prev, category: val as any }))}
                                placeholder={t('category')}
                            />
                        </div>
                        {filters.category !== 'all' && (
                            <div className="anim-fade-in" style={{ width: '160px' }}>
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
                        )}
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('item_name')}</th>
                                <th>{t('category')}</th>
                                <th className="text-right">{t('previous_qty')}</th>
                                <th className="text-right">{t('current_qty')}</th>
                                <th className="text-right">{t('difference')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="empty-row">
                                        <p>{t('no_items_match')}</p>
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

                                     return (
                                         <tr key={item.name}>
                                             <td className={changeClass}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                     {isCrate && <Package size={12} style={{ color: 'var(--accent-color)', opacity: 0.8, flexShrink: 0 }} />}
                                                     <span style={{ wordBreak: 'break-word' }}>{displayName}</span>
                                                 </div>
                                             </td>
                                             <td>
                                                 <span className={`badge-category badge-${item.category.replace('_', '-')}`}>{t(`cat_${item.category}` as TranslationKey)}</span>
                                             </td>
                                             <td className="text-right">{item.prevVal ?? '-'}</td>
                                             <td className="text-right">{item.currVal}</td>
                                             <td className="text-right">{diffElement}</td>
                                         </tr>
                                     );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                {filteredItems.length > 0 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            {t('showing')} {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)} {t('to')} {Math.min(filteredItems.length, currentPage * itemsPerPage)} {t('of')} {filteredItems.length} {t('entries')}
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
