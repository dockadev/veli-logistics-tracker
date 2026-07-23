import React, { useState } from 'react';
import { Megaphone, X, Send, Pin } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

export type PinDurationType = 'none' | '6h' | '12h' | '1d' | '2d' | '3d' | '1w';

interface AnnouncementModalProps {
    isOpen: boolean;
    onPublish: (title: string, content: string, severity: 'normal' | 'high' | 'critical', pinnedUntil?: string) => void;
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
    const [pinDuration, setPinDuration] = useState<PinDurationType>('none');

    if (!isOpen) return null;

    const handlePublish = () => {
        const text = content.trim();
        const header = title.trim();
        if (!text || !header) return;

        let pinnedUntil: string | undefined = undefined;
        if (pinDuration !== 'none') {
            const now = Date.now();
            let durationMs = 0;
            if (pinDuration === '6h') durationMs = 6 * 60 * 60 * 1000;
            else if (pinDuration === '12h') durationMs = 12 * 60 * 60 * 1000;
            else if (pinDuration === '1d') durationMs = 24 * 60 * 60 * 1000;
            else if (pinDuration === '2d') durationMs = 48 * 60 * 60 * 1000;
            else if (pinDuration === '3d') durationMs = 72 * 60 * 60 * 1000;
            else if (pinDuration === '1w') durationMs = 7 * 24 * 60 * 60 * 1000;
            
            if (durationMs > 0) {
                pinnedUntil = new Date(now + durationMs).toISOString();
            }
        }

        onPublish(header, text, severity, pinnedUntil);
        setTitle('');
        setContent('');
        setSeverity('normal');
        setPinDuration('none');
        onClose();
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '500px', width: '95%' }}
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

                        {/* Pin Duration Selector */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                <Pin size={14} style={{ color: pinDuration !== 'none' ? '#f59e0b' : 'var(--text-secondary)' }} />
                                <span>{t('pin_duration')}</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                                {(['none', '6h', '12h', '1d', '2d', '3d', '1w'] as const).map((dur) => (
                                    <button
                                        key={dur}
                                        type="button"
                                        onClick={() => setPinDuration(dur)}
                                        style={{
                                            padding: '0.4rem 0.25rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            textAlign: 'center',
                                            whiteSpace: 'nowrap',
                                            border: pinDuration === dur
                                                ? '1px solid #f59e0b'
                                                : '1px solid var(--border-color)',
                                            background: pinDuration === dur
                                                ? 'rgba(245, 158, 11, 0.2)'
                                                : 'rgba(255, 255, 255, 0.02)',
                                            color: pinDuration === dur
                                                ? '#f59e0b'
                                                : 'var(--text-secondary)'
                                        }}
                                    >
                                        {t(`pin_${dur}` as TranslationKey)}
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
