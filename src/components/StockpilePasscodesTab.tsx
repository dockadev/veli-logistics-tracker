import React, { useState, useMemo, useEffect } from 'react';
import { Shield, Key, Search, Copy, Check, Eye, EyeOff, MapPin, Warehouse, Compass, Info } from 'lucide-react';
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
    const [showPasscodesInfo, setShowPasscodesInfo] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowPasscodesInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const toggleReveal = (depotKey: string) => {
        setRevealedCodes(prev => ({ ...prev, [depotKey]: !prev[depotKey] }));
    };

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

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const total = Object.keys(depots).length;
        let publicCount = 0;
        let privateCount = 0;
        const regionsSet = new Set<string>();

        Object.values(depots).forEach(d => {
            const info = parseDepotInfo(d);
            if (info.region) regionsSet.add(info.region);
            if (d.isCodePublic) publicCount++; else privateCount++;
        });

        return {
            total,
            publicCount,
            privateCount,
            regionCount: regionsSet.size
        };
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

    return (
        <div id="tabContentPasscodes" className="tab-content-panel anim-fade-in" style={{ padding: '0 0.5rem 2rem' }}>
            {/* Header / Hero Banner */}
            <div className="panel-card" style={{ 
                marginBottom: '1.5rem', 
                background: 'rgba(18, 26, 18, 0.6)', 
                border: '1px solid var(--border-color)',
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '12px', 
                            background: 'rgba(16, 185, 129, 0.12)', 
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#10B981'
                        }}>
                            <Shield size={24} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                    {t('depot_passcodes_title')}
                                </h2>
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="popover-trigger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPasscodesInfo(!showPasscodesInfo);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: showPasscodesInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.15s'
                                        }}
                                    >
                                        <Info size={14} />
                                    </button>
                                    {showPasscodesInfo && (
                                        <div className="popover-card" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            zIndex: 99999,
                                            width: '320px',
                                            background: 'rgba(20, 28, 20, 0.96)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '0.85rem',
                                            marginTop: '0.35rem',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: '1.45',
                                            boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                            fontWeight: 'normal',
                                            letterSpacing: 'normal',
                                            textAlign: 'left'
                                        }}>
                                            <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                                {t('info_passcodes_title')}
                                            </strong>
                                            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <li>{t('info_passcodes_bullet1')}</li>
                                                <li>{t('info_passcodes_bullet2')}</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: '1.4' }}>
                                {t('depot_passcodes_desc')}
                            </p>
                        </div>
                    </div>

                    {/* Stats Counter Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', minWidth: '100px' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('total_depots')}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-heading)' }}>{stats.total}</div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', minWidth: '100px' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('regions_stat')}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{stats.regionCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Header: Search & Region Filter Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search_passcodes_placeholder')}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.85rem 0.6rem 2.25rem',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Region Filter Chips */}
                {availableRegions.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setSelectedRegion('all')}
                            style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                border: '1px solid ' + (selectedRegion === 'all' ? 'var(--accent-color)' : 'var(--border-color)'),
                                background: selectedRegion === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                color: selectedRegion === 'all' ? '#10B981' : 'var(--text-secondary)'
                            }}
                        >
                            {t('all_regions')} ({stats.regionCount})
                        </button>

                        {availableRegions.map(reg => {
                            const isSel = selectedRegion === reg;
                            return (
                                <button
                                    key={reg}
                                    type="button"
                                    onClick={() => setSelectedRegion(reg)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '20px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        border: '1px solid ' + (isSel ? 'var(--accent-color)' : 'var(--border-color)'),
                                        background: isSel ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)',
                                        color: isSel ? '#10B981' : 'var(--text-secondary)'
                                    }}
                                >
                                    {reg}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Hierarchical Passcodes Display: Discord Webhook Style Multi-Column Grid */}
            {Object.keys(groupedData).length === 0 ? (
                <div className="panel-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-secondary)' }}>
                    <Shield size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>
                        {t('no_passcodes_found')}
                    </p>
                </div>
            ) : (
                /* Multi-Column Grid of Region Cards separated by DISTINCT WHITE BORDER (up to 3 per row on wide screens) */
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
                    gap: '1.25rem',
                    alignItems: 'flex-start'
                }}>
                    {Object.entries(groupedData).map(([region, towns]) => (
                        /* Distinct Region Card with Crisp WHITE BORDER */
                        <div 
                            key={region} 
                            style={{ 
                                padding: '1rem 1.15rem', 
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                borderRadius: '8px',
                                background: 'rgba(18, 26, 18, 0.8)',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}
                        >
                            {/* Region Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                <Compass size={18} style={{ color: 'var(--accent-color)' }} />
                                <h3 style={{ fontSize: '1.05rem', margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontWeight: 800 }}>
                                    {region}
                                </h3>
                            </div>

                            {/* Subregion Groups: Discord Style Vertical Stack Under Subregion Header */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {Object.entries(towns).map(([town, items]) => {
                                    const sortedItems = items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' }));

                                    return (
                                        <div key={town} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {/* Subregion / Town Subheader */}
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '0.4rem', 
                                                fontSize: '0.82rem', 
                                                fontWeight: 700, 
                                                color: '#10B981',
                                                background: 'rgba(0, 0, 0, 0.25)',
                                                padding: '0.35rem 0.6rem',
                                                borderRadius: '5px',
                                                borderLeft: '3px solid #10B981'
                                            }}>
                                                <MapPin size={13} />
                                                <span>{town}</span>
                                                {(() => {
                                                    if (!town || town === 'Unassigned Subregion') return null;
                                                    const subSetting = resolveTemplateSetting(region, town, town, regionSettings);
                                                    const type = subSetting.templateType;
                                                    if (!type || type === 'unassigned') return null;
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
                                                        if (tType === 'aircraft') return '#06b6d4';
                                                        return '#10b981';
                                                    };
                                                    const color = getTemplateColor(type);
                                                    const label = type === 'aircraft' ? 'Aircraft' : type.toUpperCase();
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 800,
                                                            padding: '0.12rem 0.4rem',
                                                            borderRadius: '4px',
                                                            background: `${color}20`,
                                                            color: color,
                                                            border: `1px solid ${color}50`,
                                                            textTransform: 'uppercase',
                                                            marginLeft: '0.3rem'
                                                        }}>
                                                            {label}
                                                        </span>
                                                    );
                                                })()}
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                                                    ({items.length})
                                                </span>
                                            </div>

                                            {/* Vertical Stack of Depots */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: '0.25rem' }}>
                                                {sortedItems.map(item => {
                                                    const isRevealed = !!revealedCodes[item.key];
                                                    const isCopied = copiedKey === item.key;

                                                    return (
                                                        <div
                                                            key={item.key}
                                                            style={{
                                                                background: 'rgba(0, 0, 0, 0.35)',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '5px',
                                                                padding: '0.45rem 0.75rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '0.75rem'
                                                            }}
                                                        >
                                                            {/* Depot Tag / Display Name (No Text Truncation) */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                                                                <Warehouse size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                                                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                                    {item.displayName}
                                                                </span>
                                                            </div>

                                                            {/* Actions & Passcode Box: Eye Toggle + Passcode + Copy */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                                                {/* Passcode Display Box */}
                                                                <div style={{ 
                                                                    padding: '0.25rem 0.55rem',
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 800,
                                                                    letterSpacing: '0.1em',
                                                                    userSelect: 'none',
                                                                    background: isCopied ? 'rgba(34, 197, 94, 0.18)' : (isRevealed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.3)'),
                                                                    color: isCopied ? '#22c55e' : (isRevealed ? '#10B981' : 'var(--text-muted)'),
                                                                    border: '1px solid ' + (isCopied ? 'rgba(34, 197, 94, 0.4)' : (isRevealed ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)')),
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem'
                                                                }}>
                                                                    <Key size={12} />
                                                                    <span>{isRevealed ? item.code : '••••••'}</span>
                                                                </div>

                                                                {/* Eye Reveal Toggle Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleReveal(item.key)}
                                                                    style={{
                                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: '4px',
                                                                        padding: '0.25rem 0.4rem',
                                                                        color: isRevealed ? '#10B981' : 'var(--text-secondary)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                                                                </button>

                                                                {/* Copy Button (turns to Check tick icon on click) */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(item.key, item.code)}
                                                                    style={{
                                                                        background: isCopied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                                        border: '1px solid ' + (isCopied ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-color)'),
                                                                        borderRadius: '4px',
                                                                        padding: '0.25rem 0.4rem',
                                                                        color: isCopied ? '#22c55e' : 'var(--text-secondary)',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}
                                                                >
                                                                    {isCopied ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StockpilePasscodesTab;
