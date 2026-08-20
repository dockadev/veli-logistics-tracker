import React, { useState } from 'react';
import { Megaphone, X, Send, Pin } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';

export type PinDurationType = 'none' | '6h' | '12h' | '1d' | '2d' | '3d' | '1w';

interface AnnouncementModalProps {
    isOpen: boolean;
    onPublish: (title: string, content: string, severity: 'normal' | 'high' | 'critical', pinnedUntil?: string) => void;
    onClose: () => void;
}

const PIN_MS: Record<string, number> = {
    '6h': 21600000,
    '12h': 43200000,
    '1d': 86400000,
    '2d': 172800000,
    '3d': 259200000,
    '1w': 604800000
};

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
        if (pinDuration !== 'none' && PIN_MS[pinDuration]) {
            pinnedUntil = new Date(Date.now() + PIN_MS[pinDuration]).toISOString();
        }

        onPublish(header, text, severity, pinnedUntil);
        setTitle('');
        setContent('');
        setSeverity('normal');
        setPinDuration('none');
        onClose();
    };

    const fieldStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.55rem 0.75rem',
        background: 'var(--input-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        color: 'var(--text-primary)',
        outline: 'none',
        fontSize: '0.82rem',
        transition: 'border-color 0.15s ease, background 0.15s ease'
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div
                    className="modal-container"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '520px', width: '95%', borderRadius: '6px' }}
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
                                style={fieldStyle}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('severity')}</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {(['normal', 'high', 'critical'] as const).map((level) => {
                                    const active = severity === level;
                                    const color = level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : 'var(--accent-color)';
                                    const bg = level === 'critical' ? 'rgba(239, 68, 68, 0.15)' : level === 'high' ? 'rgba(249, 115, 22, 0.15)' : 'var(--accent-bg)';
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setSeverity(level)}
                                            style={{
                                                flex: 1,
                                                padding: '0.45rem 0.5rem',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                border: active ? `1px solid ${color}` : '1px solid var(--border-color)',
                                                background: active ? bg : 'rgba(255, 255, 255, 0.02)',
                                                color: active ? color : 'var(--text-secondary)'
                                            }}
                                        >
                                            {t(`severity_${level}` as TranslationKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                <Pin size={14} style={{ color: pinDuration !== 'none' ? '#f59e0b' : 'var(--text-secondary)' }} />
                                <span>{t('pin_duration')}</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                                {(['none', '6h', '12h', '1d', '2d', '3d', '1w'] as const).map((dur) => {
                                    const active = pinDuration === dur;
                                    return (
                                        <button
                                            key={dur}
                                            type="button"
                                            onClick={() => setPinDuration(dur)}
                                            className={active ? 'announcements-pin-btn active' : 'announcements-pin-btn'}
                                            style={{ padding: '0.38rem 0.25rem', fontSize: '0.68rem', whiteSpace: 'nowrap', textAlign: 'center' }}
                                        >
                                            {t(`pin_${dur}` as TranslationKey)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="announcementText">{t('announcement_content')}</label>
                            <textarea
                                id="announcementText"
                                placeholder={t('announcement_placeholder')}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                style={{ ...fieldStyle, minHeight: '130px', resize: 'vertical' }}
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
