import React, { useState, useEffect, useMemo } from 'react';
import { Search, Eye } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { Depot } from '../types';
import { getPaginationRange } from '../utils/helpers';

interface CrossSearchTabProps {
    depots: Record<string, Depot>;
}

interface GroupedResult {
    name: string;
    category: string;
    totalCount: number;
    depots: Array<{
        depotName: string;
        count: number;
    }>;
}

export const CrossSearchTab: React.FC<CrossSearchTabProps> = React.memo(({ depots }) => {
    const { t, language } = useLanguage();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 12; // Grid layout fits 12 cards beautifully per page

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 150);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    const results = useMemo(() => {
        const query = debouncedSearch.trim().toLowerCase();
        if (query.length === 0) return [];

        const groups: Record<string, GroupedResult> = {};

        Object.entries(depots).forEach(([depotName, depot]) => {
            const displayName = depot.customName || depotName;
            Object.entries(depot.current).forEach(([itemName, itemInfo]) => {
                if (itemInfo.count > 0 && itemName.toLowerCase().includes(query)) {
                    if (!groups[itemName]) {
                        groups[itemName] = {
                            name: itemName,
                            category: itemInfo.category,
                            totalCount: 0,
                            depots: []
                        };
                    }
                    groups[itemName].totalCount += itemInfo.count;
                    groups[itemName].depots.push({
                        depotName: displayName,
                        count: itemInfo.count
                    });
                }
            });
        });

        // Sort depots in each group by quantity descending
        Object.values(groups).forEach(group => {
            group.depots.sort((a, b) => b.count - a.count);
        });

        // Return array sorted by totalCount descending
        return Object.values(groups).sort((a, b) => b.totalCount - a.totalCount);
    }, [depots, debouncedSearch]);

    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return results.slice(startIndex, startIndex + itemsPerPage);
    }, [results, currentPage]);

    return (
        <div id="tabContentCrossSearch" className="tab-content-panel">
            <div className="table-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Search Header */}
                <div className="table-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                            <h2 className="panel-title-primary" style={{ margin: 0, fontSize: '1.1rem' }}>{t('global_search')}</h2>
                            <p className="help-text" style={{ margin: '0.2rem 0 0 0' }}>{t('global_search_desc')}</p>
                        </div>
                    </div>

                    {/* Futuristic Search input bar */}
                    <div className="search-bar" style={{ maxWidth: '100%', width: '100%', height: '44px' }}>
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder={t('search_item_name')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ fontSize: '0.9rem' }}
                        />
                    </div>
                </div>

                {/* Search Results Display Area with safety margins to prevent left-clipping */}
                <div className="search-results-area" style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {results.length === 0 ? (
                        <div className="search-empty-state" style={{ margin: 0 }}>
                            <Search size={40} className="search-empty-icon" />
                             <div className="search-empty-title">
                                {search.trim().length > 0 ? t('no_matching_supplies') : t('search_across_all_depots')}
                            </div>
                            <div className="search-empty-text">
                                {search.trim().length > 0 
                                    ? (language === 'tr' ? 'Arama kriterleriniz ile eşleşen bir malzeme bulunamadı.' : 'No materials found matching your search string.')
                                    : (language === 'tr' ? 'Kayıtlı tüm seaports ve storage depots envanterlerini aynı anda sorgulamak için bir malzeme ismi yazın.' : 'Enter a material name to query all tracked seaport and storage depot inventories simultaneously.')}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Futuristic Card Grid */}
                            <div className="search-grid" style={{ margin: 0 }}>
                                {paginatedResults.map((res) => {
                                    const catClass = `badge-${res.category.replace('_', '-')}`;
                                    const badgeClass = `badge-category ${catClass}`;
                                    
                                    return (
                                        <div key={res.name} className="search-card">
                                            
                                            {/* Card Header */}
                                            <div className="search-card-header">
                                                <div className="search-card-title">{res.name}</div>
                                                <span className={badgeClass} style={{ flexShrink: 0 }}>
                                                    {t(`cat_${res.category}` as TranslationKey)}
                                                </span>
                                            </div>

                                            {/* Quantity Display */}
                                            <div className="search-card-qty-area">
                                                <span className="search-card-qty">{res.totalCount.toLocaleString()}</span>
                                                <span className="search-card-qty-label">{t('quantity')}</span>
                                            </div>

                                            {/* Depot Distribution list with progress bars */}
                                            <div className="search-card-depots">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
                                                    <Eye size={10} />
                                                    <span>{t('matches_found_in')} {res.depots.length} {t('depots_label')}</span>
                                                </div>
                                                {res.depots.map((dep, dIdx) => {
                                                    const percentage = res.totalCount > 0 ? (dep.count / res.totalCount) * 100 : 0;
                                                    return (
                                                        <div key={dIdx} className="search-card-depot-row">
                                                            <div className="search-card-depot-row-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600 }}>
                                                                <span className="search-card-depot-name" style={{ color: 'var(--text-secondary)' }}>{dep.depotName}</span>
                                                                <span className="search-card-depot-qty" style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{dep.count.toLocaleString()}</span>
                                                            </div>
                                                            <div className="search-card-progress-bar">
                                                                <div 
                                                                    className="search-card-progress-fill" 
                                                                    style={{ width: `${percentage}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination Footer */}
                            {results.length > itemsPerPage && (
                                <div className="pagination-container" style={{ margin: 0 }}>
                                    <div className="pagination-info">
                                        {t('showing')} {Math.min(results.length, (currentPage - 1) * itemsPerPage + 1)} {t('to')} {Math.min(results.length, currentPage * itemsPerPage)} {t('of')} {results.length} {t('entries')}
                                    </div>
                                    <div className="pagination-controls">
                                        <button
                                            className="pagination-btn"
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            {t('previous')}
                                        </button>
                                        {getPaginationRange(currentPage, Math.ceil(results.length / itemsPerPage)).map((page, idx) => {
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
                                                    onClick={() => setCurrentPage(page as number)}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                        <button
                                            className="pagination-btn"
                                            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(results.length / itemsPerPage), prev + 1))}
                                            disabled={currentPage === Math.ceil(results.length / itemsPerPage)}
                                        >
                                            {t('next')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

CrossSearchTab.displayName = 'CrossSearchTab';
