import React, { useState, useEffect, useRef } from 'react';
import { 
    Pin, 
    Minus, 
    X, 
    ArrowLeft, 
    UploadCloud, 
    Trash2, 
    Clipboard,
    CheckCircle
} from 'lucide-react';
import type { ItemInfo } from '../types';
import { parseCSV } from '../utils/csvParser';
import type { Language } from '../utils/localization';

const IS_TAURI = typeof window !== 'undefined' && !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

interface ScannedDepot {
    id: string;
    location: string;
    timestamp: string;
    items: Record<string, ItemInfo>;
    itemCount: number;
    rawCSV: string;
}

interface CompactOverlayProps {
    language: Language;
    onCloseOverlay: () => void;
    onImportCSV: (text: string) => boolean;
    isAlwaysOnTop: boolean;
    onToggleAlwaysOnTop: (pin: boolean) => void;
}

export const CompactOverlay: React.FC<CompactOverlayProps> = ({
    language,
    onCloseOverlay,
    onImportCSV,
    isAlwaysOnTop,
    onToggleAlwaysOnTop
}) => {
    const [pendingScans, setPendingScans] = useState<ScannedDepot[]>([]);
    const [showGlow, setShowGlow] = useState<boolean>(false);
    const [manualPasteOpen, setManualPasteOpen] = useState<boolean>(false);
    const [manualPasteText, setManualPasteText] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<string>('');

    const lastCheckedTextRef = useRef<string>('');

    // Minimize window function
    const handleMinimize = async () => {
        if (!IS_TAURI) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.minimize();
        } catch (err) {
            console.error('Failed to minimize window:', err);
        }
    };

    // Close window function
    const handleClose = async () => {
        if (!IS_TAURI) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.close();
        } catch (err) {
            console.error('Failed to close window:', err);
        }
    };

    // Focus window dynamically on hover (helps clipboard access in WebView2)
    const handleMouseEnter = async () => {
        if (!IS_TAURI) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.setFocus();
        } catch (err) {
            console.debug('Failed to set focus on hover:', err);
        }
        // Immediately check clipboard when mouse enters
        checkClipboard();
    };

    // Check clipboard function
    const checkClipboard = async () => {
        try {
            let text = '';
            if (IS_TAURI) {
                const { invoke } = await import('@tauri-apps/api/core');
                text = await invoke<string>('read_clipboard');
            } else {
                if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
                    return;
                }
                text = await navigator.clipboard.readText();
            }
            
            const trimmed = (text || '').trim();
            
            if (!trimmed || trimmed === lastCheckedTextRef.current) {
                return;
            }
            
            lastCheckedTextRef.current = trimmed;

            // Attempt to parse
            const parsed = parseCSV(trimmed);
            if (parsed && !('error' in parsed)) {
                // Check if already in pending list
                const alreadyExists = pendingScans.some(
                    scan => scan.location === parsed.location && scan.timestamp === parsed.timestamp
                );

                if (!alreadyExists) {
                    const itemCount = Object.keys(parsed.items).length;
                    const newScan: ScannedDepot = {
                        id: Math.random().toString(36).substring(2, 9),
                        location: parsed.location,
                        timestamp: parsed.timestamp,
                        items: parsed.items,
                        itemCount,
                        rawCSV: trimmed
                    };

                    setPendingScans(prev => [newScan, ...prev]);
                    setShowGlow(true);
                    setTimeout(() => setShowGlow(false), 1200);
                }
            }
        } catch (err) {
            // Document focus error is common in background, caught silently
            console.debug('Clipboard read bypassed:', err);
        }
    };

    // Poll clipboard rapidly (300ms) for snappy detection
    useEffect(() => {
        const interval = setInterval(checkClipboard, 300);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingScans]);

    // Handle sync all
    const handleSyncAll = () => {
        if (pendingScans.length === 0) return;
        
        let successCount = 0;
        pendingScans.forEach(scan => {
            const success = onImportCSV(scan.rawCSV);
            if (success) {
                successCount++;
            }
        });

        if (successCount > 0) {
            setPendingScans([]);
            setStatusMessage(language === 'tr' ? `${successCount} depo eşitlendi` : `${successCount} depots synced`);
            setTimeout(() => setStatusMessage(''), 4000);
        }
    };

    // Handle manual paste submit
    const handleManualPasteSubmit = () => {
        const pasteStr = String(manualPasteText).trim();
        if (!pasteStr) return;
        
        const parsed = parseCSV(pasteStr);
        if (parsed && !('error' in parsed)) {
            const itemCount = Object.keys(parsed.items).length;
            const newScan: ScannedDepot = {
                id: Math.random().toString(36).substring(2, 9),
                location: parsed.location,
                timestamp: parsed.timestamp,
                items: parsed.items,
                itemCount,
                rawCSV: pasteStr
            };
            
            setPendingScans(prev => [newScan, ...prev]);
            setManualPasteText('');
            setManualPasteOpen(false);
            setShowGlow(true);
            setTimeout(() => setShowGlow(false), 1200);
        } else {
            // Trigger import error toast
            onImportCSV(pasteStr);
        }
    };

    return (
        <div 
            className={`compact-overlay-container ${showGlow ? 'glow-active' : ''}`}
            onMouseEnter={handleMouseEnter}
        >
            {/* Custom Draggable Header */}
            <div className="compact-header" data-tauri-drag-region>
                <div className="compact-title-area" data-tauri-drag-region>
                    {/* Header title removed per user request */}
                </div>
                
                {/* Control Actions */}
                <div className="compact-controls">
                    <button 
                        onClick={() => onToggleAlwaysOnTop(!isAlwaysOnTop)}
                        className={`compact-btn ${isAlwaysOnTop ? 'active-pin' : ''}`}
                        title={isAlwaysOnTop ? (language === 'tr' ? 'Sabitlemeyi Kaldır' : 'Unpin') : (language === 'tr' ? 'Üstte Sabitle' : 'Pin Always on Top')}
                    >
                        <Pin size={12} />
                    </button>
                    {IS_TAURI && (
                        <>
                            <button 
                                onClick={handleMinimize}
                                className="compact-btn"
                                title={language === 'tr' ? 'Küçült' : 'Minimize'}
                            >
                                <Minus size={12} />
                            </button>
                            <button 
                                onClick={handleClose}
                                className="compact-btn compact-btn-danger"
                                title={language === 'tr' ? 'Kapat' : 'Close'}
                            >
                                <X size={12} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="compact-content">
                {manualPasteOpen ? (
                    <div className="compact-manual-paste">
                        <div className="panel-header-simple">
                            <span className="panel-title">{language === 'tr' ? 'Manuel Yapıştır' : 'Manual Paste'}</span>
                        </div>
                        <textarea
                            className="compact-textarea"
                            placeholder={language === 'tr' ? 'CSV verisini buraya yapıştırın...' : 'Paste CSV data here...'}
                            value={String(manualPasteText)}
                            onChange={(e) => setManualPasteText(e.target.value)}
                        />
                        <div className="compact-action-row">
                            <button 
                                className="btn btn-secondary btn-xs"
                                onClick={() => setManualPasteOpen(false)}
                            >
                                {language === 'tr' ? 'İptal' : 'Cancel'}
                            </button>
                            <button 
                                className="btn btn-primary btn-xs"
                                onClick={handleManualPasteSubmit}
                            >
                                {language === 'tr' ? 'Ekle' : 'Add'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Pending list */}
                        {pendingScans.length > 0 ? (
                            <div className="compact-scans-list" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="scans-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span className="scans-count">
                                        {language === 'tr' 
                                            ? `${pendingScans.length} Bekleyen Tarama` 
                                            : `${pendingScans.length} Pending Scans`}
                                    </span>
                                    <button 
                                        onClick={() => setPendingScans([])} 
                                        className="btn-link-clear"
                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                                        title={language === 'tr' ? 'Tümünü Temizle' : 'Clear All'}
                                    >
                                        <Trash2 size={11} />
                                        <span>{language === 'tr' ? 'Temizle' : 'Clear'}</span>
                                    </button>
                                </div>
                                <div className="scans-scrollable" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                    {pendingScans.map((scan) => (
                                        <div key={scan.id} className="scan-card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '6px', padding: '8px 10px' }}>
                                            <div className="scan-card-info" style={{ flex: 1, minWidth: 0 }}>
                                                <div className="scan-location" title={scan.location} style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {scan.location}
                                                </div>
                                                <div className="scan-meta" style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.45)', display: 'flex', gap: '5px', marginTop: '2px' }}>
                                                    <span>{scan.itemCount} {language === 'tr' ? 'çeşit ürün' : 'types of products'}</span>
                                                    <span>•</span>
                                                    <span>{scan.timestamp.split(' ')[1] || scan.timestamp}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setPendingScans(prev => prev.filter(s => s.id !== scan.id))}
                                                className="btn-dismiss-action"
                                                style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                                                title={language === 'tr' ? 'Yoksay' : 'Dismiss'}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Single Sync All action button */}
                                <button
                                    onClick={handleSyncAll}
                                    className="btn btn-primary"
                                    style={{
                                        background: 'var(--accent-color, #d9531e)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        width: '100%',
                                        cursor: 'pointer',
                                        marginTop: 'auto'
                                    }}
                                >
                                    <UploadCloud size={14} />
                                    <span>{language === 'tr' ? 'Tümünü Eşitle' : 'Sync All'}</span>
                                </button>
                            </div>
                        ) : (
                            <div className="compact-empty-state">
                                <div className="radar-animation">
                                    <div className="radar-circle-1"></div>
                                    <div className="radar-circle-2"></div>
                                    <Clipboard size={24} className="radar-icon" />
                                </div>
                                <div className="empty-text">
                                    {language === 'tr' 
                                        ? 'Otomatik Pano Takibi' 
                                        : 'Auto Clipboard Sync'}
                                </div>
                                <div className="empty-subtext">
                                    {language === 'tr'
                                        ? 'Panoya kopyalanan lojistik verileri (CSV) otomatik olarak çekilecektir.'
                                        : 'Logistic data (CSV) copied to the clipboard will be pulled automatically.'}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1.25rem' }}>
                                    <button 
                                        className="btn btn-secondary btn-xs" 
                                        style={{ width: '100%', fontSize: '0.65rem' }}
                                        onClick={() => {
                                            setManualPasteText('');
                                            setManualPasteOpen(true);
                                        }}
                                        type="button"
                                    >
                                        {language === 'tr' ? 'Elle Gir' : 'Manual Entry'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="compact-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', height: '36px' }}>
                <button 
                    onClick={onCloseOverlay} 
                    className="btn-hud-exit"
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'rgba(255,255,255,0.5)', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        transform: 'translateY(-1px)'
                    }}
                >
                    <ArrowLeft size={13} />
                    <span>{language === 'tr' ? 'Arayüze Dön' : 'Exit HUD'}</span>
                </button>
                
                {statusMessage ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} />
                        <span>{statusMessage}</span>
                    </span>
                ) : null}
            </div>
        </div>
    );
};
