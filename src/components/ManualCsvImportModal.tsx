import React, { useState, useEffect } from 'react';
import { X, UploadCloud } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ManualCsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (text: string) => boolean;
}

export const ManualCsvImportModal: React.FC<ManualCsvImportModalProps> = ({
    isOpen,
    onClose,
    onImport,
}) => {
    const { t } = useLanguage();
    const [csvText, setCsvText] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCsvText('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = onImport(csvText);
        if (success) {
            onClose();
        }
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container modal-container-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UploadCloud size={18} />
                            <h3>{t('csv_input')}</h3>
                        </div>
                        <button className="modal-close" onClick={onClose} type="button">
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="modal-body modal-body-spacing">
                            <p className="help-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                                {t('csv_input_desc_officer')}
                            </p>
                            <div className="form-group" style={{ margin: 0 }}>
                                <textarea
                                    id="csvInputModalText"
                                    placeholder={t('csv_input_placeholder_officer')}
                                    value={csvText}
                                    onChange={(e) => setCsvText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        height: '240px',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        resize: 'vertical',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                            >
                                {t('import_stock')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};
