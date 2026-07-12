import React from 'react';
import { Megaphone, AlertTriangle, AlertOctagon, Info, Clock, User, Trash2 } from 'lucide-react';
import type { Announcement } from '../types';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

interface AnnouncementsTabProps {
    announcements: Announcement[];
    onOpenPublishModal?: () => void;
    userRole: string | null;
    onDeleteAnnouncement?: (id: string) => void;
}

export const AnnouncementsTab: React.FC<AnnouncementsTabProps> = React.memo(({
    announcements,
    onOpenPublishModal,
    userRole,
    onDeleteAnnouncement
}) => {
    const { t } = useLanguage();
    const [currentPage, setCurrentPage] = React.useState(1);
    const announcementsPerPage = 3;

    // Reset pagination when list length changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [announcements.length]);

    const indexOfLastAnn = currentPage * announcementsPerPage;
    const indexOfFirstAnn = indexOfLastAnn - announcementsPerPage;
    const currentAnnouncements = announcements.slice(indexOfFirstAnn, indexOfLastAnn);
    const totalPages = Math.ceil(announcements.length / announcementsPerPage);

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(1, prev - 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(totalPages, prev + 1));
    };

    const getSeverityStyles = (severity: 'normal' | 'high' | 'critical') => {
        switch (severity) {
            case 'critical':
                return {
                    borderLeft: '4px solid #ef4444',
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.08), inset 0 0 12px rgba(239, 68, 68, 0.02)',
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    badgeColor: '#ef4444',
                    badgeBg: 'rgba(239, 68, 68, 0.15)',
                    icon: <AlertOctagon size={16} style={{ color: '#ef4444' }} />
                };
            case 'high':
                return {
                    borderLeft: '4px solid #f97316',
                    boxShadow: '0 4px 20px rgba(249, 115, 22, 0.08), inset 0 0 12px rgba(249, 115, 22, 0.02)',
                    borderColor: 'rgba(249, 115, 22, 0.25)',
                    badgeColor: '#f97316',
                    badgeBg: 'rgba(249, 115, 22, 0.15)',
                    icon: <AlertTriangle size={16} style={{ color: '#f97316' }} />
                };
            default:
                return {
                    borderLeft: '4px solid var(--accent-color)',
                    boxShadow: '0 4px 20px var(--accent-glow), inset 0 0 12px rgba(var(--accent-color-rgb), 0.02)',
                    borderColor: 'var(--border-color)',
                    badgeColor: 'var(--accent-color)',
                    badgeBg: 'var(--accent-bg)',
                    icon: <Info size={16} style={{ color: 'var(--accent-color)' }} />
                };
        }
    };

    return (
        <div className="announcements-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Megaphone size={20} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 4px var(--accent-glow))' }} />
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                        {t('announcements')}
                    </h2>
                </div>
                {userRole !== 'member' && onOpenPublishModal && (
                    <button className="btn btn-primary" onClick={onOpenPublishModal} style={{ fontSize: '0.75rem', padding: '0.45rem 1rem' }}>
                        {t('post_announcement')}
                    </button>
                )}
            </div>

            {announcements.length === 0 ? (
                <div className="table-container" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div className="empty-row" style={{ border: 'none' }}>
                        <Megaphone size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No announcements posted yet.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {currentAnnouncements.map(ann => {
                        const styles = getSeverityStyles(ann.severity);
                        return (
                            <div 
                                key={ann.id}
                                className="panel-card"
                                style={{
                                    borderLeft: styles.borderLeft,
                                    boxShadow: styles.boxShadow,
                                    borderTop: `1px solid ${styles.borderColor}`,
                                    borderRight: `1px solid ${styles.borderColor}`,
                                    borderBottom: `1px solid ${styles.borderColor}`,
                                    padding: '1.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-card)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    transition: 'transform 0.2s, border-color 0.2s'
                                }}
                            >
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span 
                                                style={{
                                                    background: styles.badgeBg,
                                                    color: styles.badgeColor,
                                                    fontSize: '0.62rem',
                                                    fontWeight: 800,
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}
                                            >
                                                {styles.icon}
                                                <span>{t(`severity_${ann.severity}` as TranslationKey)}</span>
                                            </span>
                                            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                                                {ann.title}
                                            </h4>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <User size={12} />
                                                <span>{ann.author} ({t(`role_${ann.role}` as TranslationKey) || ann.role})</span>
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <Clock size={12} />
                                                <span>{new Date(ann.timestamp).toLocaleString()}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div 
                                    className="announcement-body"
                                    style={{
                                        fontSize: '0.88rem',
                                        color: 'var(--text-primary)',
                                        lineHeight: '1.6',
                                        whiteSpace: 'pre-wrap',
                                        background: 'rgba(0,0,0,0.15)',
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid rgba(255,255,255,0.02)'
                                    }}
                                >
                                    {ann.content}
                                </div>

                                 {/* Card Footer: Delete Button */}
                                 {userRole !== 'member' && onDeleteAnnouncement && (
                                     <div 
                                         style={{ 
                                             display: 'flex', 
                                             justifyContent: 'flex-end',
                                             alignItems: 'center', 
                                             borderTop: '1px solid rgba(255,255,255,0.03)',
                                             paddingTop: '0.75rem',
                                             marginTop: '0.25rem'
                                         }}
                                     >
                                         <button
                                             className="btn btn-secondary text-negative"
                                             onClick={() => onDeleteAnnouncement(ann.id)}
                                             style={{
                                                 padding: '0.35rem',
                                                 background: 'transparent',
                                                 border: 'none',
                                                 cursor: 'pointer',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 justifyContent: 'center'
                                             }}
                                             title="Delete Announcement"
                                         >
                                             <Trash2 size={14} style={{ color: '#ef4444' }} />
                                         </button>
                                     </div>
                                 )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.75rem 1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.2)' }}>
                    <div className="pagination-info" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Showing {indexOfFirstAnn + 1} to {Math.min(indexOfLastAnn, announcements.length)} of {announcements.length} entries
                    </div>
                    <div className="pagination-controls" style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                            className="pagination-btn"
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.68rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }).map((_, idx) => (
                            <button
                                key={idx}
                                className={`pagination-btn ${currentPage === idx + 1 ? 'active' : ''}`}
                                onClick={() => setCurrentPage(idx + 1)}
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.68rem', cursor: 'pointer' }}
                            >
                                {idx + 1}
                            </button>
                        ))}
                        <button
                            className="pagination-btn"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.68rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

AnnouncementsTab.displayName = 'AnnouncementsTab';
