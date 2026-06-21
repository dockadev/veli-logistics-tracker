import React, { useState } from 'react';
import { Send, Lightbulb, Bug, Sparkles } from 'lucide-react';
import { type Language } from '../context/LanguageContext';

interface FeedbackTabProps {
    language: Language;
    onSendFeedback: (message: string, category: 'bug' | 'idea') => void;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = React.memo(({ language, onSendFeedback }) => {
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState<'bug' | 'idea'>('idea');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed) return;

        setIsSubmitting(true);
        onSendFeedback(trimmed, category);
        
        // Clear message immediately on submit
        setMessage('');
        
        // Mock a short delay for feedback experience
        setTimeout(() => {
            setIsSubmitting(false);
        }, 600);
    };

    return (
        <div className="panel-card anim-fade-in" style={{ maxWidth: '600px', margin: '1rem auto' }}>
            <div className="card-header">
                <Lightbulb size={18} style={{ color: 'var(--accent-color)' }} />
                <h2>{language === 'tr' ? 'Geri Bildirim ve Öneriler' : 'Feedback & Suggestions'}</h2>
            </div>
            
            <div className="card-body">
                <p className="help-text" style={{ marginBottom: '1.25rem' }}>
                    {language === 'tr' 
                        ? 'Sistem hakkındaki fikirlerinizi, yeni özellik önerilerinizi veya karşılaştığınız sorunları bizimle paylaşabilirsiniz. Gönderdiğiniz geri bildirimler sadece geliştiriciler tarafından görülecektir.' 
                        : 'Share your ideas, feature requests, or issues with us. Your feedback will be delivered securely and viewed exclusively by developers.'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Category Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <label className="gate-input-label" style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'Geri Bildirim Türü' : 'Feedback Type'}
                        </label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setCategory('idea')}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid ' + (category === 'idea' ? 'var(--accent-color)' : 'var(--border-color)'),
                                    background: category === 'idea' ? 'rgba(249, 115, 22, 0.06)' : 'var(--btn-secondary-bg)',
                                    color: category === 'idea' ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <Sparkles size={14} />
                                <span>{language === 'tr' ? 'Yeni Özellik / Fikir' : 'New Feature / Idea'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory('bug')}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid ' + (category === 'bug' ? '#ef4444' : 'var(--border-color)'),
                                    background: category === 'bug' ? 'rgba(239, 68, 68, 0.06)' : 'var(--btn-secondary-bg)',
                                    color: category === 'bug' ? '#ef4444' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <Bug size={14} />
                                <span>{language === 'tr' ? 'Hata Bildirimi' : 'Bug Report'}</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={language === 'tr' ? 'Fikrinizi buraya yazın...' : 'Write your idea or feedback here...'}
                            maxLength={1000}
                            style={{
                                width: '100%',
                                minHeight: '150px',
                                padding: '0.75rem',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                resize: 'vertical',
                                fontSize: '0.8rem',
                                fontFamily: 'var(--font-body)',
                                transition: 'border-color 0.2s'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            <span>{message.length} / 1000</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !message.trim()}
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1.25rem',
                            alignSelf: 'flex-end',
                            minWidth: '120px'
                        }}
                    >
                        <Send size={14} />
                        <span>{isSubmitting ? '...' : (language === 'tr' ? 'Gönder' : 'Submit')}</span>
                    </button>
                </form>
            </div>
        </div>
    );
});

FeedbackTab.displayName = 'FeedbackTab';
