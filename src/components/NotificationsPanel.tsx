import React, { useState } from 'react';
import { X, Bell, Megaphone, PlusCircle, CheckCircle, AlertTriangle, Trash2, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { SystemNotification } from '../types';

interface NotificationsPanelProps {
    isOpen: boolean;
    notifications: SystemNotification[];
    onMarkAllRead: () => void;
    onClearAll: () => void;
    onClose: () => void;
    onDeleteNotification: (id: string) => void;
    title?: string;
    icon?: React.ReactNode;
    onClickNotification?: (notif: SystemNotification) => void;
}

interface NotificationItemProps {
    notif: SystemNotification;
    onDelete: (id: string) => void;
    getNotificationIcon: (type: string) => React.ReactNode;
    onClickNotification?: (notif: SystemNotification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = React.memo(({ notif, onDelete, getNotificationIcon, onClickNotification }) => {
    const { t } = useLanguage();
    const [translateX, setTranslateX] = useState(0);
    const [isSwipedOut, setIsSwipedOut] = useState(false);
    const startXRef = React.useRef<number | null>(null);
    const currentTranslateXRef = React.useRef<number>(0);
    const isDraggingRef = React.useRef(false);

    const handleDragStart = (clientX: number) => {
        startXRef.current = clientX;
        isDraggingRef.current = true;
    };

    const handleDragMove = (clientX: number) => {
        if (!isDraggingRef.current || startXRef.current === null) return;
        const diffX = clientX - startXRef.current;
        // Only allow swiping left (negative translateX)
        if (diffX < 0) {
            // Add resistance limit
            const newX = Math.max(-140, diffX);
            setTranslateX(newX);
            currentTranslateXRef.current = newX;
        } else {
            setTranslateX(0);
            currentTranslateXRef.current = 0;
        }
    };

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        startXRef.current = null;

        // If swiped left past threshold (75px), trigger delete
        if (currentTranslateXRef.current < -75) {
            setIsSwipedOut(true);
            setTranslateX(-450); // Swipe completely out
            setTimeout(() => {
                onDelete(notif.id);
            }, 200);
        } else {
            // Reset position
            setTranslateX(0);
            currentTranslateXRef.current = 0;
        }
    };

    return (
        <div 
            className="notif-item-container"
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-sm)',
                background: translateX < 0 ? '#ff4757' : 'transparent', // Prevent bleeding when idle
                height: isSwipedOut ? 0 : 'auto',
                opacity: isSwipedOut ? 0 : 1,
                transition: isSwipedOut ? 'height 0.2s ease, opacity 0.2s ease, margin 0.2s ease' : 'none',
                marginBottom: isSwipedOut ? 0 : '0.6rem'
            }}
        >
            {/* Background Trash Icon */}
            <div 
                style={{
                    position: 'absolute',
                    right: '1rem',
                    top: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#fff',
                    zIndex: 1,
                    pointerEvents: 'none'
                }}
            >
                <Trash2 size={16} />
            </div>

            {/* Foreground Card */}
            <div
                onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
                onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
                onTouchEnd={handleDragEnd}
                onMouseDown={(e) => handleDragStart(e.clientX)}
                onMouseMove={(e) => {
                    if (e.buttons === 1) handleDragMove(e.clientX);
                }}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onClick={() => {
                    if (Math.abs(translateX) > 5) return;
                    if (onClickNotification) {
                        onClickNotification(notif);
                    }
                }}
                style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    gap: '0.6rem',
                    padding: '0.65rem',
                    background: notif.isRead 
                        ? 'var(--bg-surface)' 
                        : 'linear-gradient(var(--accent-bg), var(--accent-bg)), var(--bg-surface)',
                    borderLeft: notif.isRead ? '2px solid var(--border-color)' : '2px solid var(--accent-color)',
                    borderTop: '1px solid var(--border-color)',
                    borderRight: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    transform: `translate3d(${translateX}px, 0, 0)`,
                    transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backdropFilter: 'blur(10px)',
                    WebkitUserSelect: 'none'
                }}
            >
                <div style={{ marginTop: '0.1rem' }}>
                    {getNotificationIcon(notif.type)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1, pointerEvents: 'none' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: '1.25' }}>
                        {notif.type === 'announcement'
                            ? `${notif.announcementTitle || 'Announcement'} - ${t('click_to_view_content')}`
                            : notif.message}
                    </p>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        </div>
    );
});

NotificationItem.displayName = 'NotificationItem';

export const NotificationsPanel: React.FC<NotificationsPanelProps> = React.memo(({
    isOpen,
    notifications,
    onMarkAllRead,
    onClearAll,
    onClose,
    onDeleteNotification,
    title,
    icon,
    onClickNotification,
}) => {
    const { t } = useLanguage();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    if (!isOpen) return null;

    const displayTitle = title || t('notifications');
    const displayIcon = icon || <Bell size={18} style={{ color: 'var(--accent-color)' }} />;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'announcement':
                return <Megaphone size={14} style={{ color: 'var(--accent-color)' }} />;
            case 'request_created':
                return <PlusCircle size={14} style={{ color: '#06b6d4' }} />;
            case 'request_completed':
                return <CheckCircle size={14} style={{ color: 'var(--color-positive)' }} />;
            case 'critical_stock':
                return <AlertTriangle size={14} style={{ color: '#f97316' }} />;
            default:
                return <Bell size={14} />;
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(notifications.length / itemsPerPage);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedNotifications = notifications.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
    );

    const handlePrevPage = () => {
        setCurrentPage(p => Math.max(1, p - 1));
    };

    const handleNextPage = () => {
        setCurrentPage(p => Math.min(totalPages, p + 1));
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '440px', width: '95%' }}
                >
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {displayIcon}
                            <h3>{displayTitle}</h3>
                        </div>
                        <button className="modal-close" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '0.75rem' }}>
                        {/* Action buttons */}
                        {notifications.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={onMarkAllRead}
                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                    <CheckSquare size={11} />
                                    <span>Mark all read</span>
                                </button>
                                <button 
                                    className="btn btn-secondary text-negative" 
                                    onClick={onClearAll}
                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                    <Trash2 size={11} />
                                    <span>Clear all</span>
                                </button>
                            </div>
                        )}

                        {notifications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                                <p style={{ fontSize: '0.8rem' }}>{t('no_notifications')}</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    {paginatedNotifications.map(notif => (
                                        <NotificationItem
                                            key={notif.id}
                                            notif={notif}
                                            onDelete={onDeleteNotification}
                                            getNotificationIcon={getNotificationIcon}
                                            onClickNotification={onClickNotification}
                                        />
                                    ))}
                                </div>

                                {/* Custom Pagination Controls */}
                                {totalPages > 1 && (
                                    <div 
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            marginTop: '0.85rem',
                                            paddingTop: '0.6rem',
                                            borderTop: '1px solid var(--border-color)',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        <span>
                                            Showing {((activePage - 1) * itemsPerPage) + 1} to {Math.min(activePage * itemsPerPage, notifications.length)} of {notifications.length}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button 
                                                className="btn btn-secondary" 
                                                style={{ padding: '0.15rem 0.35rem', display: 'flex', alignItems: 'center' }}
                                                onClick={handlePrevPage}
                                                disabled={activePage === 1}
                                            >
                                                <ChevronLeft size={12} />
                                            </button>
                                            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.25rem' }}>
                                                {activePage} / {totalPages}
                                            </span>
                                            <button 
                                                className="btn btn-secondary" 
                                                style={{ padding: '0.15rem 0.35rem', display: 'flex', alignItems: 'center' }}
                                                onClick={handleNextPage}
                                                disabled={activePage === totalPages}
                                            >
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%', fontSize: '0.75rem' }}>
                            {t('close')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

NotificationsPanel.displayName = 'NotificationsPanel';
