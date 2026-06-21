import React, { useState, useMemo } from 'react';
import { Search, Check, Ban, ShieldAlert, UserMinus, ShieldCheck } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { PortalUser, AuditLogEntry } from '../types';
import { AuditLogTab } from './AuditLogTab';

interface DeveloperPortalTabProps {
    users: PortalUser[];
    onApproveUser: (id: string, approvedRole?: 'member' | 'officer') => void;
    onRejectUser: (id: string) => void;
    onPromoteUser: (id: string) => void;
    onDemoteUser: (id: string) => void;
    userRole: string;
    auditLogs: AuditLogEntry[];
    onClearAuditLogs?: () => void;
    feedbacks?: { id: string; username: string; message: string; created_at: string; category?: 'bug' | 'idea'; status?: 'pending' | 'in_progress' | 'completed' }[];
    onDeleteFeedback?: (id: string) => void;
    onUpdateFeedbackStatus?: (id: string, status: 'pending' | 'in_progress' | 'completed') => void;
}

export const DeveloperPortalModal: React.FC<DeveloperPortalTabProps> = React.memo(({
    users,
    onApproveUser,
    onRejectUser,
    onPromoteUser,
    onDemoteUser,
    userRole,
    auditLogs,
    onClearAuditLogs,
    feedbacks = [],
    onDeleteFeedback,
    onUpdateFeedbackStatus,
}) => {
    const { t, language } = useLanguage();
    const [activeSubTab, setActiveSubTab] = useState<'approvals' | 'users' | 'audit' | 'feedbacks'>(
        userRole === 'officer' ? 'audit' : 'approvals'
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 5;

    const [feedbackPage, setFeedbackPage] = useState(1);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Reset page on search query change or subtab change
    React.useEffect(() => {
        setCurrentPage(1);
        setFeedbackPage(1);
        setConfirmDeleteId(null);
    }, [searchTerm, activeSubTab]);

    const paginatedFeedbacks = useMemo(() => {
        return feedbacks.slice((feedbackPage - 1) * 5, feedbackPage * 5);
    }, [feedbacks, feedbackPage]);

    const feedbacksTotalPages = Math.ceil(feedbacks.length / 5);

    const pendingUsers = useMemo(() => {
        return users.filter(u => u.status === 'pending');
    }, [users]);

    const approvedUsers = useMemo(() => {
        const approvedList = users.filter(u => u.status === 'approved' || u.status === 'rejected');
        const term = searchTerm.toLowerCase().trim();
        if (!term) return approvedList;
        return approvedList.filter(u => u.username.toLowerCase().includes(term));
    }, [users, searchTerm]);

    const totalPages = Math.ceil(approvedUsers.length / usersPerPage);
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * usersPerPage;
        return approvedUsers.slice(startIndex, startIndex + usersPerPage);
    }, [approvedUsers, currentPage]);

    const getRoleClass = (role: string) => {
        switch (role) {
            case 'developer':
                return 'badge badge-crate';
            case 'officer':
                return 'badge badge-vehicle';
            default:
                return 'badge badge-item';
        }
    };

    return (
        <div className="table-container anim-fade-in" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <ShieldAlert size={16} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 4px var(--accent-glow))' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                    {userRole === 'officer' ? 'Officer Portal & Audit Logs' : t('developer_portal')}
                </h3>
            </div>
            
            <p className="help-text" style={{ marginBottom: '1rem', fontSize: '0.72rem' }}>
                {userRole === 'officer' 
                    ? 'Access historical logistics logs and security operations records.'
                    : t('developer_portal_desc')}
            </p>

            {/* Sub-tabs (Only for developer. Officers can only view audit logs) */}
            {userRole === 'developer' && (
                <div className="panel-tabs" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0px' }}>
                    <button
                        className={`tab-btn ${activeSubTab === 'approvals' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('approvals')}
                        style={{ 
                            padding: '0.4rem 1rem', 
                            fontSize: '0.75rem', 
                            borderRadius: '4px 4px 0 0', 
                            borderBottom: activeSubTab === 'approvals' ? '2px solid var(--accent-color)' : 'none', 
                            background: activeSubTab === 'approvals' ? 'rgba(249, 115, 22, 0.08)' : 'transparent', 
                            color: activeSubTab === 'approvals' ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <span>{t('approvals')} ({pendingUsers.length})</span>
                    </button>
                    <button
                        className={`tab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('users')}
                        style={{ 
                            padding: '0.4rem 1rem', 
                            fontSize: '0.75rem', 
                            borderRadius: '4px 4px 0 0', 
                            borderBottom: activeSubTab === 'users' ? '2px solid var(--accent-color)' : 'none', 
                            background: activeSubTab === 'users' ? 'rgba(249, 115, 22, 0.08)' : 'transparent', 
                            color: activeSubTab === 'users' ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <span>{t('users')} ({approvedUsers.length})</span>
                    </button>
                    <button
                        className={`tab-btn ${activeSubTab === 'audit' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('audit')}
                        style={{ 
                            padding: '0.4rem 1rem', 
                            fontSize: '0.75rem', 
                            borderRadius: '4px 4px 0 0', 
                            borderBottom: activeSubTab === 'audit' ? '2px solid var(--accent-color)' : 'none', 
                            background: activeSubTab === 'audit' ? 'rgba(249, 115, 22, 0.08)' : 'transparent', 
                            color: activeSubTab === 'audit' ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <span>Audit Logs</span>
                    </button>
                    <button
                        className={`tab-btn ${activeSubTab === 'feedbacks' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('feedbacks')}
                        style={{ 
                            padding: '0.4rem 1rem', 
                            fontSize: '0.75rem', 
                            borderRadius: '4px 4px 0 0', 
                            borderBottom: activeSubTab === 'feedbacks' ? '2px solid var(--accent-color)' : 'none', 
                            background: activeSubTab === 'feedbacks' ? 'rgba(249, 115, 22, 0.08)' : 'transparent', 
                            color: activeSubTab === 'feedbacks' ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <span>{language === 'tr' ? 'Geri Bildirimler' : 'Feedbacks'} ({feedbacks.length})</span>
                    </button>
                </div>
            )}

            {/* Tab Content: Approvals */}
            {userRole === 'developer' && activeSubTab === 'approvals' && (
                <div style={{ minHeight: '180px', maxHeight: '400px', overflowY: 'auto' }}>
                    {pendingUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.5 }}>
                            <p style={{ fontSize: '0.75rem', margin: 0 }}>No pending approvals found.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {pendingUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        background: 'var(--btn-secondary-bg)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '8px', 
                                        padding: '0.55rem 0.75rem' 
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{user.username}</span>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                Request: <span className={getRoleClass(user.role)} style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem', marginLeft: '0.2rem' }}>{t(`role_${user.role}` as TranslationKey) || user.role}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button 
                                            className="btn btn-secondary text-negative" 
                                            onClick={() => onRejectUser(user.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', padding: '0.25rem 0.6rem' }}
                                        >
                                            <Ban size={11} />
                                            <span>{t('reject')}</span>
                                        </button>
                                        
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => onApproveUser(user.id, 'member')}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', padding: '0.25rem 0.6rem' }}
                                        >
                                            <Check size={11} />
                                            <span>{t('approve')}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab Content: Users */}
            {userRole === 'developer' && activeSubTab === 'users' && (
                <div>
                    {/* Search filter */}
                    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                        <Search 
                            size={12} 
                            style={{ 
                                position: 'absolute', 
                                left: '0.6rem', 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: 'var(--text-muted)' 
                            }} 
                        />
                        <input
                            type="text"
                            placeholder={t('search_user_placeholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.35rem 0.5rem 0.35rem 1.8rem',
                                fontSize: '0.75rem',
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '30px',
                                color: '#fff',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ minHeight: '180px', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {approvedUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.5 }}>
                                <p style={{ fontSize: '0.75rem', margin: 0 }}>No users found.</p>
                            </div>
                        ) : (
                            paginatedUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        background: 'var(--btn-secondary-bg)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '8px', 
                                        padding: '0.5rem 0.75rem' 
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{user.username}</span>
                                        <span className={getRoleClass(user.role)} style={{ fontSize: '0.58rem', padding: '0.1rem 0.35rem' }}>
                                            {t(`role_${user.role}` as TranslationKey) || user.role}
                                        </span>
                                        {user.status === 'rejected' && (
                                            <span className="badge badge-structure" style={{ fontSize: '0.58rem', padding: '0.1rem 0.35rem', background: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--color-negative)' }}>
                                                Rejected
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {user.role === 'member' && user.status === 'approved' && (
                                            <button 
                                                className="btn btn-secondary" 
                                                onClick={() => onPromoteUser(user.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                                            >
                                                <ShieldCheck size={11} style={{ color: 'var(--accent-color)' }} />
                                                <span>{t('promote_to_officer')}</span>
                                            </button>
                                        )}
                                        {user.role === 'officer' && user.status === 'approved' && (
                                            <button 
                                                className="btn btn-secondary text-negative" 
                                                onClick={() => onDemoteUser(user.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                                            >
                                                <UserMinus size={11} />
                                                <span>{t('demote_to_member')}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Users Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                type="button"
                            >
                                <span>{t('previous') || 'Geri'}</span>
                            </button>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                type="button"
                            >
                                <span>{t('next') || 'İleri'}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Tab Content: Audit Logs */}
            {((userRole === 'developer' && activeSubTab === 'audit') || userRole === 'officer') && (
                <div style={{ marginTop: '0.25rem' }}>
                    <AuditLogTab logs={auditLogs} onClearLogs={onClearAuditLogs} />
                </div>
            )}

            {/* Tab Content: Feedbacks */}
            {userRole === 'developer' && activeSubTab === 'feedbacks' && (
                <div>
                    <div style={{ minHeight: '180px', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem', paddingRight: '0.25rem' }}>
                        {feedbacks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', opacity: 0.5 }}>
                                <p style={{ fontSize: '0.75rem', margin: 0 }}>
                                    {language === 'tr' ? 'Henüz geri bildirim gönderilmemiş.' : 'No feedbacks received yet.'}
                                </p>
                            </div>
                        ) : (
                            paginatedFeedbacks.map(fb => (
                                <div 
                                    key={fb.id} 
                                    style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        gap: '0.45rem',
                                        background: 'var(--btn-secondary-bg)', 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '8px', 
                                        padding: '0.75rem 0.95rem' 
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--accent-color)' }}>{fb.username}</span>
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                                {new Date(fb.created_at).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}
                                            </span>
                                            
                                            {/* Category Badge */}
                                            {fb.category === 'bug' ? (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontWeight: 600 }}>
                                                    {language === 'tr' ? 'Hata' : 'Bug'}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.25)', color: 'var(--accent-color)', fontWeight: 600 }}>
                                                    {language === 'tr' ? 'Fikir' : 'Idea'}
                                                </span>
                                            )}

                                            {/* Status Badge */}
                                            {fb.status === 'completed' && (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e', fontWeight: 600 }}>
                                                    {language === 'tr' ? 'Tamamlandı' : 'Completed'}
                                                </span>
                                            )}
                                            {fb.status === 'in_progress' && (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#3b82f6', fontWeight: 600 }}>
                                                    {language === 'tr' ? 'Çalışılıyor' : 'In Progress'}
                                                </span>
                                            )}
                                            {(!fb.status || fb.status === 'pending') && (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(156, 163, 175, 0.1)', border: '1px solid rgba(156, 163, 175, 0.25)', color: '#9ca3af', fontWeight: 600 }}>
                                                    {language === 'tr' ? 'Beklemede' : 'Pending'}
                                                </span>
                                            )}
                                        </div>
                                        {onDeleteFeedback && (
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {confirmDeleteId === fb.id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600 }}>
                                                            {language === 'tr' ? 'Emin misiniz?' : 'Are you sure?'}
                                                        </span>
                                                        <button
                                                            className="btn btn-secondary"
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            style={{ padding: '0.1rem 0.3rem', fontSize: '0.58rem', minWidth: 'auto', height: 'auto' }}
                                                            type="button"
                                                        >
                                                            {language === 'tr' ? 'Hayır' : 'No'}
                                                        </button>
                                                        <button
                                                            className="btn btn-primary"
                                                            onClick={() => {
                                                                onDeleteFeedback(fb.id);
                                                                setConfirmDeleteId(null);
                                                            }}
                                                            style={{ padding: '0.1rem 0.3rem', fontSize: '0.58rem', background: '#ef4444', borderColor: '#ef4444', minWidth: 'auto', height: 'auto' }}
                                                            type="button"
                                                        >
                                                            {language === 'tr' ? 'Evet' : 'Yes'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn-dismiss-action"
                                                        onClick={() => setConfirmDeleteId(fb.id)}
                                                        style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                                                        title={language === 'tr' ? 'Sil' : 'Delete'}
                                                        type="button"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45, textAlign: 'left' }}>
                                        {fb.message}
                                    </p>
                                    {/* Status Update Controls */}
                                    {onUpdateFeedbackStatus && (
                                        <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.45rem' }}>
                                            {fb.status !== 'in_progress' && (
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => onUpdateFeedbackStatus(fb.id, 'in_progress')}
                                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                                    type="button"
                                                >
                                                    <span>{language === 'tr' ? 'Çalışılıyor Yap' : 'Set In Progress'}</span>
                                                </button>
                                            )}
                                            {fb.status !== 'completed' && (
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => onUpdateFeedbackStatus(fb.id, 'completed')}
                                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.15rem', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#22c55e' }}
                                                    type="button"
                                                >
                                                    <span>{language === 'tr' ? 'Tamamlandı Yap' : 'Set Completed'}</span>
                                                </button>
                                            )}
                                            {fb.status && fb.status !== 'pending' && (
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => onUpdateFeedbackStatus(fb.id, 'pending')}
                                                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.15rem', opacity: 0.6 }}
                                                    type="button"
                                                >
                                                    <span>{language === 'tr' ? 'Beklemeye Al' : 'Set Pending'}</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {/* Feedbacks Pagination Controls */}
                    {feedbacksTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setFeedbackPage(p => Math.max(p - 1, 1))}
                                disabled={feedbackPage === 1}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                type="button"
                            >
                                <span>{language === 'tr' ? 'Geri' : 'Previous'}</span>
                            </button>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {feedbackPage} / {feedbacksTotalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setFeedbackPage(p => Math.min(p + 1, feedbacksTotalPages))}
                                disabled={feedbackPage === feedbacksTotalPages}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                                type="button"
                            >
                                <span>{language === 'tr' ? 'İleri' : 'Next'}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

DeveloperPortalModal.displayName = 'DeveloperPortalTab';
