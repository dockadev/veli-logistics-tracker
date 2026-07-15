import React, { useState, useMemo } from 'react';
import { 
    Search, Check, Ban, ShieldAlert, 
    ShieldCheck, RotateCw, Trash2, RefreshCw, 
    AlertTriangle, Shield, MessageSquare, 
    Terminal, Settings2 
} from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { PortalUser, AuditLogEntry, UserRole } from '../types';
import { AuditLogTab } from './AuditLogTab';
import { CustomSelect } from './CustomSelect';

interface DeveloperPortalTabProps {
    users: PortalUser[];
    onApproveUser: (id: string, approvedRole?: UserRole) => void;
    onRejectUser: (id: string) => void;
    onUpdateUserRole: (id: string, role: UserRole) => void;
    userRole: string;
    auditLogs: AuditLogEntry[];
    onClearAuditLogs?: () => void;
    feedbacks?: { id: string; username: string; message: string; created_at: string; category?: 'bug' | 'idea'; status?: 'pending' | 'in_progress' | 'completed' }[];
    onDeleteFeedback?: (id: string) => void;
    onUpdateFeedbackStatus?: (id: string, status: 'pending' | 'in_progress' | 'completed') => void;
    depots?: Record<string, any>;
    onGenerateTestDepotsSet1?: () => void;
    onGenerateTestDepotsSet2?: () => void;
    onDeleteTestDepots?: () => void;
    onRefreshUsers?: () => void | Promise<void>;
    onResetLeaderboard: () => Promise<void>;
    minAppVersion?: string;
    onUpdateMinAppVersion?: (version: string) => Promise<void>;
}

export const DeveloperPortalModal: React.FC<DeveloperPortalTabProps> = React.memo(({
    users,
    onApproveUser,
    onRejectUser,
    onUpdateUserRole,
    userRole,
    auditLogs,
    onClearAuditLogs,
    feedbacks = [],
    onDeleteFeedback,
    onUpdateFeedbackStatus,
    depots = {},
    onGenerateTestDepotsSet1,
    onGenerateTestDepotsSet2,
    onDeleteTestDepots,
    onRefreshUsers,
    onResetLeaderboard,
    minAppVersion = '0.1.60',
    onUpdateMinAppVersion,
}) => {
    const { t, language } = useLanguage();
    const [activeSubTab, setActiveSubTab] = useState<'approvals' | 'audit' | 'feedbacks' | 'system'>(
        userRole === 'developer' ? 'approvals' : 'audit'
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;

    const [feedbackPage, setFeedbackPage] = useState(1);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // War Reset states
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [tempMinVersion, setTempMinVersion] = useState(minAppVersion);
    const [isSavingVersion, setIsSavingVersion] = useState(false);
    const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

    React.useEffect(() => {
        setTempMinVersion(minAppVersion);
    }, [minAppVersion]);

    const handleSaveMinVersion = () => {
        if (!onUpdateMinAppVersion || !tempMinVersion.trim()) return;
        setIsVersionModalOpen(true);
    };

    const handleConfirmSaveMinVersion = async () => {
        if (!onUpdateMinAppVersion) return;
        setIsVersionModalOpen(false);
        setIsSavingVersion(true);
        try {
            await onUpdateMinAppVersion(tempMinVersion);
        } finally {
            setIsSavingVersion(false);
        }
    };

    // Local War Reset translations
    const localTranslations: Record<string, Record<string, string>> = {
        tr: {
            war_control: 'SAVAŞ YÖNETİMİ & KONTROLÜ',
            war_control_desc: 'Savaş sıfırlama, liderlik sıralamalarını temizleme ve veri yönetim araçları.',
            reset_leaderboard: 'Savaş İstatistiklerini Sıfırla',
            reset_warning_title: 'SAVAŞ SIFIRLAMA ONAYI',
            reset_warning_body: 'Bu işlem, mevcut savaştaki tüm üyelerin liderlik tablosu istatistiklerini (CSV import, talep açma ve teslimat sayıları) kalıcı olarak sıfırlayacaktır. Yeni savaşa geçerken bu işlemi onaylıyor musunuz?',
            cancel: 'İptal',
            confirm_reset: 'Evet, Sıfırla',
            developer_only: 'Bu işlem sadece Geliştirici (Developer) yetkisine özeldir.',
            test_depots: 'Test Depoları Yönetimi',
            test_depots_desc: 'Geliştirme ve görsel hata denetimi amacıyla 20 adet rastgele içerikli test deposu oluşturur veya siler.',
            version_title: 'SÜRÜM YÖNETİMİ & KONTROLÜ',
            version_desc: 'Uygulamaya giriş yapabilecek minimum sürümü belirleyin. Bu sürümün altındaki kullanıcılar uygulamayı kullanamayacak ve indirme sayfasına yönlendirilecektir.',
            min_req_version: 'Minimum Gerekli Sürüm',
            update_version: 'Sürümü Güncelle',
            saving: 'Kaydediliyor...',
            confirm_version_title: 'SÜRÜM GÜNCELLEME ONAYI',
            confirm_version_body: 'Minimum gerekli sürümü güncellemek üzeresiniz. Bu sürümün altındaki tüm istemciler (kullanıcılar) uygulamadan hemen engellenecektir. Devam etmek istiyor musunuz?',
            confirm_update: 'Evet, Güncelle'
        },
        en: {
            war_control: 'WAR CONTROL & ADMINISTRATION',
            war_control_desc: 'War reset commands, contribution leaderboard stats clearing, and developer utility tools.',
            reset_leaderboard: 'Reset War Stats',
            reset_warning_title: 'WAR RESET CONFIRMATION',
            reset_warning_body: 'This action will permanently reset all members\' leaderboard statistics (CSV imports, requests created, and deliveries completed) for the current war. Do you confirm this action for the new war?',
            cancel: 'Cancel',
            confirm_reset: 'Yes, Reset',
            developer_only: 'This action is restricted to the Developer role only.',
            test_depots: 'Test Depots Simulator',
            test_depots_desc: 'Generates or deletes 20 simulated test depots with randomized inventory levels for debugging purposes.',
            version_title: 'VERSION MANAGEMENT & ENFORCEMENT',
            version_desc: 'Set the minimum required version to access the app. Users running older versions will be blocked and redirected to the releases page.',
            min_req_version: 'Minimum Required Version',
            update_version: 'Update Version',
            saving: 'Saving...',
            confirm_version_title: 'VERSION UPDATE CONFIRMATION',
            confirm_version_body: 'You are about to update the minimum required app version. All clients (users) below this version will be blocked immediately from using the app. Do you want to proceed?',
            confirm_update: 'Yes, Update'
        }
    };

    const getLocalTranslation = (key: string): string => {
        const lang = localTranslations[language] ? language : 'en';
        return localTranslations[lang][key] || localTranslations['en'][key] || key;
    };

    const handleRefresh = async () => {
        if (!onRefreshUsers || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await onRefreshUsers();
        } catch (e) {
            console.error('[Portal] Refresh failed:', e);
        } finally {
            setTimeout(() => setIsRefreshing(false), 600);
        }
    };

    const handleConfirmReset = async () => {
        setIsResetting(true);
        try {
            await onResetLeaderboard();
            setIsResetModalOpen(false);
        } catch (error) {
            console.error('Failed to reset leaderboard stats:', error);
        } finally {
            setIsResetting(false);
        }
    };

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
            case 'logistics_lead':
                return 'badge badge-logistics_lead';
            case 'officer':
                return 'badge badge-vehicle';
            default:
                return 'badge badge-item';
        }
    };

    return (
        <div className="panel-card anim-fade-in" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-card, rgba(15, 15, 20, 0.45))', backdropFilter: 'blur(12px)' }}>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .dev-subtab-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 0.5rem;
                    margin-bottom: 1.25rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    padding-bottom: 0.75rem;
                }
                .dev-subtab-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.75rem;
                    font-weight: 700;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.01);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .dev-subtab-btn:hover {
                    background: rgba(255, 255, 255, 0.03);
                    color: var(--text-primary);
                }
                .dev-subtab-btn.active {
                    background: rgba(249, 115, 22, 0.1);
                    border-color: rgba(249, 115, 22, 0.3);
                    color: var(--accent-color);
                    box-shadow: 0 0 10px rgba(249, 115, 22, 0.05);
                }
                .dev-portal-section-card {
                    background: rgba(255, 255, 255, 0.01);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 8px;
                    padding: 1rem;
                }
            `}</style>

            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.3))' }} />
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                        {userRole === 'developer' ? t('developer_portal') : userRole === 'logistics_lead' ? 'Logistics Lead Panel' : 'Officer Control Panel'}
                    </h3>
                </div>
                {userRole === 'developer' && onRefreshUsers && (
                    <button
                        onClick={handleRefresh}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            transition: 'color 0.2s',
                            borderRadius: '4px'
                        }}
                        title={language === 'tr' ? 'Yenile' : 'Refresh'}
                    >
                        <RotateCw 
                            size={14} 
                            style={{ 
                                animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none',
                                color: 'var(--text-secondary)'
                            }} 
                        />
                    </button>
                )}
            </div>

            <p className="help-text" style={{ marginBottom: '1.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {userRole === 'developer' 
                    ? t('developer_portal_desc')
                    : userRole === 'logistics_lead'
                    ? 'Access template configurations and logistics audit logs.'
                    : 'Access historical logs, active user accounts, and security logs.'}
            </p>

            {/* Navigation Tabs Grid */}
            {userRole === 'developer' && (
                <div className="dev-subtab-grid">
                    <button
                        className={`dev-subtab-btn ${activeSubTab === 'approvals' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('approvals')}
                    >
                        <ShieldCheck size={14} />
                        <span>{t('approvals')} ({pendingUsers.length + approvedUsers.length})</span>
                    </button>
                    <button
                        className={`dev-subtab-btn ${activeSubTab === 'audit' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('audit')}
                    >
                        <Terminal size={14} />
                        <span>Audit Logs</span>
                    </button>
                    <button
                        className={`dev-subtab-btn ${activeSubTab === 'feedbacks' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('feedbacks')}
                    >
                        <MessageSquare size={14} />
                        <span>{language === 'tr' ? 'Geri Bildirimler' : 'Feedbacks'} ({feedbacks.length})</span>
                    </button>
                    <button
                        className={`dev-subtab-btn ${activeSubTab === 'system' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('system')}
                    >
                        <Settings2 size={14} />
                        <span>{language === 'tr' ? 'Sistem Ayarları' : 'System Control'}</span>
                    </button>
                </div>
            )}

            {/* Content: Approvals / User Management */}
            {userRole === 'developer' && activeSubTab === 'approvals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* Section: Pending Approvals */}
                    <div className="dev-portal-section-card">
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                            {language === 'tr' ? 'BEKLEYEN ÜYE ONAYLARI' : 'PENDING APPROVALS'} ({pendingUsers.length})
                        </h4>
                        {pendingUsers.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                                No pending user registrations at the moment.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {pendingUsers.map(user => (
                                    <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px', padding: '0.45rem 0.65rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{user.username}</span>
                                            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                                                Role Requested: <span className={getRoleClass(user.role)} style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem', marginLeft: '0.2rem' }}>{t(`role_${user.role}` as TranslationKey) || user.role}</span>
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button className="btn btn-secondary text-negative" onClick={() => onRejectUser(user.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                <Ban size={10} />
                                                <span>{t('reject')}</span>
                                            </button>
                                            <button className="btn btn-primary" onClick={() => onApproveUser(user.id, 'member')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                <Check size={10} />
                                                <span>{t('approve')}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section: Active Users List */}
                    <div className="dev-portal-section-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {language === 'tr' ? 'SİSTEM KULLANICILARI' : 'ACTIVE USERS LIST'} ({approvedUsers.length})
                            </h4>
                            <div style={{ position: 'relative', width: '200px' }}>
                                <Search size={11} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder={t('search_user_placeholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '0.25rem 0.4rem 0.25rem 1.5rem', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '15px', color: '#fff', outline: 'none' }}
                                />
                            </div>
                        </div>

                        {approvedUsers.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                                No users matched your search criteria.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                {paginatedUsers.map(user => (
                                    <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px', padding: '0.45rem 0.65rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{user.username}</span>
                                            <span className={getRoleClass(user.role)} style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem' }}>
                                                {t(`role_${user.role}` as TranslationKey) || user.role}
                                            </span>
                                            {user.status === 'rejected' && (
                                                <span style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                    Rejected
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            {user.status === 'approved' && user.role !== 'developer' && (
                                                <div style={{ width: '135px' }}>
                                                    <CustomSelect
                                                        value={user.role}
                                                        onChange={(val) => onUpdateUserRole(user.id, val as UserRole)}
                                                        options={[
                                                            { value: 'recruit', label: t('role_recruit') || 'Recruit Member' },
                                                            { value: 'member', label: t('role_member') || 'Member' },
                                                            { value: 'officer', label: t('role_officer') || 'Officer' },
                                                            { value: 'logistics_lead', label: t('role_logistics_lead') || 'Logistics Lead' }
                                                        ]}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}>
                                    <span>{t('previous')}</span>
                                </button>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}>
                                    <span>{t('next')}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {((userRole === 'developer' && activeSubTab === 'audit') || userRole === 'officer' || userRole === 'logistics_lead') && (
                <div style={{ marginTop: '0.25rem' }}>
                    <AuditLogTab logs={auditLogs} onClearLogs={userRole === 'developer' ? onClearAuditLogs : undefined} />
                </div>
            )}

            {/* Content: Feedback Inbox */}
            {userRole === 'developer' && activeSubTab === 'feedbacks' && (
                <div className="dev-portal-section-card">
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                        {language === 'tr' ? 'GERİ BİLDİRİM VE HATA İHBAR KUTUSU' : 'FEEDBACK & BUG REPORTS'} ({feedbacks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '350px', overflowY: 'auto' }}>
                        {feedbacks.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '1rem 0', textAlign: 'center' }}>
                                {language === 'tr' ? 'Henüz gönderilmiş bir geri bildirim yok.' : 'No feedback or bug reports submitted yet.'}
                            </div>
                        ) : (
                            paginatedFeedbacks.map(fb => (
                                <div key={fb.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '6px', padding: '0.65rem 0.85rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--accent-color)' }}>{fb.username}</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                                {new Date(fb.created_at).toLocaleString()}
                                            </span>
                                            {fb.category === 'bug' ? (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>Bug</span>
                                            ) : (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(249,115,22,0.05)', color: 'var(--accent-color)', border: '1px solid rgba(249,115,22,0.15)', fontWeight: 600 }}>Idea</span>
                                            )}
                                            {fb.status === 'completed' && (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 600 }}>Done</span>
                                            )}
                                            {fb.status === 'in_progress' && (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600 }}>In Progress</span>
                                            )}
                                        </div>
                                        {onDeleteFeedback && (
                                            <div>
                                                {confirmDeleteId === fb.id ? (
                                                    <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                                        <button className="btn btn-secondary" onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.1rem 0.3rem', fontSize: '0.56rem' }}>No</button>
                                                        <button className="btn btn-danger" onClick={() => { onDeleteFeedback(fb.id); setConfirmDeleteId(null); }} style={{ padding: '0.1rem 0.3rem', fontSize: '0.56rem' }}>Yes</button>
                                                    </div>
                                                ) : (
                                                    <button className="btn-dismiss-action" onClick={() => setConfirmDeleteId(fb.id)} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4, textAlign: 'left' }}>
                                        {fb.message}
                                    </p>
                                    {onUpdateFeedbackStatus && (
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.35rem' }}>
                                            {fb.status !== 'in_progress' && (
                                                <button className="btn btn-secondary" onClick={() => onUpdateFeedbackStatus(fb.id, 'in_progress')} style={{ padding: '0.15rem 0.4rem', fontSize: '0.62rem' }}>Set Progress</button>
                                            )}
                                            {fb.status !== 'completed' && (
                                                <button className="btn btn-primary" onClick={() => onUpdateFeedbackStatus(fb.id, 'completed')} style={{ padding: '0.15rem 0.4rem', fontSize: '0.62rem', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' }}>Set Done</button>
                                            )}
                                            {fb.status && fb.status !== 'pending' && (
                                                <button className="btn btn-secondary" onClick={() => onUpdateFeedbackStatus(fb.id, 'pending')} style={{ padding: '0.15rem 0.4rem', fontSize: '0.62rem', opacity: 0.6 }}>Set Pending</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    {feedbacksTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button className="btn btn-secondary" onClick={() => setFeedbackPage(p => Math.max(p - 1, 1))} disabled={feedbackPage === 1} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}>Prev</button>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{feedbackPage} / {feedbacksTotalPages}</span>
                            <button className="btn btn-secondary" onClick={() => setFeedbackPage(p => Math.min(p + 1, feedbacksTotalPages))} disabled={feedbackPage === feedbacksTotalPages} style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}>Next</button>
                        </div>
                    )}
                </div>
            )}

            {/* Content: System Administration & War Tools */}
            {userRole === 'developer' && activeSubTab === 'system' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* Card: Test Depot Tools */}
                    <div className="dev-portal-section-card">
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                            {getLocalTranslation('test_depots')}
                        </h4>
                        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {getLocalTranslation('test_depots_desc')}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onGenerateTestDepotsSet1}
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.72rem', fontWeight: 700, background: '#10b981', color: '#000', border: 'none' }}
                            >
                                {language === 'tr' ? 'Test Deposu Yükle (Set 1 - 7 Günlük İlk Durum)' : 'Load Test Depots (Set 1 - Baseline)'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={onGenerateTestDepotsSet2}
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.72rem', fontWeight: 700, background: '#f59e0b', color: '#000', border: 'none' }}
                            >
                                {language === 'tr' ? 'Test Deposu Güncelle (Set 2 - Hızlı Tüketim & Azalış)' : 'Update Test Depots (Set 2 - Consumption)'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary text-negative"
                                onClick={onDeleteTestDepots}
                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.72rem' }}
                            >
                                {language === 'tr' ? 'Test Depolarını Temizle' : 'Clear Test Depots'}
                            </button>
                        </div>

                        <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {language === 'tr' 
                                ? `Aktif test deposu sayısı: ${Object.keys(depots || {}).filter(k => k.startsWith('TEST-')).length}` 
                                : `Active test depots in DB: ${Object.keys(depots || {}).filter(k => k.startsWith('TEST-')).length}`}
                        </div>
                    </div>

                    {/* Card: Version Control & Forced Update (YENİLİK - Version Check) */}
                    <div className="dev-portal-section-card" style={{ borderLeft: '3px solid var(--accent-color)', background: 'rgba(249, 115, 22, 0.01)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                            {getLocalTranslation('version_title')}
                        </h4>
                        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {getLocalTranslation('version_desc')}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                    {getLocalTranslation('min_req_version')}
                                </span>
                                <input
                                    type="text"
                                    value={tempMinVersion}
                                    onChange={(e) => setTempMinVersion(e.target.value)}
                                    placeholder="0.1.62"
                                    style={{
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        padding: '0.35rem 0.5rem',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.75rem',
                                        width: '130px',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSaveMinVersion}
                                disabled={isSavingVersion}
                                style={{ padding: '0.45rem 1rem', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                                {isSavingVersion 
                                    ? getLocalTranslation('saving')
                                    : getLocalTranslation('update_version')}
                            </button>
                        </div>
                    </div>

                    {/* Card: War Control Center & Leaderboard Reset (Migrated Feature) */}
                    <div className="dev-portal-section-card" style={{ borderLeft: '3px solid #ef4444', background: 'rgba(239, 68, 68, 0.01)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>
                            {getLocalTranslation('war_control')}
                        </h4>
                        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {getLocalTranslation('war_control_desc')}
                        </p>

                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setIsResetModalOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1rem', fontSize: '0.72rem', borderRadius: '4px', fontWeight: 700, background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                        >
                            <Trash2 size={13} />
                            {getLocalTranslation('reset_leaderboard')}
                        </button>
                    </div>
                </div>
            )}

            {/* Savaş Sıfırlama Onay Modalı */}
            {isResetModalOpen && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10000,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem'
                    }}
                >
                    <div 
                        className="panel-card anim-scale-in" 
                        style={{
                            maxWidth: '450px',
                            width: '100%',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            background: 'rgba(15, 15, 20, 0.98)',
                            border: '1px solid var(--border-color)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                            <AlertTriangle size={24} style={{ color: 'var(--color-negative, #ef4444)' }} />
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                                {getLocalTranslation('reset_warning_title')}
                            </h3>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {getLocalTranslation('reset_warning_body')}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', fontSize: '0.68rem', color: '#f59e0b' }}>
                            <Shield size={14} />
                            <span>{getLocalTranslation('developer_only')}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setIsResetModalOpen(false)}
                                disabled={isResetting}
                                style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px' }}
                            >
                                {getLocalTranslation('cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleConfirmReset}
                                disabled={isResetting}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px', fontWeight: 600, background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                            >
                                {isResetting ? (
                                    <RefreshCw size={14} className="anim-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                                {getLocalTranslation('confirm_reset')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Sürüm Güncelleme Onay Modalı */}
            {isVersionModalOpen && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10000,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1.5rem'
                    }}
                >
                    <div 
                        className="panel-card anim-scale-in" 
                        style={{
                            maxWidth: '450px',
                            width: '100%',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            background: 'rgba(15, 15, 20, 0.98)',
                            border: '1px solid var(--border-color)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                            <AlertTriangle size={24} style={{ color: 'var(--color-negative, #ef4444)' }} />
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                                {getLocalTranslation('confirm_version_title')}
                            </h3>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {getLocalTranslation('confirm_version_body')}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setIsVersionModalOpen(false)}
                                style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px' }}
                            >
                                {getLocalTranslation('cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={handleConfirmSaveMinVersion}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px', fontWeight: 600, background: 'var(--accent-color)', borderColor: 'var(--accent-color)', color: '#000' }}
                            >
                                {getLocalTranslation('confirm_update')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

DeveloperPortalModal.displayName = 'DeveloperPortalTab';
