import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = React.memo(({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
}) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onCancel} />
            <div className="modal-wrapper" onClick={onCancel}>
                <div 
                    className="modal-container modal-sm"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <h3 id="confirmTitle">{title}</h3>
                    </div>
                    <div className="modal-body">
                        <p id="confirmMessage" className="modal-body-text">
                            {message}
                        </p>
                    </div>
                    <div className="modal-footer">
                        <button id="btnConfirmCancel" className="btn btn-secondary" onClick={onCancel}>
                            {t('confirm_cancel')}
                        </button>
                        <button id="btnConfirmSubmit" className="btn btn-primary" onClick={onConfirm}>
                            {t('confirm_yes')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
});

ConfirmModal.displayName = 'ConfirmModal';

