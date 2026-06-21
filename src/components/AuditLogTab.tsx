import React, { useState, useMemo } from 'react';
import { Shield, Clock, Search, FileText } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { AuditLogEntry } from '../types';

interface AuditLogTabProps {
    logs: AuditLogEntry[];
    onClearLogs?: () => void;
}

export const AuditLogTab: React.FC<AuditLogTabProps> = React.memo(({ logs, onClearLogs }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 10;

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
                return 'badge badge-crate'; // Purple theme/Developer badge
            case 'officer':
                return 'badge badge-vehicle'; // Cyan/Officer
            default:
                return 'badge badge-item'; // White/Member
        }
    };

    return (
        <div className="anim-fade-in" style={{ padding: '0.25rem 0' }}>
            <div className="requests-header-panel" style={{ marginBottom: '0.75rem', gap: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <div className="card-header" style={{ border: 'none', padding: 0, gap: '0.4rem', display: 'flex', alignItems: 'center' }}>
                    <Shield size={15} style={{ color: 'var(--accent-color)' }} />
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
                        {t('audit_logs')}
                    </h4>
                </div>
                
                {/* Search Log Input */}
                <div style={{ position: 'relative', width: '220px' }}>
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
                        placeholder={t('search_logs_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.3rem 0.5rem 0.3rem 1.8rem',
                            fontSize: '0.72rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '30px',
                            color: '#fff',
                            outline: 'none'
                        }}
                    />
                </div>

                {onClearLogs && logs.length > 0 && (
                    <button
                        className="btn btn-secondary text-negative"
                        onClick={onClearLogs}
                        style={{
                            fontSize: '0.68rem',
                            padding: '0.3rem 0.65rem',
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            height: '28px',
                            borderRadius: '14px'
                        }}
                        type="button"
                    >
                        <span>{t('clear') || 'Temizle'}</span>
                    </button>
                )}
            </div>

            {filteredLogs.length === 0 ? (
                <div className="empty-row" style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <FileText size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ fontSize: '0.75rem', margin: 0 }}>{t('no_audit_logs')}</p>
                </div>
            ) : (
                <>
                    <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.6 }}>
                                    <th style={{ padding: '0.4rem 0.3rem', fontFamily: 'var(--font-heading)', fontSize: '0.7rem' }}>{t('timestamp')}</th>
                                    <th style={{ padding: '0.4rem 0.3rem', fontFamily: 'var(--font-heading)', fontSize: '0.7rem' }}>{t('username')}</th>
                                    <th style={{ padding: '0.4rem 0.3rem', fontFamily: 'var(--font-heading)', fontSize: '0.7rem' }}>{t('role')}</th>
                                    <th style={{ padding: '0.4rem 0.3rem', fontFamily: 'var(--font-heading)', fontSize: '0.7rem' }}>{t('action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log) => (
                                    <tr 
                                        key={log.id} 
                                        style={{ 
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            transition: 'background-color 0.15s'
                                        }}
                                        className="table-row-hover"
                                    >
                                        <td style={{ padding: '0.45rem 0.3rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <Clock size={10} style={{ opacity: 0.4 }} />
                                                <span style={{ fontSize: '0.68rem' }}>
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 
                                                    <span style={{ opacity: 0.5, marginLeft: '0.2rem' }}>
                                                        {new Date(log.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.45rem 0.3rem', fontWeight: 600 }}>{log.username}</td>
                                        <td style={{ padding: '0.45rem 0.3rem' }}>
                                            <span className={getRoleClass(log.role)} style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem' }}>
                                                {t(`role_${log.role}` as TranslationKey) || log.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.45rem 0.3rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{log.action}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
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
                            >
                                <span>{t('next') || 'İleri'}</span>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

AuditLogTab.displayName = 'AuditLogTab';
