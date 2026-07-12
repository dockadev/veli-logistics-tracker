import React, { useState, useMemo } from 'react';
import { Clock, Search, FileText } from 'lucide-react';
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
                return 'badge badge-crate'; // Yellow-Orange/Developer badge
            case 'logistics_lead':
                return 'badge badge-logistics_lead'; // Yellow
            case 'officer':
                return 'badge badge-vehicle'; // Cyan/Officer
            default:
                return 'badge badge-item'; // White/Member
        }
    };

    return (
        <div className="anim-fade-in audit-logs-container">
            <div className="audit-header-panel">
                
                {/* Search Log Input */}
                <div className="audit-search-wrapper">
                    <Search 
                        size={12} 
                        className="audit-search-icon"
                    />
                    <input
                        type="text"
                        placeholder={t('search_logs_placeholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="audit-search-input"
                    />
                </div>

                {onClearLogs && logs.length > 0 && (
                    <button
                        className="btn btn-secondary text-negative audit-clear-btn"
                        onClick={onClearLogs}
                        type="button"
                    >
                        <span>{t('clear') || 'Temizle'}</span>
                    </button>
                )}
            </div>

            {filteredLogs.length === 0 ? (
                <div className="empty-row audit-empty-state">
                    <FileText size={24} className="audit-empty-icon" />
                    <p className="audit-empty-text">{t('no_audit_logs')}</p>
                </div>
            ) : (
                <>
                    <div className="audit-table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>{t('timestamp')}</th>
                                    <th>{t('username')}</th>
                                    <th>{t('role')}</th>
                                    <th>{t('action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log) => (
                                    <tr 
                                        key={log.id} 
                                        className="audit-table-row"
                                    >
                                        <td>
                                            <div className="audit-timestamp-cell">
                                                <Clock size={10} />
                                                <span className="audit-timestamp-time">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 
                                                    <span className="audit-timestamp-date">
                                                        {new Date(log.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="audit-username-cell">{log.username}</td>
                                        <td>
                                            <span className={getRoleClass(log.role)}>
                                                {t(`role_${log.role}` as TranslationKey) || log.role}
                                            </span>
                                        </td>
                                        <td className="audit-action-cell">{(() => {
                                            if (!log.action) return '';
                                            return log.action
                                                .replace(/\blogistics_lead\b/g, 'Logistics Lead')
                                                .replace(/\bofficer\b/g, 'Officer')
                                                .replace(/\bdeveloper\b/g, 'Developer')
                                                .replace(/\bmember\b/g, 'Member');
                                        })()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="audit-pagination">
                            <button
                                className="btn btn-secondary audit-pagination-btn"
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <span>{t('previous') || 'Geri'}</span>
                            </button>
                            <span className="audit-pagination-info">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary audit-pagination-btn"
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
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
