import React, { useState, useMemo } from 'react';
import { Clock, Search, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { AuditLogEntry } from '../types';

interface AuditLogTabProps {
    logs: AuditLogEntry[];
    onClearLogs?: () => void;
}

const ROLE_FIX: Record<string, string> = {
    logistics_lead: 'Logistics Lead',
    officer: 'Officer',
    developer: 'Developer',
    member: 'Member',
    recruit: 'Recruit'
};

export const AuditLogTab: React.FC<AuditLogTabProps> = React.memo(({ logs, onClearLogs }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 30;

    const sanitizedLogs = useMemo(() => {
        return logs.filter(log => log && log.username && log.action && log.action.trim() !== '');
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return sanitizedLogs;
        return sanitizedLogs.filter(log =>
            log.username.toLowerCase().includes(term) ||
            log.action.toLowerCase().includes(term) ||
            log.role.toLowerCase().includes(term)
        );
    }, [sanitizedLogs, searchTerm]);

    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * logsPerPage;
        return filteredLogs.slice(startIndex, startIndex + logsPerPage);
    }, [filteredLogs, currentPage]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, logs.length]);

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

    const formatTimestamp = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '160px', maxWidth: '260px' }}>
                    <Search size={11} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder={t('search_logs_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.3rem 0.5rem 0.3rem 1.5rem',
                            fontSize: '0.68rem',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '15px',
                            color: 'var(--text-primary)',
                            outline: 'none'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {filteredLogs.length} logs
                    </span>
                    {onClearLogs && logs.length > 0 && (
                        <button
                            className="btn btn-secondary text-negative"
                            onClick={onClearLogs}
                            type="button"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
                        >
                            {t('clear') || 'Clear'}
                        </button>
                    )}
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    <FileText size={22} />
                    <p style={{ margin: 0, fontSize: '0.72rem' }}>{t('no_audit_logs')}</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {paginatedLogs.map(log => (
                            <div
                                key={log.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.32rem 0.6rem',
                                    background: 'rgba(255,255,255,0.012)',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    borderRadius: '5px',
                                    transition: 'background 0.15s ease, border-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.012)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.03)';
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0, width: '86px' }}>
                                    <Clock size={9} />
                                    {formatTimestamp(log.timestamp)}
                                </span>
                                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {log.username}
                                </span>
                                <span className={getRoleClass(log.role)} style={{ fontSize: '0.52rem', padding: '0.05rem 0.28rem', flexShrink: 0 }}>
                                    {ROLE_FIX[log.role] || log.role}
                                </span>
                                <span style={{
                                    fontSize: '0.64rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    minWidth: 0,
                                    flex: 1
                                }} title={log.action}>
                                    {log.action
                                        .replace(/\blogistics_lead\b/g, 'Logistics Lead')
                                        .replace(/\bofficer\b/g, 'Officer')
                                        .replace(/\bdeveloper\b/g, 'Developer')
                                        .replace(/\bmember\b/g, 'Member')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>
                                {t('previous') || 'Prev'}
                            </button>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.2rem 0.45rem', fontSize: '0.62rem' }}>
                                {t('next') || 'Next'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

AuditLogTab.displayName = 'AuditLogTab';
