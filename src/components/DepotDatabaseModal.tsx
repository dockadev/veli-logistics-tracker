import React, { useMemo } from 'react';
import { X, MapPin, BarChart3, Trash2 } from 'lucide-react';
import type { Depot, UserRole } from '../types';
import { CustomSelect } from './CustomSelect';
import { useLanguage } from '../context/LanguageContext';
import { getDepotDisplayName } from '../utils/helpers';

interface DepotDatabaseModalProps {
    isOpen: boolean;
    depots: Record<string, Depot>;
    activeDepotName: string | null;
    setActiveDepotName: (name: string | null) => void;
    onDetailedAnalysis: () => void;
    onClearAllData: () => void;
    userRole: UserRole;
    onClose: () => void;
}

export const DepotDatabaseModal: React.FC<DepotDatabaseModalProps> = React.memo(({
    isOpen,
    depots,
    activeDepotName,
    setActiveDepotName,
    onDetailedAnalysis,
    onClearAllData,
    userRole,
    onClose
}) => {
    const { t } = useLanguage();

    const depotKeys = useMemo(() => Object.keys(depots), [depots]);

    const selectOptions = useMemo(() => {
        return depotKeys.map(key => ({
            value: key,
            label: getDepotDisplayName(depots[key])
        }));
    }, [depotKeys, depots]);

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="depot-db-modal-title">
                <div 
                    className="modal-container" 
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '480px' }}
                >
                    {/* Header */}
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <MapPin size={20} style={{ color: 'var(--accent-color)' }} />
                            <h3 id="depot-db-modal-title" style={{ margin: 0 }}>{t('depot_database')}</h3>
                        </div>
                        <button className="modal-close" onClick={onClose} aria-label="Close depot database modal" type="button">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="modal-body modal-body-spacing">
                        <p className="help-text" style={{ marginBottom: '1.25rem' }}>
                            {t('depot_database_desc')}
                        </p>

                        {/* Active Depot Selection */}
                        {depotKeys.length > 0 ? (
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="activeDepotSelectorModal" style={{ fontSize: '0.65rem', marginBottom: '0.35rem', display: 'block', color: 'var(--text-secondary)' }}>
                                    {t('select_active_depot')}
                                </label>
                                <CustomSelect
                                    id="activeDepotSelectorModal"
                                    options={selectOptions}
                                    value={activeDepotName || ''}
                                    onChange={(val) => {
                                        setActiveDepotName(val);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="empty-row" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {t('no_depots_imported')}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {depotKeys.length > 0 && (
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }}
                                    onClick={() => {
                                        onDetailedAnalysis();
                                        onClose();
                                    }}
                                >
                                    <BarChart3 size={16} />
                                    <span>{t('detailed_analysis')}</span>
                                </button>
                            )}

                            {depotKeys.length > 0 && (userRole === 'officer' || userRole === 'logistics_lead' || userRole === 'developer') && (
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                    <button 
                                        className="btn btn-danger" 
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }} 
                                        onClick={() => {
                                            onClearAllData();
                                            onClose();
                                        }}
                                    >
                                        <Trash2 size={16} />
                                        <span>{t('clear_all_data')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose} type="button" style={{ width: '100%' }}>
                            {t('close')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

DepotDatabaseModal.displayName = 'DepotDatabaseModal';
