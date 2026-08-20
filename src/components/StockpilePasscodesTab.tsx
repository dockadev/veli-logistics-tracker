import React, { useState, useMemo } from 'react';
import { Key, Search, Copy, Check, Eye, EyeOff, MapPin, Warehouse } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot, UserRole, RegionSettings } from '../types';
import { resolveTemplateSetting } from '../utils/helpers';

interface StockpilePasscodesTabProps {
    depots: Record<string, Depot>;
    userRole?: UserRole;
    regionSettings?: RegionSettings;
    onEditDepotSettings?: (depotKey: string) => void;
    onDeleteDepot?: (depotKey: string) => void;
}

interface ParsedDepotItem {
    key: string;
    depot: Depot;
    region: string;
    town: string;
    displayName: string;
    code: string;
    type: string;
}

export const StockpilePasscodesTab: React.FC<StockpilePasscodesTabProps> = ({
    depots,
    regionSettings = {}
}) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (depotKey: string, code: string) => {
        try {
            navigator.clipboard.writeText(code);
        } catch (err) {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (fallbackErr) {
                console.error('Fallback copy failed: ', fallbackErr);
            }
        }
        setCopiedKey(depotKey);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const toggleReveal = (depotKey: string) => {
        setRevealedCodes(prev => {
            const next = { ...prev, [depotKey]: !prev[depotKey] };
            if (next[depotKey]) {
                // Auto-hide revealed code after 15s
                setTimeout(() => {
                    setRevealedCodes(prevNow => {
                        if (prevNow[depotKey]) {
                            const updated = { ...prevNow };
                            delete updated[depotKey];
                            return updated;
                        }
                        return prevNow;
                    });
                }, 15000);
            }
            return next;
        });
    };

    // Helper to reliably parse region, town, and display name
    const parseDepotInfo = (depot: Depot): { region: string; town: string; displayName: string; type: string } => {
        const parts = depot.name.split(' - ').map(s => s.trim()).filter(Boolean);
        const rawRegion = parts[0] || t('unknown_region');
        const region = (rawRegion === 'The Blemish' || rawRegion === 'The Blemsh') ? 'Blemish' : rawRegion;

        let town = (depot.subregion && depot.subregion.trim()) || (depot.townName && depot.townName.trim()) || '';
        if (town) {
            const trimmed = town.trim();
            if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") town = "Light's End";
            else if (trimmed === 'Loftmire' || trimmed === 'The Blemish' || trimmed === 'The Blemsh') town = 'Blemish';
            else if (trimmed === 'Rising Loom') town = 'Therizo';
        }
        if (!town || town === 'Storage Depot' || town === 'Seaport') {
            town = 'Unassigned Subregion';
        }

        const type = parts.length > 2 ? parts[2] : (parts[1] || 'Depot');
        const displayName = depot.customName || parts[parts.length - 1] || depot.name;

        return { region, town, displayName, type };
    };

    // Extract all unique regions for filter buttons
    const availableRegions = useMemo(() => {
        const set = new Set<string>();
        Object.values(depots).forEach(d => {
            const info = parseDepotInfo(d);
            if (info.region) set.add(info.region);
        });
        return Array.from(set).sort();
    }, [depots, t]);

    // Filter and group depots: Region -> Town -> Depots
    const groupedData = useMemo(() => {
        const filteredEntries = Object.entries(depots).filter(([, depot]) => {
            const info = parseDepotInfo(depot);
            const customName = depot.customName || '';

            if (selectedRegion !== 'all' && info.region !== selectedRegion) {
                return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesName = depot.name.toLowerCase().includes(q);
                const matchesCustom = customName.toLowerCase().includes(q);
                const matchesTown = info.town.toLowerCase().includes(q);
                const matchesRegion = info.region.toLowerCase().includes(q);
                return matchesName || matchesCustom || matchesTown || matchesRegion;
            }

            return true;
        });

        const regions: Record<string, Record<string, ParsedDepotItem[]>> = {};

        filteredEntries.forEach(([depotKey, depot]) => {
            const info = parseDepotInfo(depot);
            const code = depot.accessCode || '000000';

            if (!regions[info.region]) regions[info.region] = {};
            if (!regions[info.region][info.town]) regions[info.region][info.town] = [];

            regions[info.region][info.town].push({
                key: depotKey,
                depot,
                region: info.region,
                town: info.town,
                displayName: info.displayName,
                code,
                type: info.type
            });
        });

        return regions;
    }, [depots, selectedRegion, searchQuery, t]);

    const getTemplateColor = (tType: string) => {
        try {
            const saved = localStorage.getItem('foxhole_template_colors');
            if (saved) {
                const map = JSON.parse(saved);
                if (map[tType]) return map[tType];
            }
        } catch (e) {}
        if (tType === 'frontline') return '#ef4444';
        if (tType === 'backline') return '#ffffff';
        if (tType === 'airfield') return '#06b6d4';
        return '#10b981';
    };

    return (
        <div id="tabContentPasscodes" className="tab-content-panel anim-fade-in passcodes-tab">
            {/* Single unified card: search + region filter + Region -> Subregion -> Depots */}
            {Object.keys(groupedData).length === 0 && !searchQuery ? (
                <div className="passcodes-empty">
                    <Key size={32} />
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>
                        {t('no_passcodes_found')}
                    </p>
                </div>
            ) : (
                <div className="table-container passcodes-unified">
                    <div className="table-actions" style={{ gap: '0.6rem' }}>
                        {/* Title */}
                        <div className="passcodes-card-title">
                            <h3>{t('depot_passcodes_title')}</h3>
                            <span className="passcodes-card-count">
                                {Object.values(groupedData).reduce((sum, towns) => sum + Object.values(towns).reduce((s, items) => s + items.length, 0), 0)}
                            </span>
                        </div>

                        {/* Search */}
                        <div className="passcodes-search">
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('search_passcodes_placeholder')}
                                style={{ paddingLeft: '2.25rem' }}
                            />
                        </div>

                        {/* Region filter chips */}
                        {availableRegions.length > 0 && (
                            <div className="passcodes-chips">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRegion('all')}
                                    className={`depot-chip ${selectedRegion === 'all' ? 'selected' : ''}`}
                                >
                                    {t('all_regions')}
                                </button>
                                {availableRegions.map(reg => {
                                    const isSel = selectedRegion === reg;
                                    return (
                                        <button
                                            key={reg}
                                            type="button"
                                            onClick={() => setSelectedRegion(reg)}
                                            className={`depot-chip ${isSel ? 'selected' : ''}`}
                                        >
                                            {reg}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="passcodes-unified-body">
                        {Object.keys(groupedData).length === 0 ? (
                            <div className="passcodes-empty" style={{ border: 'none', background: 'transparent' }}>
                                <Key size={28} />
                                <p style={{ fontSize: '0.8rem', margin: 0 }}>
                                    {t('no_passcodes_found')}
                                </p>
                            </div>
                        ) : (
                            Object.entries(groupedData).map(([region, towns], regionIdx) => {
                                const regionTotal = Object.values(towns).reduce((sum, items) => sum + items.length, 0);
                                return (
                                    <React.Fragment key={region}>
                                        {regionIdx > 0 && <div className="passcodes-separator" />}
                                        <div className="passcodes-region-card anim-row-in" style={{ animationDelay: `${regionIdx * 50}ms` }}>
                                            <div className="passcodes-u-region-name">
                                                {region}
                                                <span className="passcodes-u-count">{regionTotal}</span>
                                            </div>
                                            {Object.entries(towns).map(([town, items], townIdx) => {
                                                const sortedItems = items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' }));

                                                return (
                                                    <div key={town} className="passcodes-town-card anim-row-in" style={{ animationDelay: `${regionIdx * 50 + (townIdx + 1) * 30}ms` }}>
                                                        <div className="passcodes-u-town-name">
                                                            <MapPin size={11} />
                                                            <span>{town}</span>
                                                            {(() => {
                                                                if (!town || town === 'Unassigned Subregion') return null;
                                                                const subSetting = resolveTemplateSetting(region, town, town, regionSettings);
                                                                const type = subSetting.templateType;
                                                                if (!type || type === 'unassigned') return null;
                                                                const label = type === 'airfield' ? 'Airfield' : type.toUpperCase();
                                                                const color = getTemplateColor(type);
                                                                return (
                                                                    <span style={{
                                                                        fontSize: '0.5rem',
                                                                        fontWeight: 800,
                                                                        padding: '0.08rem 0.3rem',
                                                                        borderRadius: '3px',
                                                                        background: `${color}20`,
                                                                        color: color,
                                                                        border: `1px solid ${color}50`,
                                                                        textTransform: 'uppercase',
                                                                        marginLeft: '0.25rem'
                                                                    }}>
                                                                        {label}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span className="passcodes-town-count">{sortedItems.length}</span>
                                                        </div>
                                                        <div className="passcodes-u-depots">
                                                            {sortedItems.map((item, depIdx) => {
                                                                const isRevealed = !!revealedCodes[item.key];
                                                                const isCopied = copiedKey === item.key;

                                                                return (
                                                                    <div key={item.key} className="passcodes-u-depot anim-row-in" style={{ animationDelay: `${regionIdx * 50 + (townIdx + 1) * 30 + (depIdx + 1) * 20}ms` }}>
                                                                        <div className="passcodes-u-depot-name">
                                                                            <Warehouse size={12} />
                                                                            <span>{item.displayName}</span>
                                                                        </div>
                                                                        <div className="passcodes-depot-actions">
                                                                            <div
                                                                                className={`passcodes-code-box ${isRevealed ? 'revealed' : ''} ${isCopied ? 'copied' : ''}`}
                                                                                title={isCopied ? 'Copied!' : 'Click to copy'}
                                                                                onClick={() => handleCopy(item.key, item.code)}
                                                                            >
                                                                                <Key size={11} />
                                                                                <span>{isRevealed ? item.code : '••••••'}</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleReveal(item.key)}
                                                                                className={`passcodes-action-btn ${isRevealed ? 'revealed' : ''}`}
                                                                                title={isRevealed ? 'Hide code' : 'Show code'}
                                                                            >
                                                                                {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCopy(item.key, item.code)}
                                                                                className={`passcodes-action-btn ${isCopied ? 'copied' : ''}`}
                                                                                title="Copy code"
                                                                            >
                                                                                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockpilePasscodesTab;
