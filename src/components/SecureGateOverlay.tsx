import React, { useState, useEffect } from 'react';
import { AlertTriangle, UserPlus, LogIn, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { UserRole, PortalUser } from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface SecureGateOverlayProps {
    onLoginSuccess: (role: UserRole, masterKey: string, rememberMe?: boolean) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    version?: string;
}

export const SecureGateOverlay: React.FC<SecureGateOverlayProps> = React.memo(({ onLoginSuccess, theme: _theme, setTheme: _setTheme, version = '0.1.66' }) => {
    const { language, setLanguage, t } = useLanguage();

    const [loginError, setLoginError] = useState('');

    // Supabase Mode State
    const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState(() => localStorage.getItem('remembered_username') || '');
    const [supabasePassword, setSupabasePassword] = useState('');
    const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('docka_remember_me') === 'true');
    const [authLoading, setAuthLoading] = useState(false);
    const [gateView, setGateView] = useState<'auth' | 'pending' | 'rejected' | 'approved'>('auth');
    const [approvedSessionData, setApprovedSessionData] = useState<{ role: UserRole; userId: string; username: string } | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const subtitles = [
        'Designed for VELI Coalition',
        'VELI Koalisyonu için tasarlanmıştır',
        'Projetado para a Coalizão VELI',
        'Разработано для Коалиции VELI',
        'Entwickelt für die VELI-Koalition'
    ];
    const [subtitleIndex, setSubtitleIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [typingPhase, setTypingPhase] = useState<'typing' | 'waiting' | 'deleting'>('typing');

    useEffect(() => {
        let timer: any;
        const currentFullText = subtitles[subtitleIndex];

        if (typingPhase === 'typing') {
            if (displayedText.length < currentFullText.length) {
                timer = setTimeout(() => {
                    setDisplayedText(currentFullText.slice(0, displayedText.length + 1));
                }, 50);
            } else {
                setTypingPhase('waiting');
            }
        } else if (typingPhase === 'waiting') {
            timer = setTimeout(() => {
                setTypingPhase('deleting');
            }, 3000);
        } else if (typingPhase === 'deleting') {
            if (displayedText.length > 0) {
                timer = setTimeout(() => {
                    setDisplayedText(displayedText.slice(0, -1));
                }, 30);
            } else {
                setSubtitleIndex((prev) => (prev + 1) % subtitles.length);
                setTypingPhase('typing');
            }
        }

        return () => clearTimeout(timer);
    }, [displayedText, typingPhase, subtitleIndex]);





    // Subscribe to profile status changes in real-time
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase || !currentUserId || gateView === 'auth') return;

        console.log('[Real-time Gate] Subscribing to profile updates for user:', currentUserId);
        
        const profileChannel = supabase
            .channel(`gate-profile-${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${currentUserId}`
                },
                (payload: { new: Record<string, unknown> }) => {
                    console.log('[Real-time Gate] Profile status updated:', payload);
                    const updatedProfile = payload.new as Partial<PortalUser>;
                    const nextStatus = updatedProfile.status || 'pending';
                    const nextRole = (updatedProfile.role as UserRole) || 'member';
                    const nextUsername = updatedProfile.username || username;

                    if (nextStatus === 'approved') {
                        setApprovedSessionData({
                            role: nextRole,
                            userId: currentUserId,
                            username: nextUsername
                        });
                        setGateView('approved');
                    } else if (nextStatus === 'rejected') {
                        setGateView('rejected');
                    } else {
                        setGateView('pending');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase?.removeChannel(profileChannel);
        };
    }, [currentUserId, gateView, username]);

    // Supabase Auth Handler (Username-to-Email Bypass)
    const handleSupabaseAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isSupabaseConfigured || !supabase) {
            // Local Offline Bypass Mode
            setLoginError('');
            setAuthLoading(true);
            const trimmedUsername = username.trim() || 'OfflineDeveloper';
            
            setTimeout(() => {
                sessionStorage.setItem('docka_session_username', trimmedUsername);
                localStorage.setItem('remembered_username', trimmedUsername);
                if (rememberMe) {
                    localStorage.setItem('docka_session_username', trimmedUsername);
                }
                
                // Automatically log in as developer for full local access
                onLoginSuccess('developer', 'offline-dev-id', rememberMe);
                setAuthLoading(false);
            }, 500);
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
        const sanitizedUsername = trimmedUsername.toLowerCase();

        // Virtual email mapping
        const virtualEmail = `${sanitizedUsername}@pars-logistics.local`;

        try {
            if (authTab === 'register') {
                // 1. Sign up user
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: virtualEmail,
                    password: supabasePassword,
                    options: {
                        data: {
                            username: username.trim()
                        }
                    }
                });

                if (signUpError) throw signUpError;

                if (signUpData?.user) {
                    // Profile creation is handled automatically on the database layer via PostgreSQL trigger.
                    // Redundant client-side upsert removed to bypass client RLS permission limits.
                    setSupabasePassword('');
                    setCurrentUserId(signUpData.user.id);
                    setGateView('pending');
                }
            } else {
                // 1. Sign in user
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: virtualEmail,
                    password: supabasePassword
                });

                if (signInError) throw signInError;

                if (signInData?.user) {
                    // 2. Fetch role & status from public.profiles
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('role, status, username, approval_seen')
                        .eq('id', signInData.user.id)
                        .single();

                    if (profileError) {
                        console.warn('[Supabase Auth] Profile fetch failed, falling back to member role:', profileError);
                    }

                    const userStatus = profile?.status || 'pending';
                    setCurrentUserId(signInData.user.id);

                    if (userStatus === 'approved') {
                        const userRole: UserRole = (profile?.role as UserRole) || 'member';
                        const fetchedUsername = profile?.username || username.trim();
                        
                        // Check if they have already acknowledged the approval
                        const dbApprovalSeen = profile?.approval_seen;
                        const approvalSeen = dbApprovalSeen ?? (localStorage.getItem('docka_approval_seen_' + signInData.user.id) === 'true');
                        if (approvalSeen) {
                            sessionStorage.setItem('docka_session_username', fetchedUsername);
                            localStorage.setItem('remembered_username', fetchedUsername);
                            if (rememberMe) {
                                localStorage.setItem('docka_session_username', fetchedUsername);
                            }
                            onLoginSuccess(userRole, signInData.user.id, rememberMe);
                        } else {
                            setApprovedSessionData({
                                role: userRole,
                                userId: signInData.user.id,
                                username: fetchedUsername
                            });
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
            console.error('[Supabase Auth] Process failed:', err);
            const rawMsg = err instanceof Error ? err.message : String(err);
            if (rawMsg.toLowerCase().includes('invalid login credentials')) {
                setLoginError(language === 'tr' 
                    ? 'Yanlış kullanıcı adı veya şifre' 
                    : 'Incorrect username or password');
            } else {
                setLoginError(rawMsg || 'Authentication failed.');
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const handleGoBack = async () => {
        setAuthLoading(true);
        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (e) {
            console.error('[Supabase Auth] Sign out failed:', e);
        } finally {
            setGateView('auth');
            setApprovedSessionData(null);
            setSupabasePassword('');
            setUsername('');
            setLoginError('');
            setAuthLoading(false);
        }
    };

    return (
        <div className="secure-gate-overlay">
            {/* Top-right corner settings */}
            <div style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                zIndex: 10
            }}>
                {/* Language Toggles */}
                <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '2px' }}>
                    <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        style={{
                            background: language === 'en' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'en' ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>EN</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setLanguage('tr')}
                        style={{
                            background: language === 'tr' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'tr' ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>TR</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setLanguage('pt-BR')}
                        style={{
                            background: language === 'pt-BR' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'pt-BR' ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>PT</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setLanguage('ru')}
                        style={{
                            background: language === 'ru' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'ru' ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>RU</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setLanguage('de')}
                        style={{
                            background: language === 'de' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'de' ? '#000' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>DE</span>
                    </button>
                </div>
            </div>
            {showResetConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 20000,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '2rem'
                }}>
                    <div style={{
                        background: 'rgba(20, 20, 25, 0.95)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '2rem',
                        maxWidth: '400px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
                    }}>
                        <AlertTriangle size={40} style={{ color: 'var(--color-negative)', marginBottom: '1rem', display: 'inline-block' }} />
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                            {t('clear_db_confirm_title')}
                        </h3>
                        <p style={{ margin: '0 0 2rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {t('reset_data_confirm')}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                type="button"
                                className="btn btn-secondary" 
                                style={{ flex: 1, padding: '0.6rem' }}
                                onClick={() => setShowResetConfirm(false)}
                            >
                                {t('auth_btn_go_back')}
                            </button>
                            <button 
                                type="button"
                                className="btn" 
                                style={{ flex: 1, padding: '0.6rem', background: '#ff4757', border: 'none', color: '#fff', fontWeight: 600 }}
                                onClick={() => {
                                    localStorage.removeItem('docka_enc_depots');
                                    localStorage.removeItem('docka_enc_requests');
                                    localStorage.removeItem('foxhole_active_depot');
                                    window.location.reload();
                                }}
                            >
                                {t('clear')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="secure-gate-split-container">
                {/* Left Brand Column */}
                <div className="secure-gate-brand-panel">
                    <div className="brand-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem', textAlign: 'center', zIndex: 2 }}>
                        <h1 style={{ 
                            fontFamily: 'var(--font-heading), "Oxanium", sans-serif',
                            fontSize: '2.1rem',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            color: 'var(--text-primary)',
                            margin: '0 0 0.85rem 0',
                            lineHeight: '1.2',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, var(--text-primary) 50%, rgba(var(--accent-color-rgb), 0.85) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            Logistics Tracker App
                        </h1>
                        <p 
                            style={{ 
                                fontFamily: 'var(--font-body), "Plus Jakarta Sans", sans-serif',
                                fontSize: '0.92rem',
                                letterSpacing: '0.04em',
                                color: 'var(--text-secondary)',
                                margin: '0 0 1.5rem 0',
                                fontWeight: 500,
                                opacity: 0.95,
                                minHeight: '2.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <span>{displayedText}</span>
                        </p>
                        <span style={{ 
                            fontFamily: 'var(--font-body), "Plus Jakarta Sans", sans-serif',
                            fontSize: '0.74rem',
                            letterSpacing: '0.12em',
                            color: 'var(--text-secondary)',
                            opacity: 0.65,
                            textTransform: 'none'
                        }}>
                            Made by docka
                        </span>
                    </div>
                </div>

                {/* Right Form Column */}
                <div className="secure-gate-form-panel">
                    <div className="secure-gate-form-container anim-fade-in">
                        {gateView === 'pending' && (
                            <div className="anim-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                                <div className="secure-gate-icon-wrapper" style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', padding: '0.85rem' }}>
                                    <Clock className="gate-alert-icon-spin" size={28} style={{ color: 'var(--color-warning)' }} />
                                </div>
                                <h2 className="secure-gate-title" style={{ color: 'var(--color-warning)', marginTop: '1.25rem' }}>
                                    {t('auth_pending_title')}
                                </h2>
                                <p className="secure-gate-desc" style={{ fontSize: '0.82rem', lineHeight: '1.5', margin: '0.75rem 0 1.5rem', color: 'var(--text-secondary)' }}>
                                    {t('auth_pending_desc')}
                                </p>
                                <button 
                                    type="button" 
                                    onClick={handleGoBack}
                                    className="secure-gate-btn-member"
                                    style={{ 
                                        width: '100%', 
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--border-color)',
                                        background: 'rgba(255, 255, 255, 0.02)'
                                    }}
                                    disabled={authLoading}
                                >
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'rejected' && (
                            <div className="anim-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                                <div className="secure-gate-icon-wrapper" style={{ background: 'var(--color-negative-bg)', border: '1px solid var(--color-negative-border)', padding: '0.85rem', filter: 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.2))' }}>
                                    <XCircle size={28} style={{ color: 'var(--color-negative)' }} />
                                </div>
                                <h2 className="secure-gate-title" style={{ color: 'var(--color-negative)', marginTop: '1.25rem' }}>
                                    {t('auth_rejected_title')}
                                </h2>
                                <p className="secure-gate-desc" style={{ fontSize: '0.82rem', lineHeight: '1.5', margin: '0.75rem 0 1.5rem', color: 'var(--text-secondary)' }}>
                                    {t('auth_rejected_desc')}
                                </p>
                                <button 
                                    type="button" 
                                    onClick={handleGoBack}
                                    className="secure-gate-btn-member"
                                    style={{ 
                                        width: '100%', 
                                        color: 'var(--text-secondary)',
                                        borderColor: 'var(--border-color)',
                                        background: 'rgba(255, 255, 255, 0.02)'
                                    }}
                                    disabled={authLoading}
                                >
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'approved' && (
                            <div className="anim-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
                                <div className="secure-gate-icon-wrapper" style={{ background: 'var(--color-positive-bg)', border: '1px solid var(--color-positive-border)', padding: '0.85rem', filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.2))' }}>
                                    <CheckCircle2 size={28} style={{ color: 'var(--color-positive)' }} />
                                </div>
                                <h2 className="secure-gate-title" style={{ color: 'var(--color-positive)', marginTop: '1.25rem' }}>
                                    {t('auth_approved_title')}
                                </h2>
                                <p className="secure-gate-desc" style={{ fontSize: '0.82rem', lineHeight: '1.5', margin: '0.75rem 0 1.5rem', color: 'var(--text-secondary)' }}>
                                    {t('auth_approved_desc')}
                                </p>
                                
                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        if (approvedSessionData) {
                                            sessionStorage.setItem('docka_session_username', approvedSessionData.username);
                                            localStorage.setItem('remembered_username', approvedSessionData.username);
                                            if (rememberMe) {
                                                localStorage.setItem('docka_session_username', approvedSessionData.username);
                                            }
                                            localStorage.setItem('docka_approval_seen_' + approvedSessionData.userId, 'true');
                                            if (supabase) {
                                                try {
                                                    await supabase
                                                        .from('profiles')
                                                        .update({ approval_seen: true })
                                                        .eq('id', approvedSessionData.userId);
                                                } catch (err) {
                                                    console.error('[Gate] Failed to sync approval_seen to Supabase:', err);
                                                }
                                            }
                                            onLoginSuccess(approvedSessionData.role, approvedSessionData.userId, rememberMe);
                                        }
                                    }}
                                    className="secure-gate-btn-officer" 
                                    style={{ width: '100%', marginBottom: '0.5rem' }}
                                >
                                    {t('auth_btn_enter_system')}
                                </button>

                                <button 
                                    type="button" 
                                    onClick={handleGoBack}
                                    className="secure-gate-btn-member"
                                    style={{ 
                                        width: '100%', 
                                        color: 'var(--text-muted)',
                                        borderColor: 'var(--border-color)',
                                        background: 'transparent'
                                    }}
                                    disabled={authLoading}
                                >
                                    {authLoading ? '...' : t('auth_btn_go_back')}
                                </button>
                            </div>
                        )}

                        {gateView === 'auth' && (
                            /* Supabase Authentication Screen */
                            <div style={{ width: '100%' }}>
                                {/* Auth Tabs */}
                                <div className="auth-tabs">
                                    <button
                                        type="button"
                                        className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                                        onClick={() => setAuthTab('login')}
                                    >
                                        <LogIn size={14} />
                                        <span>{t('auth_login_tab')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
                                        onClick={() => setAuthTab('register')}
                                    >
                                        <UserPlus size={14} />
                                        <span>{t('auth_register_tab')}</span>
                                    </button>
                                </div>

                                <h2 className="secure-gate-title">{t('auth_panel_title')}</h2>
                                <p className="secure-gate-desc">
                                    {t('auth_panel_desc')}
                                </p>

                                {loginError && (
                                     <div className="anim-fade-in" style={{ 
                                         padding: '0.5rem 0.75rem', 
                                         background: 'rgba(239, 68, 68, 0.08)', 
                                         borderLeft: '2px solid #ef4444', 
                                         fontSize: '0.75rem', 
                                         display: 'flex', 
                                         alignItems: 'center', 
                                         gap: '0.5rem', 
                                         width: '100%', 
                                         color: '#f87171', 
                                         borderRadius: '2px',
                                         marginBottom: '1rem',
                                         boxSizing: 'border-box'
                                     }}>
                                         <AlertTriangle size={13} style={{ flexShrink: 0, color: '#ef4444' }} />
                                         <span style={{ textAlign: 'left', fontWeight: 500 }}>{loginError}</span>
                                     </div>
                                 )}

                                {/* Static Stable Form */}
                                <form onSubmit={handleSupabaseAuth} className="gate-form" noValidate>
                                    {/* Username Input */}
                                    <div className="gate-input-group">
                                        <label className="gate-input-label">{t('auth_username_label')}</label>
                                        <input 
                                            type="text" 
                                            className="gate-input-field" 
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder={t('auth_username_placeholder')}
                                            required
                                            disabled={authLoading}
                                            autoComplete="username"
                                        />
                                    </div>

                                    {/* Password Input */}
                                    <div className="gate-input-group">
                                        <label className="gate-input-label">{t('auth_password_label')}</label>
                                        <input 
                                            type="password" 
                                            className="gate-input-field" 
                                            value={supabasePassword}
                                            onChange={(e) => setSupabasePassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            disabled={authLoading}
                                            autoComplete="current-password"
                                        />
                                    </div>

                                    {/* Remember Me Checkbox */}
                                    {authTab === 'login' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.75rem 0 1rem 0' }}>
                                            <input 
                                                id="rememberMeCheckbox"
                                                type="checkbox" 
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                style={{ width: 'auto', margin: 0, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                                            />
                                            <label htmlFor="rememberMeCheckbox" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                                                {language === 'tr' ? 'Beni Hatırla' : 'Remember Me'}
                                            </label>
                                        </div>
                                    )}

                                    <button 
                                        type="submit" 
                                        className="secure-gate-btn-officer" 
                                        style={{ marginTop: '0.5rem' }}
                                        disabled={authLoading}
                                    >
                                        {authLoading ? t('auth_connecting') : authTab === 'login' ? t('auth_login_tab') : t('auth_send_request')}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Version indicator in bottom-right corner */}
            <div 
                className="version-pulse-glow"
                style={{
                    position: 'absolute',
                    bottom: '1.1rem',
                    right: '1.5rem',
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-body), sans-serif',
                    opacity: 1,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    zIndex: 10
                }}
            >
                v{version}
            </div>
        </div>
    );
});

SecureGateOverlay.displayName = 'SecureGateOverlay';
