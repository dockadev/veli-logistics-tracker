import React, { useState } from 'react';
import { Megaphone, X, Send } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

interface AnnouncementModalProps {
    isOpen: boolean;
    onPublish: (title: string, content: string, severity: 'normal' | 'high' | 'critical') => void;
    onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = React.memo(({
    isOpen,
    onPublish,
    onClose,
}) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [severity, setSeverity] = useState<'normal' | 'high' | 'critical'>('normal');

    if (!isOpen) return null;

    const handlePublish = () => {
        const text = content.trim();
        const header = title.trim();
        if (!text || !header) return;
        onPublish(header, text, severity);
        setTitle('');
        setContent('');
        setSeverity('normal');
        onClose();
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '480px', width: '95%' }}
                >
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Megaphone size={18} style={{ color: 'var(--accent-color)' }} />
                            <h3>{t('post_announcement')}</h3>
                        </div>
                        <button className="modal-close" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="announcementTitle">{t('announcement_title')}</label>
                            <input
                                id="announcementTitle"
                                type="text"
                                placeholder={t('announcement_title_placeholder')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.75rem',
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#fff',
                                    outline: 'none',
                                    fontSize: '0.85rem',
                                    marginBottom: '1rem'
                                }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('severity')}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {(['normal', 'high', 'critical'] as const).map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setSeverity(level)}
                                        style={{
                                            flex: 1,
                                            padding: '0.45rem 0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            border: severity === level 
                                                ? level === 'critical' ? '1px solid #ef4444' : level === 'high' ? '1px solid #f97316' : '1px solid var(--accent-color)'
                                                : '1px solid var(--border-color)',
                                            background: severity === level
                                                ? level === 'critical' ? 'rgba(239, 68, 68, 0.15)' : level === 'high' ? 'rgba(249, 115, 22, 0.15)' : 'var(--accent-bg)'
                                                : 'rgba(255, 255, 255, 0.02)',
                                            color: severity === level
                                                ? level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : 'var(--accent-color)'
                                                : 'var(--text-secondary)'
                                        }}
                                    >
                                        {t(`severity_${level}` as TranslationKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="announcementText">{t('announcement_content')}</label>
                            <textarea
                                id="announcementText"
                                placeholder={t('announcement_placeholder')}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '120px',
                                    padding: '0.75rem',
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#fff',
                                    outline: 'none',
                                    fontSize: '0.85rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>
                            {t('confirm_cancel')}
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handlePublish}
                            disabled={!content.trim() || !title.trim()}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Send size={13} />
                            <span>{t('publish')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

AnnouncementModal.displayName = 'AnnouncementModal';
