import React, { useState, useMemo, useEffect } from 'react';
import { Shield, Key, Search, Copy, Check, Eye, EyeOff, MapPin, Warehouse, Compass, Lock, Info } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { Depot, UserRole, RegionSettings } from '../types';

interface StockpilePasscodesTabProps {
    depots: Record<string, Depot>;
    userRole: UserRole;
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
    userRole, 
    regionSettings = {},
    onEditDepotSettings,
    onDeleteDepot
}) => {
    const { t, language } = useLanguage();
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

    const toggleReveal = (e: React.MouseEvent, depotKey: string, canReveal: boolean) => {
        e.stopPropagation();
        if (!canReveal) return;
        setRevealedCodes(prev => ({ ...prev, [depotKey]: !prev[depotKey] }));
    };

    const handleCopy = (depotKey: string, code: string, canReveal: boolean) => {
        if (!canReveal) return;
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
        const region = parts[0] || t('unknown_region');
        
        let town = depot.townName || '';
        if (!town && parts.length >= 3) {
            town = parts[1];
        }
        if (town) {
            const trimmed = town.trim();
            if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") town = "Light's End";
            else if (trimmed === 'Loftmire') town = 'Blemish';
            else if (trimmed === 'Rising Loom') town = 'Therizo';
        }
        if (!town) {
            town = t('general_stockpiles');
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
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '12px', 
                            background: 'rgba(var(--accent-color-rgb), 0.12)', 
                            border: '1px solid rgba(var(--accent-color-rgb), 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-color)'
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
                        <div style={{ background: 'var(--bg-tertiary)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', minWidth: '100px' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('total_depots')}</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-heading)' }}>{stats.total}</div>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', minWidth: '100px' }}>
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
                                background: 'var(--bg-surface)',
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
                                background: selectedRegion === 'all' ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-surface)',
                                color: selectedRegion === 'all' ? 'var(--accent-color)' : 'var(--text-secondary)'
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
                                        background: isSel ? 'rgba(249, 115, 22, 0.15)' : 'var(--bg-surface)',
                                        color: isSel ? 'var(--accent-color)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {reg}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Hierarchical Passcodes Display */}
            {Object.keys(groupedData).length === 0 ? (
                <div className="panel-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-secondary)' }}>
                    <Shield size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>
                        {t('no_passcodes_found')}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    {Object.entries(groupedData).map(([region, towns]) => (
                        /* Distinct Region Outer Dörtgen Card */
                        <div 
                            key={region} 
                            className="panel-card anim-fade-in"
                            style={{ 
                                padding: '1.35rem 1.5rem', 
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--card-bg)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                            }}
                        >
                            {/* Region Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.35rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                <Compass size={20} style={{ color: 'var(--accent-color)' }} />
                                <h2 style={{ fontSize: '1.15rem', margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--accent-color)', fontWeight: 700, letterSpacing: '0.03em' }}>
                                    {region}
                                </h2>
                                {/* Template Assignment Badge */}
                                {(() => {
                                    const setting = regionSettings[region];
                                    const type = setting?.templateType;
                                    
                                    let badgeStyle: React.CSSProperties = {
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '5px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        marginLeft: '0.4rem'
                                    };
                                    
                                    if (type === 'frontline') {
                                        badgeStyle = {
                                            ...badgeStyle,
                                            background: 'rgba(239, 68, 68, 0.12)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.22)'
                                        };
                                    } else if (type === 'backline') {
                                        badgeStyle = {
                                            ...badgeStyle,
                                            background: 'rgba(168, 85, 247, 0.12)',
                                            color: '#a855f7',
                                            border: '1px solid rgba(168, 85, 247, 0.22)'
                                        };
                                    } else {
                                        badgeStyle = {
                                            ...badgeStyle,
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-color)'
                                        };
                                    }
                                    
                                    const label = type 
                                        ? (type === 'frontline' ? 'FRONTLINE' : 'BACKLINE')
                                        : (language === 'tr' ? 'Şablon Belirtilmedi' : 'No Template Assigned');
                                        
                                    return (
                                        <span style={badgeStyle}>
                                            {label}
                                        </span>
                                    );
                                })()}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: 600 }}>
                                    {Object.values(towns).flat().length} {t('total_depots')}
                                </span>
                            </div>

                            {/* Subregion Groups separated by generous spacing (1.5rem gap) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {Object.entries(towns).map(([town, items]) => (
                                    <div key={town} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {/* Subregion / Town Title Header */}
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.4rem', 
                                            fontSize: '0.88rem', 
                                            fontWeight: 700, 
                                            color: 'var(--text-primary)',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            padding: '0.4rem 0.75rem',
                                            borderRadius: '6px',
                                            borderLeft: '3px solid var(--accent-color)'
                                        }}>
                                            <MapPin size={14} style={{ color: 'var(--accent-color)' }} />
                                            <span>{town}</span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.3rem' }}>
                                                ({items.length})
                                            </span>
                                        </div>

                                        {/* Passcode Cards Grid */}
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                                            gap: '0.85rem'
                                        }}>
                                            {items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })).map(item => {
                                                const canReveal = userRole === 'developer' || userRole === 'logistics_lead' || userRole === 'officer' || (userRole === 'member' && !!item.depot.isCodePublic);
                                                const isRevealed = canReveal && !!revealedCodes[item.key];
                                                const isCopied = canReveal && copiedKey === item.key;

                                                return (
                                                    <div
                                                        key={item.key}
                                                        style={{
                                                            background: 'var(--bg-tertiary)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '0.85rem 1rem',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.65rem',
                                                            transition: 'all 0.2s ease-in-out'
                                                        }}
                                                    >
                                                        {/* Top Row: Warehouse Icon + Depot Title + Actions */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <Warehouse size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.3' }}>
                                                                    {item.displayName}
                                                                </span>
                                                            </div>
                                                            {userRole !== 'member' && (
                                                                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onEditDepotSettings?.(item.key);
                                                                        }}
                                                                        style={{
                                                                            fontSize: '0.62rem',
                                                                            padding: '0.2rem 0.45rem',
                                                                            background: 'rgba(255,255,255,0.04)',
                                                                            border: '1px solid var(--border-color)',
                                                                            borderRadius: '4px',
                                                                            color: 'var(--text-secondary)',
                                                                            cursor: 'pointer',
                                                                            fontWeight: 600,
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                                                                    >
                                                                        {language === 'tr' ? 'Şifre Koy' : 'Set Password'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onDeleteDepot?.(item.key);
                                                                        }}
                                                                        style={{
                                                                            fontSize: '0.62rem',
                                                                            padding: '0.2rem 0.45rem',
                                                                            background: 'rgba(239, 68, 68, 0.05)',
                                                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                            borderRadius: '4px',
                                                                            color: '#ef4444',
                                                                            cursor: 'pointer',
                                                                            fontWeight: 600,
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                                                                    >
                                                                        {language === 'tr' ? 'Depoyu Sil' : 'Delete Depot'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Integrated Passcode Box with Copy on Click */}
                                                        <div 
                                                            onClick={() => handleCopy(item.key, item.code, canReveal)}
                                                            style={{ 
                                                                cursor: canReveal ? 'pointer' : 'not-allowed',
                                                                padding: '0.45rem 0.85rem',
                                                                borderRadius: '6px',
                                                                fontFamily: 'monospace',
                                                                fontSize: '0.92rem',
                                                                fontWeight: 800,
                                                                letterSpacing: '0.12em',
                                                                userSelect: 'none',
                                                                background: isCopied ? 'rgba(34, 197, 94, 0.18)' : (isRevealed ? 'rgba(249, 115, 22, 0.1)' : 'var(--bg-surface)'),
                                                                color: isCopied ? '#22c55e' : (isRevealed ? 'var(--accent-color)' : 'var(--text-muted)'),
                                                                border: '1px solid ' + (isCopied ? 'rgba(34, 197, 94, 0.4)' : (isRevealed ? 'rgba(249, 115, 22, 0.35)' : 'var(--border-color)')),
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '0.5rem',
                                                                transition: 'all 0.15s ease-in-out',
                                                                opacity: canReveal ? 1 : 0.65
                                                            }}
                                                            title={canReveal ? (isCopied ? t('copied') : t('copy')) : t('passcode_restricted_member' as TranslationKey)}
                                                        >
                                                            {/* Left: Key Icon + Code */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <Key size={14} style={{ color: isCopied ? '#22c55e' : (isRevealed ? 'var(--accent-color)' : 'var(--text-muted)') }} />
                                                                <span>{isRevealed ? item.code : '••••••'}</span>
                                                            </div>

                                                            {/* Right: Eye Toggle / Lock Icon + Copy Icon */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                                {/* Reveal Eye Toggle / Lock Button */}
                                                                {canReveal ? (
                                                                    <div 
                                                                        onClick={(e) => toggleReveal(e, item.key, canReveal)}
                                                                        style={{ opacity: 0.7, padding: '2px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                                        title={isRevealed ? "Hide Passcode" : "Reveal Passcode"}
                                                                    >
                                                                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                    </div>
                                                                ) : (
                                                                    <div 
                                                                        style={{ opacity: 0.4, padding: '2px', display: 'flex', alignItems: 'center', cursor: 'not-allowed' }}
                                                                        title={t('passcode_restricted_member' as TranslationKey)}
                                                                    >
                                                                        <Lock size={14} />
                                                                    </div>
                                                                )}

                                                                {/* Copy Icon Indicator / Green Success Badge */}
                                                                {isCopied ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#22c55e', fontSize: '0.75rem', fontWeight: 800 }}>
                                                                        <Check size={14} />
                                                                        <span>{t('copied')}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ opacity: canReveal ? 0.6 : 0.25, display: 'flex', alignItems: 'center' }}>
                                                                        <Copy size={14} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
