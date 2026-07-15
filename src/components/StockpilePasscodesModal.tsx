import React, { useState } from 'react';
import { X, Key, Shield, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot } from '../types';

interface StockpilePasscodesModalProps {
    depots: Record<string, Depot>;
    onClose: () => void;
}

export const StockpilePasscodesModal: React.FC<StockpilePasscodesModalProps> = ({ depots, onClose }) => {
    const { t } = useLanguage();
    const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});

    const toggleReveal = (depotKey: string) => {
        setRevealedCodes(prev => ({ ...prev, [depotKey]: !prev[depotKey] }));
    };

    // Hierarchical grouping: Region -> Subregion/Town -> Depots
    const groupedData = React.useMemo(() => {
        const regions: Record<string, Record<string, Array<{ name: string; displayName: string; code: string }>>> = {};

        Object.entries(depots).forEach(([depotKey, depot]) => {
            const parts = depot.name.split(' - ').map(s => s.trim());
            const region = parts[0] || 'Unknown Region';
            let town = depot.townName || (parts.length > 2 ? parts[1] : 'Other Stockpiles');
            
            if (town) {
                const trimmed = town.trim();
                if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") town = "Light's End";
                else if (trimmed === 'Loftmire' || trimmed === 'The Blemish') town = 'Blemish';
                else if (trimmed === 'Rising Loom') town = 'Therizo';
            }
            
            const displayName = depot.customName || parts[parts.length - 1] || depot.name;
            const code = (depot as any).accessCode || '000000';

            if (!regions[region]) {
                regions[region] = {};
            }
            if (!regions[region][town]) {
                regions[region][town] = [];
            }

            regions[region][town].push({
                name: depotKey,
                displayName,
                code
            });
        });

        return regions;
    }, [depots]);

    return (
        <div className="modal-backdrop anim-fade-in" style={{ zIndex: 1100 }}>
            <div className="modal-card" style={{ maxWidth: '680px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <Shield size={20} style={{ color: 'var(--accent-color)' }} />
                        <div>
                            <h2 style={{ fontSize: '1.1rem', margin: 0, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                                {t('depot_passcodes_title')}
                            </h2>
                            <p style={{ fontSize: '0.72rem', margin: 0, color: 'var(--text-secondary)' }}>
                                {t('depot_passcodes_desc')}
                            </p>
                        </div>
                    </div>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body - Hierarchy Display */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ 
                        padding: '0.85rem 1rem', 
                        borderRadius: 'var(--radius-sm)', 
                        background: 'rgba(249, 115, 22, 0.08)', 
                        borderLeft: '4px solid var(--accent-color)',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        color: 'var(--accent-color)'
                    }}>
                        # VELI Coalition Stockpile Access Codes
                    </div>

                    {Object.keys(groupedData).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            No active stockpiles registered in database.
                        </div>
                    ) : (
                        Object.entries(groupedData).map(([region, towns]) => (
                            <div key={region} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                <h3 style={{ 
                                    fontSize: '0.98rem', 
                                    margin: 0, 
                                    paddingBottom: '0.35rem', 
                                    borderBottom: '1px solid var(--border-color)',
                                    color: 'var(--accent-color)',
                                    fontWeight: 700
                                }}>
                                    ## {region}
                                </h3>

                                {Object.entries(towns).map(([town, items]) => (
                                    <div key={town} style={{ paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {town !== 'Other Stockpiles' && (
                                            <h4 style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>
                                                ### {town}
                                            </h4>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: town !== 'Other Stockpiles' ? '0.75rem' : 0 }}>
                                            {items.map(item => {
                                                const isRevealed = !!revealedCodes[item.name];
                                                return (
                                                    <div 
                                                        key={item.name} 
                                                        style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'space-between',
                                                            padding: '0.5rem 0.75rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            background: 'var(--card-bg)',
                                                            border: '1px solid var(--border-color)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 500 }}>
                                                            <span style={{ color: 'var(--accent-color)' }}>•</span>
                                                            <span>{item.displayName}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>➔</span>
                                                            <div 
                                                                onClick={() => toggleReveal(item.name)}
                                                                style={{ 
                                                                    cursor: 'pointer',
                                                                    padding: '0.25rem 0.65rem',
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 700,
                                                                    letterSpacing: '0.1em',
                                                                    userSelect: 'none',
                                                                    background: isRevealed ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-tertiary)',
                                                                    color: isRevealed ? '#22c55e' : 'var(--text-secondary)',
                                                                    border: '1px solid ' + (isRevealed ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'),
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem'
                                                                }}
                                                                title="Click to toggle passcode reveal"
                                                            >
                                                                <Key size={12} />
                                                                <span>{isRevealed ? item.code : '••••••'}</span>
                                                                {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
