import React, { useState, useMemo } from 'react';
import { Plus, Check, Clock, Trash2, Truck, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import type { SupplyRequest, UserRole, Depot } from '../types';
import { getCategoryClass, getDepotDisplayName } from '../utils/helpers';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import { getItemIconUrl } from '../utils/itemIcons';

interface SupplyRequestsTabProps {
    requests: SupplyRequest[];
    userRole: UserRole;
    depots: Record<string, Depot>;
    onOpenCreateModal: () => void;
    onUpdateProgress: (requestId: string, itemIndex: number, amount: number) => void;
    onToggleCompleteItem: (requestId: string, itemIndex: number) => void;
    onDeleteRequest: (requestId: string) => void;
    onToggleRequestStatus: (requestId: string) => void;
}

export interface RequestCardProps {
    req: SupplyRequest;
    depots: Record<string, Depot>;
    userRole: UserRole;
    onUpdateProgress: (requestId: string, itemIndex: number, amount: number) => void;
    onToggleCompleteItem: (requestId: string, itemIndex: number) => void;
    onDeleteRequest: (requestId: string) => void;
    onToggleRequestStatus: (requestId: string) => void;
}

export const RequestCard: React.FC<RequestCardProps> = React.memo(({
    req,
    depots,
    userRole,
    onUpdateProgress,
    onToggleCompleteItem,
    onDeleteRequest,
    onToggleRequestStatus,
}) => {
    const { t, language } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    const itemsList = req.items || [];
    const totalRequired = itemsList.reduce((acc, item) => acc + item.quantityRequired, 0);
    const totalDelivered = itemsList.reduce((acc, item) => acc + item.quantityDelivered, 0);
    const aggregatePercent = totalRequired > 0 ? Math.min(100, Math.max(0, (totalDelivered / totalRequired) * 100)) : 0;
    const isDone = req.status === 'completed';
    const depotDisplayName = depots[req.depotName] ? getDepotDisplayName(depots[req.depotName]) : req.depotName;

    const itemsByCategory = useMemo(() => {
        const groups: Record<string, { item: typeof itemsList[0]; originalIndex: number }[]> = {};
        itemsList.forEach((item, originalIndex) => {
            const cat = item.itemCategory || 'utility';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push({ item, originalIndex });
        });
        return groups;
    }, [itemsList]);

    return (
        <div 
            className={`panel-card request-card-component ${isDone ? 'request-card-completed' : 'request-card-open'}`}
            style={{
                background: isDone ? 'rgba(16, 185, 129, 0.05)' : 'rgba(20, 24, 22, 0.95)',
                border: isDone ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                width: '100%',
                marginBottom: '0.85rem'
            }}
        >
            {/* Accordion Card Header - Clickable Bar */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '0.85rem 1.25rem',
                    background: isExpanded ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                    borderBottom: isExpanded ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                }}
            >
                {/* Left Meta Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 800, fontSize: '0.78rem' }}>
                        <MapPin size={15} />
                        <span>{depotDisplayName}</span>
                    </div>

                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                        {t('request_order_num', { id: req.id.substring(0, 5).toUpperCase() })}
                    </span>

                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {req.createdTime}
                    </span>

                    <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        background: isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.15)',
                        color: isDone ? '#10b981' : '#f97316',
                        border: isDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(249, 115, 22, 0.3)'
                    }}>
                        {isDone ? (language === 'tr' ? 'TAMAMLANDI' : 'COMPLETED') : (language === 'tr' ? 'AÇIK SİPARİŞ' : 'OPEN ORDER')}
                    </span>
                </div>

                {/* Right Progress Summary & Expand Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '170px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isDone ? '#10b981' : '#10b981', minWidth: '90px', textAlign: 'right' }}>
                            {Math.round(aggregatePercent)}% ({totalDelivered}/{totalRequired})
                        </span>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ width: `${aggregatePercent}%`, height: '100%', background: isDone ? '#10b981' : 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', color: '#10b981', opacity: 0.8 }}>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </div>

            {/* Expanded Item List Content */}
            {isExpanded && (
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {Object.entries(itemsByCategory).map(([cat, groupItems]) => (
                        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Category Subheader */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.35rem' }}>
                                <span className={`badge ${getCategoryClass(cat)}`}>
                                    {t(`cat_${cat}` as TranslationKey)}
                                </span>
                            </div>

                            {/* Item Rows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {groupItems.map(({ item, originalIndex }) => {
                                    const itemPercent = item.quantityRequired > 0 ? Math.min(100, Math.max(0, (item.quantityDelivered / item.quantityRequired) * 100)) : 0;
                                    const isItemDone = item.quantityDelivered >= item.quantityRequired;
                                    const iconUrl = getItemIconUrl(item.itemName);

                                    return (
                                        <div 
                                            key={originalIndex}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '1rem',
                                                padding: '0.6rem 0.85rem',
                                                background: isItemDone ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0, 0, 0, 0.25)',
                                                border: isItemDone ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                                                borderRadius: '6px',
                                                flexWrap: 'wrap'
                                            }}
                                        >
                                            {/* Item Icon & Title */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '200px' }}>
                                                {iconUrl && (
                                                    <img 
                                                        src={iconUrl} 
                                                        alt={item.itemName} 
                                                        style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} 
                                                    />
                                                )}
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isItemDone ? '#10b981' : 'var(--text-primary)' }}>
                                                    {item.itemName}
                                                </span>
                                            </div>

                                            {/* Item Progress Bar & Text */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '200px' }}>
                                                <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                                    <div style={{ width: `${itemPercent}%`, height: '100%', background: isItemDone ? '#10b981' : '#f97316', transition: 'width 0.3s ease' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isItemDone ? '#10b981' : 'var(--text-secondary)', minWidth: '100px', textAlign: 'right' }}>
                                                    {item.quantityDelivered} / {item.quantityRequired} ({Math.round(itemPercent)}%)
                                                </span>
                                            </div>

                                            {/* Quick Increment Buttons: +1, +4, +5, +10, +60, +100 */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                {isItemDone ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.72rem', fontWeight: 800 }}>
                                                        <Check size={14} style={{ strokeWidth: 3 }} />
                                                        <span>{language === 'tr' ? 'Tamamlandı' : 'Completed'}</span>
                                                        {!isDone && userRole !== 'member' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onToggleCompleteItem(req.id, originalIndex)}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: 'var(--text-muted)',
                                                                    fontSize: '0.65rem',
                                                                    textDecoration: 'underline',
                                                                    cursor: 'pointer',
                                                                    marginLeft: '0.5rem',
                                                                    padding: 0
                                                                }}
                                                            >
                                                                {language === 'tr' ? 'Yeniden Aç' : 'Reopen'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {[1, 4, 5, 10, 60, 100].map(amt => (
                                                            <button
                                                                key={amt}
                                                                type="button"
                                                                onClick={() => onUpdateProgress(req.id, originalIndex, amt)}
                                                                disabled={isDone}
                                                                style={{
                                                                    padding: '0.25rem 0.45rem',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                                    color: '#10b981',
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 800,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                                                }}
                                                            >
                                                                +{amt}
                                                            </button>
                                                        ))}

                                                        <button
                                                            type="button"
                                                            onClick={() => onToggleCompleteItem(req.id, originalIndex)}
                                                            disabled={isDone}
                                                            style={{
                                                                padding: '0.25rem 0.45rem',
                                                                borderRadius: '4px',
                                                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                                                background: 'rgba(16, 185, 129, 0.2)',
                                                                color: '#10b981',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            title={language === 'tr' ? 'Tamamlandı işaretle' : 'Mark as complete'}
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Order Action Buttons at bottom of expanded card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                        {(!isDone || userRole !== 'member') && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => onToggleRequestStatus(req.id)}
                                style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                {isDone ? (
                                    <>
                                        <Clock size={14} />
                                        <span>{t('reopen_order')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={14} style={{ color: '#10b981' }} />
                                        <span>{t('complete_order')}</span>
                                    </>
                                )}
                            </button>
                        )}

                        {userRole !== 'member' && (
                            <button
                                type="button"
                                className="btn btn-secondary text-negative"
                                onClick={() => onDeleteRequest(req.id)}
                                style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem' }}
                                title={t('delete_request_order')}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

RequestCard.displayName = 'RequestCard';

export const SupplyRequestsTab: React.FC<SupplyRequestsTabProps> = React.memo(({
    requests,
    userRole,
    depots,
    onOpenCreateModal,
    onUpdateProgress,
    onToggleCompleteItem,
    onDeleteRequest,
    onToggleRequestStatus,
}) => {
    const { t } = useLanguage();
    const [statusFilter, setStatusFilter] = useState<'open' | 'completed'>('open');

    // Filter requests - memoized for performance optimization
    const filteredRequests = useMemo(() => {
        return requests
            .filter(req => {
                const matchesStatus = 
                    (statusFilter === 'open' && req.status === 'open') ||
                    (statusFilter === 'completed' && req.status === 'completed');
                return matchesStatus;
            })
            .sort((a, b) => {
                if (a.status !== b.status) {
                    return a.status === 'completed' ? 1 : -1;
                }
                return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
            });
    }, [requests, statusFilter]);

    return (
        <div className="requests-tab-container">
            {/* Header controls inside the tab */}
            <div className="requests-header-panel">
                <div className="requests-filter-group-wrapper">
                    {/* Status filter */}
                    <div className="requests-filter-group">
                        <button 
                            className={`tab-btn requests-tab-btn-mini ${statusFilter === 'open' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('open')}
                        >
                            {t('status_open')}
                        </button>
                        <button 
                            className={`tab-btn requests-tab-btn-mini ${statusFilter === 'completed' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('completed')}
                        >
                            {t('completed')}
                        </button>
                    </div>
                </div>

                {userRole !== 'member' && (
                    <button 
                        className="btn btn-primary" 
                        onClick={onOpenCreateModal}
                    >
                        <Plus size={14} />
                        <span>{t('open_supply_request')}</span>
                    </button>
                )}
            </div>

            {/* Grid / List of Supply Request Cards */}
            {filteredRequests.length === 0 ? (
                <div className="table-container requests-empty-state-card">
                    <div className="empty-row">
                        <Truck size={36} className="requests-empty-state-icon" />
                        <p>{t('no_matching_requests')}</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
                    {filteredRequests.map(req => (
                        <RequestCard
                            key={req.id}
                            req={req}
                            depots={depots}
                            userRole={userRole}
                            onUpdateProgress={onUpdateProgress}
                            onToggleCompleteItem={onToggleCompleteItem}
                            onDeleteRequest={onDeleteRequest}
                            onToggleRequestStatus={onToggleRequestStatus}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

SupplyRequestsTab.displayName = 'SupplyRequestsTab';
