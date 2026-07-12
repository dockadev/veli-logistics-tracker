import React, { useState, useMemo } from 'react';
import { Plus, Check, Clock, Trash2, Truck } from 'lucide-react';
import type { SupplyRequest, UserRole, Depot } from '../types';
import { getCategoryClass, getDepotDisplayName } from '../utils/helpers';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

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
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    const itemsList = req.items || [];
    const totalRequired = itemsList.reduce((acc, item) => acc + item.quantityRequired, 0);
    const totalDelivered = itemsList.reduce((acc, item) => acc + item.quantityDelivered, 0);
    const aggregatePercent = totalRequired > 0 ? Math.min(100, Math.max(0, (totalDelivered / totalRequired) * 100)) : 0;
    const isDone = req.status === 'completed';
    const depotDisplayName = depots[req.depotName] ? getDepotDisplayName(depots[req.depotName]) : req.depotName;

    return (
        <div className={`panel-card request-card-component ${isDone ? 'request-card-completed' : 'request-card-open'}`}>
            <div>
                {/* Card Header */}
                <div className="request-card-header-layout">
                    <div className="request-card-title-container">
                        <span className="depot-label">
                            {depotDisplayName}
                        </span>
                        <h3>
                            {t('request_order_num', { id: req.id.substring(0, 5).toUpperCase() })}
                        </h3>
                        <span className="time-label">{t('created_at', { time: req.createdTime })}</span>
                    </div>
                    <div className="request-card-progress-container">
                        <span className="pct-label" style={{ color: isDone ? 'var(--color-positive)' : 'var(--text-primary)' }}>
                            {t('percent_full', { percent: Math.round(aggregatePercent) })}
                        </span>
                        <div className="request-card-progress-bar-track">
                            <div style={{ 
                                width: `${aggregatePercent}%`, 
                                background: isDone ? 'var(--color-positive)' : 'var(--accent-color)'
                            }} className="request-card-progress-bar-fill" />
                        </div>
                    </div>
                </div>



                {/* List of items inside this request */}
                <div className="request-card-items-list" style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.35rem' }}>
                    {(isExpanded ? itemsList : itemsList.slice(0, 3)).map((item, idx) => {
                         const itemPercent = item.quantityRequired > 0 ? Math.min(100, Math.max(0, (item.quantityDelivered / item.quantityRequired) * 100)) : 0;
                         const isItemDone = item.quantityDelivered >= item.quantityRequired;

                        return (
                            <div key={idx} className="request-card-item-box">
                                {/* Item title / badge / progress numbers */}
                                <div className="request-card-item-row-header">
                                    <div className="request-card-item-meta">
                                        <span className={`badge ${getCategoryClass(item.itemCategory)}`}>
                                            {t(`cat_${item.itemCategory}` as TranslationKey)}
                                        </span>
                                        <span className="request-card-item-name">
                                            {item.itemName}
                                        </span>
                                    </div>
                                    <span className="request-card-item-progress-text" style={{ color: isItemDone ? 'var(--color-positive)' : 'var(--text-secondary)' }}>
                                        {item.quantityDelivered} / {item.quantityRequired} ({Math.round(itemPercent)}%)
                                    </span>
                                </div>

                                {/* Progress bar per item */}
                                <div className="request-card-item-progress-bar-track">
                                    <div 
                                        className="request-card-item-progress-bar-fill"
                                        style={{ 
                                            width: `${itemPercent}%`, 
                                            background: isItemDone ? 'var(--color-positive)' : 'var(--accent-color)'
                                        }} 
                                    />
                                </div>

                                {/* Buttons for delivering this specific item (hidden if completed) */}
                                {isItemDone ? (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', color: 'var(--color-positive)', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0' }}>
                                        <Check size={14} style={{ strokeWidth: 3 }} />
                                        <span>Completed</span>
                                        {!isDone && userRole !== 'member' && (
                                            <button 
                                                onClick={() => onToggleCompleteItem(req.id, idx)}
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    color: 'var(--text-muted)', 
                                                    fontSize: '0.65rem', 
                                                    textDecoration: 'underline', 
                                                    cursor: 'pointer', 
                                                    marginLeft: '0.6rem',
                                                    padding: 0
                                                }}
                                            >
                                                Reopen
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="request-card-item-actions-row">
                                        <div className="request-card-item-btn-group">
                                            <button 
                                                className="btn btn-secondary request-card-item-btn" 
                                                onClick={() => onUpdateProgress(req.id, idx, 1)}
                                                disabled={isDone}
                                            >
                                                +1
                                            </button>
                                            <button 
                                                className="btn btn-secondary request-card-item-btn" 
                                                onClick={() => onUpdateProgress(req.id, idx, 5)}
                                                disabled={isDone}
                                            >
                                                +5
                                            </button>
                                            <button 
                                                className="btn btn-secondary request-card-item-btn" 
                                                onClick={() => onUpdateProgress(req.id, idx, 10)}
                                                disabled={isDone}
                                            >
                                                +10
                                            </button>
                                            <button 
                                                className="btn btn-secondary request-card-item-btn" 
                                                onClick={() => onUpdateProgress(req.id, idx, 60)}
                                                disabled={isDone}
                                            >
                                                +60
                                            </button>
                                        </div>

                                        {/* Complete tick button */}
                                        <button 
                                            className="btn btn-secondary request-card-item-complete-btn"
                                            style={{ 
                                                borderColor: 'rgba(16, 185, 129, 0.3)'
                                            }}
                                            onClick={() => onToggleCompleteItem(req.id, idx)}
                                            disabled={isDone}
                                            title={t('mark_item_complete')}
                                        >
                                            <Check size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Show More / Less button if items count exceeds 3 */}
                {itemsList.length > 3 && (
                    <button 
                        className="btn btn-secondary"
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{ 
                            width: '100%', 
                            fontSize: '0.68rem', 
                            padding: '0.35rem', 
                            marginTop: '0.5rem', 
                            background: 'rgba(255,255,255,0.01)', 
                            borderColor: 'rgba(255,255,255,0.05)' 
                        }}
                    >
                        {isExpanded ? 'Show Less' : `Show More (+${itemsList.length - 3} items)`}
                    </button>
                )}
            </div>

            {/* Order Action Buttons at card level */}
            <div className="request-card-actions-footer">
                {(!isDone || userRole !== 'member') && (
                    <button 
                        className="btn btn-secondary request-card-footer-btn-reopen" 
                        style={{ 
                            color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                            borderColor: isDone ? 'rgba(255,255,255,0.05)' : 'var(--border-color)'
                        }}
                        onClick={() => onToggleRequestStatus(req.id)}
                    >
                        {isDone ? (
                            <>
                                <Clock size={12} />
                                <span>{t('reopen_order')}</span>
                            </>
                        ) : (
                            <>
                                <Check size={12} style={{ color: 'var(--color-positive)' }} />
                                <span>{t('complete_order')}</span>
                            </>
                        )}
                    </button>
                )}

                {userRole !== 'member' && (
                    <button 
                        className="btn btn-secondary text-negative request-card-footer-btn-delete" 
                        onClick={() => onDeleteRequest(req.id)}
                        title={t('delete_request_order')}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
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

            {/* Grid of Supply Request Cards */}
            {filteredRequests.length === 0 ? (
                <div className="table-container requests-empty-state-card">
                    <div className="empty-row">
                        <Truck size={36} className="requests-empty-state-icon" />
                        <p>{t('no_matching_requests')}</p>
                    </div>
                </div>
            ) : (
                <div className="requests-grid-layout">
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
