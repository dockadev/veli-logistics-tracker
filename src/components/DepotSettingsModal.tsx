import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface DepotSettingsModalProps {
    isOpen: boolean;
    currentCustomName: string | null;
    currentName: string;
    currentAccessCode?: string;
    currentIsCodePublic?: boolean;
    onSave: (customName: string, accessCode: string, isCodePublic: boolean) => void;
    onClose: () => void;
}

export const DepotSettingsModal: React.FC<DepotSettingsModalProps> = React.memo(({
    isOpen,
    currentCustomName,
    currentName,
    currentAccessCode,
    currentIsCodePublic,
    onSave,
    onClose,
}) => {
    const { t } = useLanguage();
    const [customName, setCustomName] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [isCodePublic, setIsCodePublic] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCustomName(currentCustomName || currentName);
            setAccessCode(currentAccessCode || '');
            setIsCodePublic(currentIsCodePublic || false);
            setErrorMsg(null);
        }
    }, [isOpen, currentCustomName, currentName, currentAccessCode, currentIsCodePublic]);

    if (!isOpen) return null;

    const handleAccessCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, ''); // numbers only
        if (val.length <= 6) {
            setAccessCode(val);
            if (val.length > 0 && val.length !== 6) {
                setErrorMsg(t('validation_6_digits'));
            } else {
                setErrorMsg(null);
            }
        }
    };

    const handleSave = () => {
        if (accessCode.length > 0 && accessCode.length !== 6) {
            setErrorMsg(t('validation_6_digits'));
            return;
        }
        onSave(customName.trim(), accessCode, isCodePublic);
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <h3>{t('depot_settings')}</h3>
                        <button className="modal-close" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="depotCustomName">{t('custom_identifier_name')}</label>
                            <input
                                type="text"
                                id="depotCustomName"
                                placeholder="Enter display name..."
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                            />
                            <p className="help-text">{t('depot_settings_desc')}</p>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.25rem' }}>
                            <label htmlFor="d_ac">{t('access_code')}</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    id="d_ac"
                                    name="d_ac"
                                    placeholder={t('access_code_placeholder')}
                                    value={accessCode}
                                    onChange={handleAccessCodeChange}
                                    maxLength={6}
                                    style={{ flex: 1 }}
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-1p-ignore
                                />
                                {accessCode && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAccessCode('');
                                            setErrorMsg(null);
                                        }}
                                        className="btn-add-action"
                                        style={{ 
                                            padding: '0 0.75rem', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            alignSelf: 'stretch',
                                            border: '1px solid var(--border-color)',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginTop: 0,
                                            height: 'auto',
                                            cursor: 'pointer',
                                            color: 'var(--color-negative)'
                                        }}
                                        title={t('remove_code_help')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            <p className="help-text">{t('remove_code_help')}</p>
                            {errorMsg && (
                                <p className="help-text text-negative" style={{ marginTop: '0.25rem' }}>{errorMsg}</p>
                            )}
                        </div>

                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', display: 'flex', marginTop: '1rem' }}>
                            <input
                                type="checkbox"
                                id="isCodePublic"
                                checked={isCodePublic}
                                onChange={(e) => setIsCodePublic(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                            />
                            <label htmlFor="isCodePublic" style={{ margin: 0, cursor: 'pointer', userSelect: 'none', fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'none' }}>
                                {t('share_code_with_members')}
                            </label>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>
                            {t('confirm_cancel')}
                        </button>
                        <button id="btnSaveDepotSettings" className="btn btn-primary" onClick={handleSave}>
                            {t('save_changes')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

DepotSettingsModal.displayName = 'DepotSettingsModal';

