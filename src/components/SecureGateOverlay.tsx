import React, { useState, useEffect } from 'react';
import { AlertTriangle, UserPlus, LogIn, Clock, CheckCircle2, XCircle, ArrowUpRight, Lock, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { UserRole, PortalUser } from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { PaperCanvas } from './PaperCanvas';

interface SecureGateOverlayProps {
    onLoginSuccess: (role: UserRole, masterKey: string, rememberMe?: boolean) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    version?: string;
}

const LANG_OPTIONS = [
    { key: 'en' as const, label: 'EN' },
    { key: 'tr' as const, label: 'TR' },
    { key: 'pt-BR' as const, label: 'PT' },
    { key: 'ru' as const, label: 'RU' },
    { key: 'de' as const, label: 'DE' },
];

const COALITION_TAGLINES = [
    'Designed for the VELI Coalition',
    'VELI Koalisyonu için tasarlanmıştır',
    'Feito para a Coalizão VELI',
    'Создано для Коалиции VELI',
    'Entwickelt für die VELI-Koalition'
];

export const SecureGateOverlay: React.FC<SecureGateOverlayProps> = React.memo(({ onLoginSuccess, version = '0.2.01' }) => {
    const { language, setLanguage, t } = useLanguage();
    const [loginError, setLoginError] = useState('');
    const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState(() => localStorage.getItem('remembered_username') || '');
    const [supabasePassword, setSupabasePassword] = useState('');
    const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('docka_remember_me') === 'true');
    const [authLoading, setAuthLoading] = useState(false);
    const [gateView, setGateView] = useState<'auth' | 'pending' | 'rejected' | 'approved'>('auth');
    const [approvedSessionData, setApprovedSessionData] = useState<{ role: UserRole; userId: string; username: string } | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [taglineIdx, setTaglineIdx] = useState(0);
    const [taglineText, setTaglineText] = useState('');
    const [taglinePhase, setTaglinePhase] = useState<'typing' | 'waiting' | 'deleting'>('typing');

    // Rotating tagline: typing -> pause -> deleting -> next
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const full = COALITION_TAGLINES[taglineIdx];
        if (taglinePhase === 'typing') {
            if (taglineText.length < full.length) {
                timer = setTimeout(() => setTaglineText(full.slice(0, taglineText.length + 1)), 45);
            } else {
                setTaglinePhase('waiting');
            }
        } else if (taglinePhase === 'waiting') {
            timer = setTimeout(() => setTaglinePhase('deleting'), 2800);
        } else {
            if (taglineText.length > 0) {
                timer = setTimeout(() => setTaglineText(taglineText.slice(0, -1)), 25);
            } else {
                setTaglineIdx(prev => (prev + 1) % COALITION_TAGLINES.length);
                setTaglinePhase('typing');
            }
        }
        return () => clearTimeout(timer);
    }, [taglineText, taglinePhase, taglineIdx]);

    useEffect(() => {
        if (!isSupabaseConfigured || !supabase || !currentUserId || gateView === 'auth') return;
        const profileChannel = supabase
            .channel(`gate-profile-${currentUserId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUserId}` },
                (payload: { new: Record<string, unknown> }) => {
                    const p = payload.new as Partial<PortalUser>;
                    const status = p.status || 'pending';
                    if (status === 'approved') {
                        setApprovedSessionData({ role: (p.role as UserRole) || 'member', userId: currentUserId, username: p.username || username });
                        setGateView('approved');
                    } else if (status === 'rejected') {
                        setGateView('rejected');
                    } else {
                        setGateView('pending');
                    }
                }
            ).subscribe();
        return () => { supabase?.removeChannel(profileChannel); };
    }, [currentUserId, gateView, username]);

    const handleSupabaseAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isSupabaseConfigured || !supabase) {
            if (import.meta.env.DEV) {
                const u = username.trim() || 'DevTester';
                sessionStorage.setItem('docka_session_username', u);
                localStorage.setItem('remembered_username', u);
                if (rememberMe) localStorage.setItem('docka_session_username', u);
                onLoginSuccess('developer', 'dev-offline-id', rememberMe);
                setAuthLoading(false);
                return;
            }
            setLoginError(t('supabase_not_configured'));
            setAuthLoading(false);
            return;
        }
        setLoginError('');
        setAuthLoading(true);
        const trimmedUsername = username.trim();
        if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
            setLoginError(t('invalid_username_format'));
            setAuthLoading(false);
            return;
        }
        const sanitized = trimmedUsername.toLowerCase();
        const virtualEmail = `${sanitized}@pars-logistics.local`;
        try {
            if (authTab === 'register') {
                const { data, error } = await supabase.auth.signUp({ email: virtualEmail, password: supabasePassword, options: { data: { username: trimmedUsername } } });
                if (error) throw error;
                if (data?.user) { setSupabasePassword(''); setCurrentUserId(data.user.id); setGateView('pending'); }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email: virtualEmail, password: supabasePassword });
                if (error) throw error;
                if (data?.user) {
                    const { data: profile } = await supabase.from('profiles').select('role, status, username, approval_seen').eq('id', data.user.id).single();
                    const userStatus = profile?.status || 'pending';
                    setCurrentUserId(data.user.id);
                    if (userStatus === 'approved') {
                        const userRole: UserRole = (profile?.role as UserRole) || 'member';
                        const uname = profile?.username || trimmedUsername;
                        const seen = profile?.approval_seen ?? (localStorage.getItem('docka_approval_seen_' + data.user.id) === 'true');
                        if (seen) {
                            sessionStorage.setItem('docka_session_username', uname);
                            localStorage.setItem('remembered_username', uname);
                            if (rememberMe) localStorage.setItem('docka_session_username', uname);
                            onLoginSuccess(userRole, data.user.id, rememberMe);
                        } else {
                            setApprovedSessionData({ role: userRole, userId: data.user.id, username: uname });
                            setGateView('approved');
                        }
                    } else if (userStatus === 'rejected') {
                        setGateView('rejected');
                    } else {
                        setGateView('pending');
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setLoginError(msg.toLowerCase().includes('invalid login credentials') ? (language === 'tr' ? 'Yanlış kullanıcı adı veya şifre' : 'Incorrect username or password') : msg);
        } finally { setAuthLoading(false); }
    };

    const handleGoBack = async () => {
        setAuthLoading(true);
        try { if (supabase) await supabase.auth.signOut(); } catch {}
        setGateView('auth'); setApprovedSessionData(null); setSupabasePassword('');
        setUsername(''); setLoginError(''); setAuthLoading(false);
    };

    return (
        <div className="sg-shell">
            {/* Ambient orbs and noise */}
            <div className="sg-orb sg-orb-a" aria-hidden="true" />
            <div className="sg-orb sg-orb-b" aria-hidden="true" />
            <div className="sg-orb sg-orb-c" aria-hidden="true" />
            <div className="sg-grain" aria-hidden="true" />
            <div className="sg-grid-lines" aria-hidden="true" />

            {/* Split layout */}
            <div className="sg-split">
                {/* Left hero / brand panel */}
                <section className="sg-hero anim-gate-left">
                    <div className="sg-hero-bg" aria-hidden="true" />
                    <div className="sg-hero-inner">
                        <div className="sg-hero-brand">
                            <h1 className="sg-hero-title">
                                <span className="sg-hero-title-main">VELI</span>
                                <span className="sg-hero-title-sub">Logistics Tracker</span>
                            </h1>
                        </div>
                        <div className="sg-hero-tagline">
                            <span className="sg-hero-tagline-text">{taglineText}</span>
                            <span className="sg-hero-cursor" />
                        </div>

                        <div className="sg-hero-divider" />

                        <div className="sg-hero-version">v{version}</div>
                    </div>
                </section>

                {/* Right auth sidebar */}
                <aside className="sg-aside anim-gate-right">
                    <PaperCanvas height="100%" />
                    <div className="sg-glass-card">
                        <div className="sg-lang-pill">
                            {LANG_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={`sg-lang-btn ${language === opt.key ? 'active' : ''}`}
                                    onClick={() => setLanguage(opt.key)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="sg-card-corner sg-corner-tl" />
                        <div className="sg-card-corner sg-corner-tr" />
                        <div className="sg-card-corner sg-corner-bl" />
                        <div className="sg-card-corner sg-corner-br" />

                        <div className="sg-card-head">
                            <div className="sg-card-head-text">
                                <div className="sg-card-title">{t('login_panel_title')}</div>
                            </div>
                        </div>

                        {gateView === 'pending' && (
                            <div className="sg-status sg-status-warn">
                                <div className="sg-status-icon">
                                    <Clock size={22} />
                                </div>
                                <h2 className="sg-status-title">{t('auth_pending_title')}</h2>
                                <p className="sg-status-desc">{t('auth_pending_desc')}</p>
                                <button type="button" onClick={handleGoBack} className="sg-btn sg-btn-ghost" disabled={authLoading}>
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'rejected' && (
                            <div className="sg-status sg-status-err">
                                <div className="sg-status-icon">
                                    <XCircle size={22} />
                                </div>
                                <h2 className="sg-status-title">{t('auth_rejected_title')}</h2>
                                <p className="sg-status-desc">{t('auth_rejected_desc')}</p>
                                <button type="button" onClick={handleGoBack} className="sg-btn sg-btn-ghost" disabled={authLoading}>
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'approved' && (
                            <div className="sg-status sg-status-ok">
                                <div className="sg-status-icon">
                                    <CheckCircle2 size={22} />
                                </div>
                                <h2 className="sg-status-title">{t('auth_approved_title')}</h2>
                                <p className="sg-status-desc">{t('auth_approved_desc')}</p>
                                <button type="button" className="sg-btn sg-btn-primary" onClick={async () => {
                                    if (approvedSessionData) {
                                        sessionStorage.setItem('docka_session_username', approvedSessionData.username);
                                        localStorage.setItem('remembered_username', approvedSessionData.username);
                                        if (rememberMe) localStorage.setItem('docka_session_username', approvedSessionData.username);
                                        localStorage.setItem('docka_approval_seen_' + approvedSessionData.userId, 'true');
                                        if (supabase) { try { await supabase.from('profiles').update({ approval_seen: true }).eq('id', approvedSessionData.userId); } catch {} }
                                        onLoginSuccess(approvedSessionData.role, approvedSessionData.userId, rememberMe);
                                    }
                                }}>
                                    {t('auth_btn_enter_system')}
                                    <ArrowUpRight size={14} />
                                </button>
                                <button type="button" onClick={handleGoBack} className="sg-btn sg-btn-ghost" disabled={authLoading}>
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'auth' && (
                            <>
                                <div className="sg-card-section">
                                    <div className="sg-tabs">
                                        <button type="button" className={`sg-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => setAuthTab('login')}>
                                            <LogIn size={13} />
                                            <span>{t('auth_login_tab')}</span>
                                        </button>
                                        <button type="button" className={`sg-tab ${authTab === 'register' ? 'active' : ''}`} onClick={() => setAuthTab('register')}>
                                            <UserPlus size={13} />
                                            <span>{t('auth_register_tab')}</span>
                                        </button>
                                        <span className={`sg-tab-indicator sg-tab-indicator-${authTab}`} />
                                    </div>
                                </div>

                                {loginError && (
                                    <div className="sg-error">
                                        <AlertTriangle size={13} />
                                        <span>{loginError}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSupabaseAuth} className="sg-form" noValidate>
                                    <div className="sg-field">
                                        <label className="sg-field-label">{t('auth_username_label')}</label>
                                        <div className="sg-input-wrap">
                                            <User size={13} className="sg-input-icon" />
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={e => setUsername(e.target.value)}
                                                placeholder={t('auth_username_placeholder')}
                                                required
                                                disabled={authLoading}
                                                autoComplete="username"
                                            />
                                        </div>
                                    </div>

                                    <div className="sg-field">
                                        <label className="sg-field-label">{t('auth_password_label')}</label>
                                        <div className="sg-input-wrap">
                                            <Lock size={13} className="sg-input-icon" />
                                            <input
                                                type="password"
                                                value={supabasePassword}
                                                onChange={e => setSupabasePassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                disabled={authLoading}
                                                autoComplete="current-password"
                                            />
                                        </div>
                                    </div>

                                    {authTab === 'login' && (
                                        <label className="sg-check">
                                            <span className={`sg-toggle ${rememberMe ? 'on' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={e => setRememberMe(e.target.checked)}
                                                />
                                                <span className="sg-toggle-thumb" />
                                            </span>
                                            <span>{t('remember_me')}</span>
                                        </label>
                                    )}

                                    <button type="submit" className="sg-btn sg-btn-primary sg-btn-block" disabled={authLoading}>
                                        <span>
                                            {authLoading ? t('auth_connecting') : authTab === 'login' ? t('auth_login_tab') : t('auth_send_request')}
                                        </span>
                                        {!authLoading && <ArrowUpRight size={14} />}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
});

SecureGateOverlay.displayName = 'SecureGateOverlay';