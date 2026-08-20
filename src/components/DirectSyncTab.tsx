import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, Volume2, VolumeX, Database, Terminal, FileCode, CheckCircle, AlertTriangle, Trash2, FolderOpen, HelpCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { parseSavFile, type ParsedStockpile } from '../utils/savParser';
import { playChimeSound } from '../utils/helpers';
import { CustomSelect } from './CustomSelect';
import { useLanguage } from '../context/LanguageContext';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface DirectSyncTabProps {
  onSyncStockpiles: (stockpiles: ParsedStockpile[]) => void;
}

// Global module memory to preserve logs and state across tab navigation
let cachedSyncLogs: LogEntry[] = [];
let cachedSavPath: string = '';
let cachedLastScanCount: number = 0;
let cachedScanInterval: number = 5; // Default 5 seconds
let cachedIsMuted: boolean = false;

export const DirectSyncTab: React.FC<DirectSyncTabProps> = ({ onSyncStockpiles }) => {
  const { t } = useLanguage();
  const [savPath, setSavPath] = useState<string>(cachedSavPath);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [pulseState, setPulseState] = useState<'idle' | 'active' | 'error'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>(cachedSyncLogs);
  const [lastScanCount, setLastScanCount] = useState<number>(cachedLastScanCount);
  const [scanInterval, setScanInterval] = useState<number>(cachedScanInterval);
  const [isMuted, setIsMuted] = useState<boolean>(cachedIsMuted);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const isAutoDetectingRef = useRef<boolean>(false);
  
  // Track last seen file size and mtime to detect changes
  const lastFileSize = useRef<number>(0);
  const lastFileMtime = useRef<string>('');

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    setLogs(prev => {
      const next = [...prev.slice(-99), { id, time, message, type }];
      cachedSyncLogs = next;
      return next;
    });
  };

  const handleAutoDetect = async () => {
    if (isAutoDetectingRef.current) return;
    isAutoDetectingRef.current = true;
    try {
      addLog('Detecting local Foxhole save files...', 'info');
      const detectedPath = await invoke<string>('auto_detect_sav_file');
      setSavPath(detectedPath);
      cachedSavPath = detectedPath;
      addLog(`Save file auto-detected: ${detectedPath}`, 'success');
      setPulseState('idle');
    } catch (e: any) {
      addLog(`Auto-detection failed: ${e.toString()}`, 'warning');
      addLog('Please locate your *_MapData.sav file path manually or use Browse.', 'info');
      setPulseState('error');
    } finally {
      isAutoDetectingRef.current = false;
    }
  };

  const handleBrowseFile = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.sav';
    fileInput.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const filePath = file.path || file.name;
        setSavPath(filePath);
        cachedSavPath = filePath;
        addLog(`Save file path selected manually: ${filePath}`, 'info');
        setPulseState('idle');
      }
    };
    fileInput.click();
  };

  const parseAndSyncFile = async (filePath: string) => {
    try {
      // Read the binary file
      const fileBytes = await invoke<number[]>('read_binary_file', { path: filePath });
      const uint8Array = new Uint8Array(fileBytes);
      
      // Parse using GVAS parser
      const parsed = parseSavFile(uint8Array);
      
      if (parsed && parsed.length > 0) {
        onSyncStockpiles(parsed);
        if (!isMuted) playChimeSound();
        addLog(`SAV Scan Success: Scanned ${parsed.length} structures and updated local stockpiles.`, 'success');
        
        // Group parsed stockpiles by Region for clean visual logging
        const groupedByRegion: Record<string, typeof parsed> = {};
        parsed.forEach(p => {
          const reg = p.region || 'Unknown Region';
          if (!groupedByRegion[reg]) groupedByRegion[reg] = [];
          groupedByRegion[reg].push(p);
        });

        Object.entries(groupedByRegion).forEach(([regionName, itemsList]) => {
          addLog(`[${regionName}] (${itemsList.length} stockpiles synced)`, 'success');
          itemsList.forEach(p => {
            const itemCount = Object.values(p.items).reduce((a, b) => a + b, 0);
            const parts = p.location.split(' - ');
            const tagLabel = parts.slice(1).join(' - ') || p.location;
            addLog(`  ↳ ${tagLabel} (${itemCount} items)`, 'info');
          });
        });

        setLastScanCount(parsed.length);
      } else {
        addLog('SAV Scan completed: No pinned stockpile tooltips found in the save file.', 'warning');
        setLastScanCount(0);
      }
    } catch (e: any) {
      addLog(`GVAS Parse Error: ${e.toString()}`, 'error');
      setPulseState('error');
    }
  };

  const handleToggleCapture = async () => {
    if (isCapturing) {
      // Stop capturing
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsCapturing(false);
      setPulseState('idle');
      addLog('SAV Capture stopped.', 'warning');
    } else {
      // Start capturing
      if (!savPath) {
        addLog('Error: Please select or auto-detect a valid save file path first.', 'error');
        return;
      }
      
      addLog(`SAV Capture STARTED. Watching save file: ${savPath} (Interval: ${scanInterval}s)`, 'info');
      setIsCapturing(true);
      setPulseState('active');
      
      // Store initial savegame metadata baseline without immediate scan
      try {
        const [size, mtime] = await invoke<[number, string]>('get_sav_metadata', { path: savPath });
        lastFileSize.current = size;
        lastFileMtime.current = mtime;
      } catch (e: any) {
        console.warn('Initial metadata check error:', e);
      }

      // Start interval watcher
      timerRef.current = window.setInterval(async () => {
        try {
          const [size, mtime] = await invoke<[number, string]>('get_sav_metadata', { path: savPath });
          if (size !== lastFileSize.current || mtime !== lastFileMtime.current) {
            lastFileSize.current = size;
            lastFileMtime.current = mtime;
            addLog('Modification detected in save game! Syncing...', 'info');
            await parseAndSyncFile(savPath);
          }
        } catch (e: any) {
          addLog(`Watcher Error: ${e.toString()}`, 'error');
          setPulseState('error');
        }
      }, scanInterval * 1000);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    cachedSyncLogs = [];
  };

  useEffect(() => {
    if (!cachedSavPath) {
      handleAutoDetect();
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

return (
    <div className="ds-root" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem', width: '100%', boxSizing: 'border-box' }}>

      {/* Title & Banner */}
      <div className="ds-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Database size={22} className="text-primary-color" /> Direct SAV Sync
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('direct_sync_desc')}
          </span>
        </div>
        
        {/* Pulse status widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', width: '12px', height: '12px' }}>
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: pulseState === 'active' ? '#10B981' : pulseState === 'error' ? '#EF4444' : 'var(--text-muted)',
              boxShadow: pulseState === 'active' ? '0 0 10px #10B981' : 'none'
            }} />
            {pulseState === 'active' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#10B981',
                animation: 'dsPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                opacity: 0.75
              }} />
            )}
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: pulseState === 'active' ? '#10B981' : pulseState === 'error' ? '#EF4444' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {pulseState === 'active' ? t('watching_active') : pulseState === 'error' ? t('scan_error') : t('idle')}
          </span>
          {lastScanCount > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', paddingLeft: '0.75rem', marginLeft: '0.25rem' }}>
              {t('last_scan_count', { count: lastScanCount })}
            </span>
          )}
        </div>
      </div>

      {/* Control panel */}
      <div className="ds-panel">
        
        {/* File selector input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {t('sav_file_path')}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              type="text"
              placeholder="e.g. C:\Users\YourUser\AppData\Local\Foxhole\Saved\SaveGames\SteamID_MapData.sav"
              value={savPath}
              onChange={(e) => setSavPath(e.target.value)}
              disabled={isCapturing}
              className="ds-path-input"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={handleBrowseFile}
              disabled={isCapturing}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', whiteSpace: 'nowrap' }}
              title={t('browse_sav_file')}
            >
              <FolderOpen size={14} /> {t('browse_sav_file')}
            </button>
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={isCapturing}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem', whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={14} /> {t('auto_detect')}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleToggleCapture}
            className={`btn ${isCapturing ? 'btn-danger' : 'btn-primary'} ds-capture-btn`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              minWidth: '175px',
              height: '38px',
              fontWeight: 600,
              flexShrink: 0,
              boxShadow: isCapturing ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none'
            }}
          >
            {isCapturing ? (
              <>
                <Square size={16} /> {t('stop_capturing')}
              </>
            ) : (
              <>
                <Play size={16} /> {t('start_capturing')}
              </>
            )}
          </button>

          {/* Interval Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {t('scan_interval')}
            </span>
            <div style={{ width: '225px', flexShrink: 0 }}>
              <CustomSelect
                value={String(scanInterval)}
                disabled={isCapturing}
                onChange={(val) => {
                  const numVal = Number(val);
                  setScanInterval(numVal);
                  cachedScanInterval = numVal;
                }}
                options={[
                  { value: '1', label: '1 Second (Realtime)' },
                  { value: '3', label: '3 Seconds' },
                  { value: '5', label: '5 Seconds (Recommended)' },
                  { value: '10', label: '10 Seconds' },
                  { value: '30', label: '30 Seconds' },
                  { value: '60', label: '60 Seconds' }
                ]}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              cachedIsMuted = nextMute;
            }}
            className="btn btn-secondary ds-mute-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.55rem 0.65rem',
              marginLeft: 'auto',
              color: isMuted ? '#ef4444' : '#10B981',
              borderColor: isMuted ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)',
              background: isMuted ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.15)'
            }}
            title={isMuted ? 'Notification Sound Muted (Click to Unmute)' : 'Notification Sound Active (Click to Mute)'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

{/* How Direct SAV Sync Works Explanation Card */}
      <div className="ds-info-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HelpCircle size={18} style={{ color: 'var(--accent-color)' }} />
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
              {t('how_direct_sync_works_title')}
            </h3>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            padding: '0.25rem 0.65rem',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
          }}>
            <AlertTriangle size={13} />
            {t('please_read_first')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.85rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          <div className="ds-step-tile">
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
              {t('how_direct_sync_step1_title')}
            </strong>
            {t('how_direct_sync_step1_desc')}
          </div>

          <div className="ds-step-tile">
            <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
              {t('how_direct_sync_step2_title')}
            </strong>
            {t('how_direct_sync_step2_desc')}
          </div>

          <div className="ds-step-tile">
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
              {t('how_direct_sync_step3_title')}
            </strong>
            {t('how_direct_sync_step3_desc')}
          </div>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="ds-terminal">

        {/* Terminal Header */}
        <div className="ds-terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600 }}>
            <Terminal size={14} /> Live Sync Log Stream
          </div>
          <button
            type="button"
            onClick={handleClearLogs}
            className="ds-clear-btn"
          >
            <Trash2 size={12} /> Clear Log
          </button>
        </div>

        {/* Log body */}
        <div style={{
          flex: 1,
          padding: '0.8rem 1rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontFamily: 'Consolas, Monaco, monospace',
          fontSize: '0.72rem',
          lineHeight: '1.25rem',
          boxSizing: 'border-box'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '0.5rem' }}>
              <FileCode size={24} />
              <span>Console Idle. Start capturing to watch local savegame file.</span>
            </div>
          ) : (
            logs.map(log => {
              let color = 'var(--text-primary)';
              let icon = null;
              const isRegionHeader = log.message.startsWith('[') && log.message.includes('stockpiles synced');

              if (log.type === 'success') {
                color = '#10B981';
                icon = <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />;
              } else if (log.type === 'warning') {
                color = '#F59E0B';
                icon = <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />;
              } else if (log.type === 'error') {
                color = '#EF4444';
                icon = <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />;
              }
              
              return (
                <div key={log.id} className="ds-log-row" style={{
                  color,
                  display: 'flex',
                  alignItems: 'flex-start',
                  wordBreak: 'break-all',
                  fontWeight: isRegionHeader ? 800 : 400,
                  fontSize: isRegionHeader ? '0.78rem' : '0.72rem',
                  marginTop: isRegionHeader ? '0.35rem' : '0px'
                }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem', userSelect: 'none' }}>[{log.time}]</span>
                  <span style={isRegionHeader ? { letterSpacing: '0.02em' } : undefined}>{icon}{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

    </div>
  );
};
export default DirectSyncTab;
