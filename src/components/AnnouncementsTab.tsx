import React from 'react';
import { Megaphone, AlertTriangle, AlertOctagon, Info, Clock, User, Trash2, Pin, Plus } from 'lucide-react';
import type { Announcement } from '../types';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

interface AnnouncementsTabProps {
    announcements: Announcement[];
    onOpenPublishModal?: () => void;
    userRole: string | null;
    onDeleteAnnouncement?: (id: string) => void;
    onPinAnnouncement?: (id: string, pinnedUntil: string | null) => void;
}

const PIN_OPTIONS = ['6h', '12h', '1d', '2d', '3d', '1w'] as const;

const PIN_MS: Record<string, number> = {
    '6h': 21600000,
    '12h': 43200000,
    '1d': 86400000,
    '2d': 172800000,
    '3d': 259200000,
    '1w': 604800000
};

const SEVERITY_STYLES = {
    critical: {
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeColor: '#ef4444',
        borderLeft: '4px solid #ef4444',
        icon: <AlertOctagon size={13} style={{ color: '#ef4444' }} />
    },
    high: {
        badgeBg: 'rgba(249, 115, 22, 0.15)',
        badgeColor: '#f97316',
        borderLeft: '4px solid #f97316',
        icon: <AlertTriangle size={13} style={{ color: '#f97316' }} />
    },
    normal: {
        badgeBg: 'var(--accent-bg)',
        badgeColor: 'var(--accent-color)',
        borderLeft: '4px solid var(--accent-color)',
        icon: <Info size={13} style={{ color: 'var(--accent-color)' }} />
    }
} as const;

export const AnnouncementsTab: React.FC<AnnouncementsTabProps> = React.memo(({
    announcements,
    onOpenPublishModal,
    userRole,
    onDeleteAnnouncement,
    onPinAnnouncement
}) => {
    const { t } = useLanguage();
    const [currentPage, setCurrentPage] = React.useState(1);
    const announcementsPerPage = 3;
    const isOfficer = userRole !== 'member' && userRole !== null;

    // Pinned first (soonest expiry on top), then newest first
    const sortedAnnouncements = React.useMemo(() => {
        const now = Date.now();
        const pinned = announcements
            .filter(a => a.pinnedUntil && new Date(a.pinnedUntil).getTime() > now)
            .sort((a, b) => new Date(a.pinnedUntil!).getTime() - new Date(b.pinnedUntil!).getTime());
        const rest = announcements
            .filter(a => !(a.pinnedUntil && new Date(a.pinnedUntil).getTime() > now))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return [...pinned, ...rest];
    }, [announcements]);

    const pinnedAnnouncements = React.useMemo(
        () => sortedAnnouncements.filter(a => a.pinnedUntil && new Date(a.pinnedUntil).getTime() > Date.now()),
        [sortedAnnouncements]
    );

    React.useEffect(() => {
        setCurrentPage(1);
    }, [announcements.length]);

    const indexOfLastAnn = currentPage * announcementsPerPage;
    const indexOfFirstAnn = indexOfLastAnn - announcementsPerPage;
    const currentAnnouncements = sortedAnnouncements.slice(indexOfFirstAnn, indexOfLastAnn);
    const totalPages = Math.max(1, Math.ceil(sortedAnnouncements.length / announcementsPerPage));

    const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

    const formatUntil = (pinnedUntil?: string | null) => {
        if (!pinnedUntil) return '';
        const end = new Date(pinnedUntil).getTime();
        const diff = Math.max(0, end - Date.now());
        const h = Math.floor(diff / 3600000);
        if (h < 1) return `${Math.floor(diff / 60000)}m`;
        if (h < 24) return `${h}h`;
        return `${Math.floor(h / 24)}d`;
    };

    return (
        <div id="tabContentAnnouncements" className="tab-content-panel anim-fade-in announcements-tab">
            <div className="table-container announcements-unified">
                {/* Title row */}
                <div className="announcements-card-title" style={{ padding: '0.85rem 1rem 0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Megaphone size={17} style={{ color: 'var(--accent-color)' }} />
                        <h3>{t('announcements')}</h3>
                        <span className="announcements-card-count">{announcements.length}</span>
                    </div>
                    {isOfficer && onOpenPublishModal && (
                        <button className="btn btn-primary" onClick={onOpenPublishModal} style={{ fontSize: '0.72rem', padding: '0.4rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Plus size={13} />
                            <span>{t('post_announcement')}</span>
                        </button>
                    )}
                </div>

                {/* Pinned strip */}
                {pinnedAnnouncements.length > 0 && (
                    <div style={{ padding: '0.6rem 1rem 0.35rem' }}>
                        <div className="announcements-pinned-strip">
                            <div className="announcements-pinned-strip-title">
                                <Pin size={12} />
                                <span>{t('pinned_announcements')}</span>
                            </div>
                            {pinnedAnnouncements.map(a => (
                                <div key={a.id} className="announcements-pinned-item" title={a.content}>
                                    <span className="announcements-pinned-item-title">{a.title}</span>
                                    <span className="announcements-pinned-item-until">~{formatUntil(a.pinnedUntil)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* List */}
                <div className="announcements-unified-body" style={{ padding: '0.85rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {sortedAnnouncements.length === 0 ? (
                        <div className="announcements-empty">
                            <Megaphone size={30} />
                            <p style={{ fontSize: '0.82rem', margin: 0 }}>{t('no_announcements')}</p>
                        </div>
                    ) : (
                        currentAnnouncements.map((ann, idx) => {
                            const styles = SEVERITY_STYLES[ann.severity] || SEVERITY_STYLES.normal;
                            const isPinned = !!ann.pinnedUntil && new Date(ann.pinnedUntil).getTime() > Date.now();
                            return (
                                <div
                                    key={ann.id}
                                    className={`announcements-card anim-row-in${isPinned ? ' is-pinned' : ''}`}
                                    style={{ animationDelay: `${idx * 40}ms`, ...(isPinned ? { borderLeft: '4px solid #f59e0b' } : styles) }}
                                >
                                    <div className="announcements-card-header">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
                                            <div className="announcements-card-title-row">
                                                <span className="announcements-severity-badge" style={{ background: styles.badgeBg, color: styles.badgeColor }}>
                                                    {styles.icon}
                                                    <span>{t(`severity_${ann.severity}` as TranslationKey)}</span>
                                                </span>
                                                {isPinned && (
                                                    <span className="announcements-severity-badge" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }} title={t('pinned_cannot_dismiss')}>
                                                        <Pin size={11} />
                                                        <span>{t('pinned_badge')}</span>
                                                    </span>
                                                )}
                                                <h4 className="announcements-title">{ann.title}</h4>
                                            </div>
                                            <div className="announcements-meta">
                                                <span>
                                                    <User size={12} />
                                                    <span>{ann.author} ({t(`role_${ann.role}` as TranslationKey) || ann.role})</span>
                                                </span>
                                                <span>
                                                    <Clock size={12} />
                                                    <span>{new Date(ann.timestamp).toLocaleString()}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="announcements-body">{ann.content}</div>

                                    {isOfficer && (onPinAnnouncement || onDeleteAnnouncement) && (
                                        <div className="announcements-footer">
                                            {onPinAnnouncement && (
                                                isPinned ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={() => onPinAnnouncement(ann.id, null)}
                                                        style={{ fontSize: '0.64rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                                                        title={t('unpin_announcement')}
                                                    >
                                                        <Pin size={11} /> {t('unpin')}
                                                    </button>
                                                ) : (
                                                    <div className="announcements-pin-controls">
                                                        <span className="announcements-pin-label">{t('pin')}:</span>
                                                        {PIN_OPTIONS.map(dur => (
                                                            <button
                                                                key={dur}
                                                                type="button"
                                                                className="announcements-pin-btn"
                                                                onClick={() => onPinAnnouncement(ann.id, new Date(Date.now() + PIN_MS[dur]).toISOString())}
                                                            >
                                                                {t(`pin_${dur}` as TranslationKey)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )
                                            )}
                                            {onDeleteAnnouncement && (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    onClick={() => onDeleteAnnouncement(ann.id)}
                                                    style={{ padding: '0.3rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title={t('delete_announcement')}
                                                >
                                                    <Trash2 size={14} style={{ color: '#ef4444' }} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 1rem 1rem', padding: '0.6rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(0,0,0,0.2)' }}>
                        <div className="pagination-info" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                            {indexOfFirstAnn + 1} - {Math.min(indexOfLastAnn, sortedAnnouncements.length)} / {sortedAnnouncements.length}
                        </div>
                        <div className="pagination-controls" style={{ display: 'flex', gap: '0.3rem' }}>
                            <button className="pagination-btn" onClick={handlePrevPage} disabled={currentPage === 1} style={{ padding: '0.3rem 0.6rem', fontSize: '0.66rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>
                                {t('prev_page')}
                            </button>
                            {Array.from({ length: totalPages }).map((_, idx) => (
                                <button
                                    key={idx}
                                    className={`pagination-btn ${currentPage === idx + 1 ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(idx + 1)}
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.66rem', cursor: 'pointer' }}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                            <button className="pagination-btn" onClick={handleNextPage} disabled={currentPage === totalPages} style={{ padding: '0.3rem 0.6rem', fontSize: '0.66rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>
                                {t('next_page')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

AnnouncementsTab.displayName = 'AnnouncementsTab';
