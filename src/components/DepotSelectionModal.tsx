import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Map, FolderOpen, ArrowRight, Search } from 'lucide-react';
import type { Depot } from '../types';
import { FOXHOLE_REGIONS, getRelativeTimeString } from '../utils/helpers';
import { useLanguage, type Language } from '../context/LanguageContext';

interface DepotSelectionModalProps {
    isOpen: boolean;
    depots: Record<string, Depot>;
    activeDepotName: string | null;
    onSelect: (name: string) => void;
    onClose: () => void;
}

interface RegionItemProps {
    region: string;
    count: number;
    isHovered: boolean;
    onMouseEnter: (region: string) => void;
    onMouseLeave: () => void;
}

const RegionItem: React.FC<RegionItemProps> = React.memo(({
    region,
    count,
    isHovered,
    onMouseEnter,
    onMouseLeave,
}) => {
    return (
        <div
            onMouseEnter={() => onMouseEnter(region)}
            onMouseLeave={onMouseLeave}
            className={`region-item-btn ${count > 0 ? 'has-depots' : ''} ${isHovered ? 'active' : ''}`}
        >
            <span>{region}</span>
            <div className="modal-region-badge-wrapper">
                {count > 0 && (
                    <span className="region-badge-count">
                        {count}
                    </span>
                )}
                <span className={`modal-region-arrow ${isHovered ? 'visible' : ''}`}>
                    <ArrowRight size={12} />
                </span>
            </div>
        </div>
    );
});

RegionItem.displayName = 'RegionItem';

interface DepotItemProps {
    depot: Depot;
    isActive: boolean;
    showRegionInMeta: boolean;
    language: Language;
    onSelect: (name: string) => void;
}

const DepotItem: React.FC<DepotItemProps> = React.memo(({
    depot,
    isActive,
    showRegionInMeta,
    language,
    onSelect,
}) => {
    return (
        <div
            onClick={() => onSelect(depot.name)}
            className={`depot-modal-item ${isActive ? 'active' : ''}`}
        >
            <div className="depot-modal-item-title">
                {depot.customName || depot.name}
            </div>
            <div className="depot-modal-item-meta">
                {showRegionInMeta ? (
                    <span className="depot-modal-item-region">
                        {depot.name.split(' - ')[0]}
                    </span>
                ) : (
                    <span title={depot.lastUpdated}>
                        {language === 'tr' ? 'Tarama Zamanı' : 'Scan Time'}: {getRelativeTimeString(depot.lastUpdated, language)}
                    </span>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isActive === nextProps.isActive &&
        prevProps.showRegionInMeta === nextProps.showRegionInMeta &&
        prevProps.language === nextProps.language &&
        prevProps.depot.name === nextProps.depot.name &&
        prevProps.depot.customName === nextProps.depot.customName &&
        prevProps.depot.lastUpdated === nextProps.depot.lastUpdated
    );
});

DepotItem.displayName = 'DepotItem';

export const DepotSelectionModal: React.FC<DepotSelectionModalProps> = React.memo(({
    isOpen,
    depots,
    activeDepotName,
    onSelect,
    onClose,
}) => {
    const { language } = useLanguage();
    const [hoveredRegion, setHoveredRegion] = useState<string>(FOXHOLE_REGIONS[0]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Timeout ref for debouncing region hover updates to eliminate rapid re-render lag
    const hoverTimeoutRef = useRef<number | null>(null);
    const depotsContainerRef = useRef<HTMLDivElement>(null);

    // Scroll back to top when switching regions or searching
    useEffect(() => {
        if (depotsContainerRef.current) {
            depotsContainerRef.current.scrollTop = 0;
        }
    }, [hoveredRegion, searchQuery]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Reset state when opening/closing
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Clean up hover timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) {
                window.clearTimeout(hoverTimeoutRef.current);
            }
        };
    }, []);

    // Pre-group depots by region for O(1) rendering lookup to prevent lag
    const depotsByRegion = useMemo(() => {
        const grouped: Record<string, Depot[]> = {};
        FOXHOLE_REGIONS.forEach(region => {
            grouped[region.toLowerCase()] = [];
        });
        Object.values(depots).forEach(depot => {
            const parts = depot.name.split(' - ');
            if (parts.length > 0) {
                const prefix = parts[0].trim().toLowerCase();
                if (!grouped[prefix]) {
                    grouped[prefix] = [];
                }
                grouped[prefix].push(depot);
            }
        });
        return grouped;
    }, [depots]);

    // Global search lookup across all depots (memoized)
    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return null;
        return Object.values(depots).filter(depot => {
            const mainName = depot.name.toLowerCase();
            const customName = (depot.customName || '').toLowerCase();
            return mainName.includes(query) || customName.includes(query);
        });
    }, [depots, searchQuery]);

    // Debounced region hover event handler (prevents accidental triggers during fast mouse movements)
    const handleRegionMouseEnter = useCallback((region: string) => {
        if (hoverTimeoutRef.current) {
            window.clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = window.setTimeout(() => {
            setHoveredRegion(region);
        }, 50); // 50ms buffer to register intentional hover
    }, []);

    const handleRegionMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) {
            window.clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
    }, []);

    if (!isOpen) return null;

    const activeDepotsInHovered = depotsByRegion[hoveredRegion.toLowerCase()] || [];
    const isSearching = searchQuery.trim().length > 0;

    return (
        <>
            {/* Sibling static blurred backdrop overlay */}
            <div className="modal-backdrop-blur" onClick={onClose} />
            
            {/* Floating content wrapper */}
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container modal-container-xl" 
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <div className="modal-header-layout">
                            <Map size={20} className="modal-map-icon" />
                            <h3 className="modal-title-text">Tactical Depot Browser</h3>
                        </div>
                        <button className="modal-close" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Sub-header Search Bar */}
                    <div className="modal-search-container">
                        <div className="search-bar">
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search depots globally by name or region..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="modal-search-input"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="modal-search-clear-btn"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="modal-body-layout">
                        {/* Left Column: Regions */}
                        <div 
                            className="modal-regions-column"
                            style={{
                                opacity: isSearching ? 0.35 : 1,
                                pointerEvents: isSearching ? 'none' : 'auto'
                            }}
                        >
                            <div className="modal-regions-title">
                                Logistics Zones
                            </div>
                            <div className="modal-regions-list">
                                {FOXHOLE_REGIONS.map(region => {
                                    const count = depotsByRegion[region.toLowerCase()]?.length || 0;
                                    const isHovered = hoveredRegion === region;
                                    return (
                                        <RegionItem
                                            key={region}
                                            region={region}
                                            count={count}
                                            isHovered={isHovered}
                                            onMouseEnter={handleRegionMouseEnter}
                                            onMouseLeave={handleRegionMouseLeave}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Depots List */}
                        <div 
                            ref={depotsContainerRef}
                            className={`modal-depots-column ${isSearching ? 'expanded' : ''}`}
                        >
                            <div className="modal-depots-title">
                                {searchResults !== null 
                                    ? `Search Results (${searchResults.length} matching)` 
                                    : `Depots in ${hoveredRegion} (${activeDepotsInHovered.length})`}
                            </div>

                            {/* Search Results List */}
                            <div className={`depot-search-group ${isSearching ? 'visible' : ''}`}>
                                {searchResults !== null && searchResults.length === 0 ? (
                                    <div className="modal-empty-state">
                                        <FolderOpen size={28} style={{ opacity: 0.3 }} />
                                        <span>No depots match this query.</span>
                                    </div>
                                ) : (
                                    searchResults?.map(depot => (
                                        <DepotItem
                                            key={depot.name}
                                            depot={depot}
                                            isActive={activeDepotName === depot.name}
                                            showRegionInMeta={true}
                                            language={language}
                                            onSelect={onSelect}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Render only active region depots */}
                            {!isSearching && (
                                <div className="depot-region-group visible">
                                    {activeDepotsInHovered.length === 0 ? (
                                        <div className="modal-empty-state">
                                            <FolderOpen size={28} style={{ opacity: 0.3 }} />
                                            <span>No depots in this region.</span>
                                        </div>
                                    ) : (
                                        activeDepotsInHovered.map(depot => (
                                            <DepotItem
                                                key={depot.name}
                                                depot={depot}
                                                isActive={activeDepotName === depot.name}
                                                showRegionInMeta={false}
                                                language={language}
                                                onSelect={onSelect}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

DepotSelectionModal.displayName = 'DepotSelectionModal';


