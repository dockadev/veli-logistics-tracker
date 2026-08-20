import React, { useState, useMemo } from 'react';
import {
    Search, Check, Ban, ShieldAlert,
    ShieldCheck, RotateCw, Trash2, RefreshCw,
    AlertTriangle, Shield, MessageSquare,
    Terminal, Settings2, Users, Sparkles
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
    onRefreshUsers?: () => void | Promise<void>;
    onResetLeaderboard: () => Promise<void>;
    minAppVersion?: string;
    onUpdateMinAppVersion?: (version: string) => Promise<void>;
}

type SubTab = 'approvals' | 'audit' | 'feedbacks' | 'system';
type SortKey = 'name_asc' | 'name_desc' | 'newest' | 'oldest';

function clanHue(clan: string): number {
    let hash = 0;
    for (let i = 0; i < clan.length; i++) {
        hash = (hash * 31 + clan.charCodeAt(i)) % 360;
    }
    return hash;
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
    onRefreshUsers,
    onResetLeaderboard,
    minAppVersion = '0.1.60',
    onUpdateMinAppVersion,
}) => {
    const { t, language } = useLanguage();
    const isDev = userRole === 'developer';
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('approvals');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;
    const [sortKey, setSortKey] = useState<SortKey>('name_asc');

    const [feedbackPage, setFeedbackPage] = useState(1);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [tempMinVersion, setTempMinVersion] = useState(minAppVersion);
    const [isSavingVersion, setIsSavingVersion] = useState(false);
    const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

    React.useEffect(() => {
        setTempMinVersion(minAppVersion);
    }, [minAppVersion]);

    const localTranslations: Record<string, Record<string, string>> = {
        tr: {
            war_control: 'SAVAŞ YÖNETİMİ & KONTROLÜ',
            war_control_desc: 'Savaş sıfırlama ve liderlik istatistiklerini temizleme araçları.',
            reset_leaderboard: 'Savaş İstatistiklerini Sıfırla',
            reset_warning_title: 'SAVAŞ SIFIRLAMA ONAYI',
            reset_warning_body: 'Bu işlem, mevcut savaştaki tüm üyelerin liderlik tablosu istatistiklerini (CSV import, talep açma ve teslimat sayıları) kalıcı olarak sıfırlayacaktır. Yeni savaşa geçerken bu işlemi onaylıyor musunuz?',
            cancel: 'İptal',
            confirm_reset: 'Evet, Sıfırla',
            developer_only: 'Bu işlem sadece Geliştirici (Developer) yetkisine özeldir.',
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
            war_control_desc: 'War reset and leaderboard stats clearing tools.',
            reset_leaderboard: 'Reset War Stats',
            reset_warning_title: 'WAR RESET CONFIRMATION',
            reset_warning_body: 'This action will permanently reset all members\' leaderboard statistics (CSV imports, requests created, and deliveries completed) for the current war. Do you confirm this action for the new war?',
            cancel: 'Cancel',
            confirm_reset: 'Yes, Reset',
            developer_only: 'This action is restricted to the Developer role only.',
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
    }, [searchTerm, activeSubTab, sortKey]);

    const paginatedFeedbacks = useMemo(() => {
        return feedbacks.slice((feedbackPage - 1) * 5, feedbackPage * 5);
    }, [feedbacks, feedbackPage]);

    const feedbacksTotalPages = Math.ceil(feedbacks.length / 5);

    const [roleFilter, setRoleFilter] = useState<string>('all');

    const pendingUsers = useMemo(() => {
        return users.filter(u => u.status === 'pending');
    }, [users]);

    const filteredUsers = useMemo(() => {
        let list = users;
        if (roleFilter === 'pending') {
            list = list.filter(u => u.status === 'pending');
        } else if (roleFilter === 'rejected') {
            list = list.filter(u => u.status === 'rejected');
        } else if (roleFilter !== 'all') {
            list = list.filter(u => u.status === 'approved' && u.role === roleFilter);
        } else {
            list = list.filter(u => u.status === 'approved' || u.status === 'rejected');
        }

        const term = searchTerm.toLowerCase().trim();
        if (term) {
            list = list.filter(u => u.username.toLowerCase().includes(term) || (u.clan || '').toLowerCase().includes(term));
        }

        const sorted = [...list];
        switch (sortKey) {
            case 'name_asc':
                sorted.sort((a, b) => a.username.localeCompare(b.username));
                break;
            case 'name_desc':
                sorted.sort((a, b) => b.username.localeCompare(a.username));
                break;
            case 'newest':
                sorted.sort((a, b) => (b.approvedAt || '').localeCompare(a.approvedAt || ''));
                break;
            case 'oldest':
                sorted.sort((a, b) => (a.approvedAt || '').localeCompare(b.approvedAt || ''));
                break;
        }
        return sorted;
    }, [users, roleFilter, searchTerm, sortKey]);

    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * usersPerPage;
        return filteredUsers.slice(startIndex, startIndex + usersPerPage);
    }, [filteredUsers, currentPage]);

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

    const formatApprovedDate = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const tabItems: { key: SubTab; label: string; icon: React.ReactNode; badge?: number; devOnly?: boolean }[] = [
        { key: 'approvals', label: language === 'tr' ? 'Onaylar' : 'Approvals', icon: <ShieldCheck size={14} />, badge: pendingUsers.length },
        { key: 'audit', label: 'Audit Logs', icon: <Terminal size={14} /> },
        { key: 'feedbacks', label: language === 'tr' ? 'Geri Bildirimler' : 'Feedbacks', icon: <MessageSquare size={14} />, badge: feedbacks.length },
        { key: 'system', label: language === 'tr' ? 'Sistem Kontrolü' : 'System Control', icon: <Settings2 size={14} />, devOnly: true }
    ];

    return (
        <div className="panel-card anim-fade-in" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-card, rgba(15, 15, 20, 0.45))', backdropFilter: 'blur(12px)' }}>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes slideFadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 0 rgba(249, 115, 22, 0); }
                    50% { box-shadow: 0 0 12px rgba(249, 115, 22, 0.15); }
                }
                .dev-subtab-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
                    padding: 0.55rem 0.75rem;
                    font-size: 0.72rem;
                    font-weight: 700;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.01);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .dev-subtab-btn:hover {
                    background: rgba(255, 255, 255, 0.04);
                    color: var(--text-primary);
                    transform: translateY(-1px);
                }
                .dev-subtab-btn.active {
                    background: linear-gradient(135deg, rgba(249, 115, 22, 0.16), rgba(249, 115, 22, 0.04));
                    border-color: rgba(249, 115, 22, 0.35);
                    color: var(--accent-color);
                    animation: glowPulse 2.4s ease-in-out infinite;
                }
                .dev-subtab-badge {
                    min-width: 16px;
                    height: 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    border-radius: 8px;
                    background: rgba(239, 68, 68, 0.18);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    font-size: 0.56rem;
                    font-weight: 800;
                }
                .dev-portal-section-card {
                    background: rgba(255, 255, 255, 0.012);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                    padding: 1rem;
                    animation: slideFadeIn 0.3s ease both;
                    transition: border-color 0.2s ease;
                }
                .dev-portal-section-card:hover {
                    border-color: rgba(255, 255, 255, 0.08);
                }
                .dev-action-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.3rem 0.6rem;
                    font-size: 0.65rem;
                    font-weight: 700;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .dev-action-btn:hover {
                    transform: translateY(-1px);
                }
                .dev-action-btn:active {
                    transform: translateY(0);
                }
                .dev-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.4rem 0.6rem;
                    background: rgba(255, 255, 255, 0.012);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 7px;
                    transition: background 0.15s ease, border-color 0.15s ease;
                }
                .dev-row:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.08);
                }
                .dev-avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.62rem;
                    font-weight: 800;
                    color: #000;
                    flex-shrink: 0;
                    background: linear-gradient(135deg, #f97316, #fb923c);
                }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.3))' }} />
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                        {isDev ? t('developer_portal') : userRole === 'logistics_lead' ? 'Logistics Lead Panel' : 'Officer Control Panel'}
                    </h3>
                </div>
                {isDev && onRefreshUsers && (
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
                        <RotateCw size={14} style={{ animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none', color: 'var(--text-secondary)' }} />
                    </button>
                )}
            </div>

            <p className="help-text" style={{ marginBottom: '1.25rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isDev
                    ? t('developer_portal_desc')
                    : userRole === 'logistics_lead'
                    ? 'Access member approvals, active accounts, logistics audit logs and feedback.'
                    : 'Access member approvals, active accounts, security logs and feedback.'}
            </p>

            <div className="dev-subtab-grid">
                {tabItems.filter(item => !item.devOnly || isDev).map((item, idx) => (
                    <button
                        key={item.key}
                        className={`dev-subtab-btn ${activeSubTab === item.key ? 'active' : ''}`}
                        onClick={() => setActiveSubTab(item.key)}
                        style={{ animation: `slideFadeIn 0.3s ease ${idx * 0.05}s both` }}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="dev-subtab-badge">{item.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* APPROVALS / USER MANAGEMENT */}
            {activeSubTab === 'approvals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="dev-portal-section-card">
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                            {language === 'tr' ? 'BEKLEYEN ÜYE ONAYLARI' : 'PENDING APPROVALS'} ({pendingUsers.length})
                        </h4>
                        {pendingUsers.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                                No pending user registrations at the moment.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '240px', overflowY: 'auto' }}>
                                {pendingUsers.map(user => (
                                    <div key={user.id} className="dev-row" style={{ justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                            <div className="dev-avatar">{user.username.charAt(0).toUpperCase()}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.username}</span>
                                                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                                                    Role Requested: <span className={getRoleClass(user.role)} style={{ fontSize: '0.58rem', padding: '0.08rem 0.3rem', marginLeft: '0.2rem' }}>{t(`role_${user.role}` as TranslationKey) || user.role}</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                            <button className="dev-action-btn text-negative" onClick={() => onRejectUser(user.id)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
                                                <Ban size={10} />
                                                <span>{t('reject')}</span>
                                            </button>
                                            <button className="dev-action-btn" onClick={() => onApproveUser(user.id, 'member')} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                                                <Check size={10} />
                                                <span>{t('approve')}</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="dev-portal-section-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                <Users size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--accent-color)' }} />
                                {language === 'tr' ? 'SİSTEM KULLANICILARI' : 'ACTIVE USERS LIST'} ({filteredUsers.length})
                            </h4>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', width: '170px' }}>
                                    <Search size={11} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder={t('search_user_placeholder')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ width: '100%', padding: '0.3rem 0.5rem 0.3rem 1.5rem', fontSize: '0.68rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '15px', color: 'var(--text-primary)', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ width: '165px' }}>
                                    <CustomSelect
                                        value={sortKey}
                                        onChange={(val) => setSortKey(val as SortKey)}
                                        options={[
                                            { value: 'name_asc', label: language === 'tr' ? 'İsim (A-Z)' : 'Name (A-Z)' },
                                            { value: 'name_desc', label: language === 'tr' ? 'İsim (Z-A)' : 'Name (Z-A)' },
                                            { value: 'newest', label: language === 'tr' ? 'Yeni Onaylanan' : 'Newest Approved' },
                                            { value: 'oldest', label: language === 'tr' ? 'Eski Onaylanan' : 'Oldest Approved' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            {['all', 'pending', 'developer', 'logistics_lead', 'officer', 'member', 'recruit', 'rejected'].map(rKey => {
                                const count = rKey === 'all'
                                    ? users.filter(u => u.status === 'approved' || u.status === 'rejected').length
                                    : rKey === 'pending'
                                    ? users.filter(u => u.status === 'pending').length
                                    : rKey === 'rejected'
                                    ? users.filter(u => u.status === 'rejected').length
                                    : users.filter(u => u.role === rKey && u.status === 'approved').length;

                                return (
                                    <button
                                        key={rKey}
                                        onClick={() => { setRoleFilter(rKey); setCurrentPage(1); }}
                                        style={{
                                            padding: '0.2rem 0.55rem',
                                            fontSize: '0.62rem',
                                            fontWeight: 700,
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            background: roleFilter === rKey ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                                            color: roleFilter === rKey ? '#000000' : 'var(--text-secondary)',
                                            border: roleFilter === rKey ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {rKey === 'all' ? (language === 'tr' ? 'HEPSİ' : 'ALL') : (rKey === 'pending' ? 'Pending' : rKey === 'rejected' ? 'Rejected' : (t(`role_${rKey}` as TranslationKey) || rKey.toUpperCase()))} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {filteredUsers.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>
                                No users matched your search criteria.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {paginatedUsers.map(user => (
                                    <div key={user.id} className="dev-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                            <div className="dev-avatar">{user.username.charAt(0).toUpperCase()}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{user.username}</span>
                                                    {user.clan ? (
                                                        <span style={{
                                                            fontSize: '0.56rem',
                                                            fontWeight: 800,
                                                            padding: '0.08rem 0.35rem',
                                                            borderRadius: '4px',
                                                            background: `hsla(${clanHue(user.clan)}, 70%, 50%, 0.18)`,
                                                            color: `hsl(${clanHue(user.clan)}, 80%, 65%)`,
                                                            border: `1px solid hsla(${clanHue(user.clan)}, 70%, 55%, 0.35)`,
                                                            letterSpacing: '0.03em'
                                                        }}>
                                                            {user.clan.toUpperCase()}
                                                        </span>
                                                    ) : null}
                                                    <span className={getRoleClass(user.role)} style={{ fontSize: '0.56rem', padding: '0.07rem 0.3rem' }}>
                                                        {t(`role_${user.role}` as TranslationKey) || user.role}
                                                    </span>
                                                    {user.status === 'rejected' && (
                                                        <span style={{ fontSize: '0.56rem', padding: '0.07rem 0.3rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                            Rejected
                                                        </span>
                                                    )}
                                                </div>
                                                {user.approvedAt && (
                                                    <span style={{ fontSize: '0.58rem', color: '#cbd5e1' }}>
                                                        {language === 'tr' ? 'Onay: ' : 'Approved: '}{formatApprovedDate(user.approvedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            {user.status === 'approved' && user.role !== 'developer' && isDev && (
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

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>
                                    {t('previous')}
                                </button>
                                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {currentPage} / {totalPages}
                                </span>
                                <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>
                                    {t('next')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AUDIT */}
            {activeSubTab === 'audit' && (
                <div style={{ marginTop: '0.25rem' }}>
                    <AuditLogTab logs={auditLogs} onClearLogs={isDev ? onClearAuditLogs : undefined} />
                </div>
            )}

            {/* FEEDBACKS */}
            {activeSubTab === 'feedbacks' && (
                <div className="dev-portal-section-card">
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                        {language === 'tr' ? 'GERİ BİLDİRİM VE HATA İHBAR KUTUSU' : 'FEEDBACK & BUG REPORTS'} ({feedbacks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '420px', overflowY: 'auto' }}>
                        {feedbacks.length === 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '1rem 0', textAlign: 'center' }}>
                                {language === 'tr' ? 'Henüz gönderilmiş bir geri bildirim yok.' : 'No feedback or bug reports submitted yet.'}
                            </div>
                        ) : (
                            paginatedFeedbacks.map(fb => (
                                <div
                                    key={fb.id}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.45rem',
                                        background: 'rgba(255,255,255,0.012)',
                                        border: '1px solid rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        padding: '0.7rem 0.85rem',
                                        transition: 'border-color 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.03)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                            <div className="dev-avatar" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>{fb.username.charAt(0).toUpperCase()}</div>
                                            <span style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--accent-color)' }}>{fb.username}</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                                {new Date(fb.created_at).toLocaleString()}
                                            </span>
                                            {fb.category === 'bug' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 700 }}>
                                                    <AlertTriangle size={9} /> Bug
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(249,115,22,0.08)', color: 'var(--accent-color)', border: '1px solid rgba(249,115,22,0.18)', fontWeight: 700 }}>
                                                    <Sparkles size={9} /> Idea
                                                </span>
                                            )}
                                            {fb.status === 'completed' && (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 700 }}>Done</span>
                                            )}
                                            {fb.status === 'in_progress' && (
                                                <span style={{ fontSize: '0.56rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 700 }}>In Progress</span>
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
                            <button className="btn btn-secondary" onClick={() => setFeedbackPage(p => Math.max(p - 1, 1))} disabled={feedbackPage === 1} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>Prev</button>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{feedbackPage} / {feedbacksTotalPages}</span>
                            <button className="btn btn-secondary" onClick={() => setFeedbackPage(p => Math.min(p + 1, feedbacksTotalPages))} disabled={feedbackPage === feedbacksTotalPages} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>Next</button>
                        </div>
                    )}
                </div>
            )}

            {/* SYSTEM */}
            {activeSubTab === 'system' && isDev && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Card: Version Control */}
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
                                    placeholder="0.2.0"
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
                                onClick={() => {
                                    if (!onUpdateMinAppVersion || !tempMinVersion.trim()) return;
                                    setIsVersionModalOpen(true);
                                }}
                                disabled={isSavingVersion}
                                style={{ padding: '0.45rem 1rem', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                                {isSavingVersion
                                    ? getLocalTranslation('saving')
                                    : getLocalTranslation('update_version')}
                            </button>
                        </div>
                    </div>

                    {/* Card: War Control Center */}
                    <div className="dev-portal-section-card" style={{ borderLeft: '3px solid #ef4444', background: 'rgba(239, 68, 68, 0.01)' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>
                            {getLocalTranslation('war_control')}
                        </h4>
                        <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {getLocalTranslation('war_control_desc')}
                        </p>

                        <button
                            type="button"
                            className="dev-action-btn"
                            onClick={() => setIsResetModalOpen(true)}
                            style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                        >
                            <Trash2 size={13} />
                            {getLocalTranslation('reset_leaderboard')}
                        </button>
                    </div>
                </div>
            )}

            {/* War Reset Confirmation Modal */}
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
                            <AlertTriangle size={24} style={{ color: '#ef4444' }} />
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
                            <button type="button" className="btn btn-secondary" onClick={() => setIsResetModalOpen(false)} disabled={isResetting} style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px' }}>
                                {getLocalTranslation('cancel')}
                            </button>
                            <button type="button" className="btn btn-danger" onClick={handleConfirmReset} disabled={isResetting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px', fontWeight: 600, background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}>
                                {isResetting ? <RefreshCw size={14} className="anim-spin" /> : <Trash2 size={14} />}
                                {getLocalTranslation('confirm_reset')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Version Update Confirmation Modal */}
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
                            <AlertTriangle size={24} style={{ color: '#ef4444' }} />
                            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                                {getLocalTranslation('confirm_version_title')}
                            </h3>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {getLocalTranslation('confirm_version_body')}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsVersionModalOpen(false)} style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', borderRadius: '15px' }}>
                                {getLocalTranslation('cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={async () => {
                                    if (!onUpdateMinAppVersion) return;
                                    setIsVersionModalOpen(false);
                                    setIsSavingVersion(true);
                                    try {
                                        await onUpdateMinAppVersion(tempMinVersion);
                                    } finally {
                                        setIsSavingVersion(false);
                                    }
                                }}
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
