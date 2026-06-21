import React, { useState, useEffect } from 'react';
import { Lock, AlertTriangle, UserPlus, LogIn, Clock, CheckCircle2, XCircle, Sun, Moon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { decryptWithPassword } from '../utils/crypto';
import type { UserRole, PortalUser } from '../types';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

interface SecureGateOverlayProps {
    onLoginSuccess: (role: UserRole, masterKey: string) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
}

// Developer-defined pre-encrypted payloads (using CryptoJS)
// Default passwords:
// Developer: ParsDeveloper2026
// Officer: ParsOfficer2026
// Member: ParsMember2026
const PRESET_CREDS = {
    wrappedDeveloper: {
        ciphertext: "BzRyyo9C1USwmIKofMmMAI5cbG4RCK+28KhZJ5EWQVydRKuTqKq9JD/zZfA6PQeW5wsafJrXZ/UBWSuZWL/+3g==",
        iv: "BE0jEEQQFgl95iJo5e1LYg==",
        salt: "i2WCVGhKg0WQQTFMaUhf9A=="
    },
    wrappedOfficer: {
        ciphertext: "CQ0zz8jzXFG7binkEas9JzvWFa+ktB4VQUg3A7vfheCQDs9r7q606TZLdj20VK",
        iv: "4dnlnHRwIKc4GWgkGRaIPA==",
        salt: "zQM0alw2YCSZ8fhmYbdrng=="
    },
    wrappedMember: {
        ciphertext: "6GMrtNwD+wbMaSyTDxJZJnP+nWABqRDyrPjjOrsIw5l+RhXZZV8pHS7nkifP4Kve",
        iv: "N0sSVybb2tJLHSR/lDQSTA==",
        salt: "slyonR9FCiEp5k5VXUCL0g=="
    },
    verification: {
        ciphertext: "Br072WeGxMXIOu85jizKLtCgA/AS6p36OdZPE0Zlktg=",
        iv: "xX2mSLm0oYJveVIB1lrPJw==",
        salt: "PwtC8DSWEKkGgzYR2MIjIQ=="
    }
};

export const SecureGateOverlay: React.FC<SecureGateOverlayProps> = React.memo(({ onLoginSuccess, theme, setTheme }) => {
    const { language, setLanguage, t } = useLanguage();

    // Local Mode State
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isDecrypting, setIsDecrypting] = useState(false);

    // Supabase Mode State
    const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [supabasePassword, setSupabasePassword] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [gateView, setGateView] = useState<'auth' | 'pending' | 'rejected' | 'approved'>('auth');
    const [approvedSessionData, setApprovedSessionData] = useState<{ role: UserRole; userId: string; username: string } | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [subtitleIndex, setSubtitleIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSubtitleIndex((prev) => (prev === 0 ? 1 : 0));
        }, 4000);
        return () => clearInterval(interval);
    }, []);



    // Browser-side self test to ensure Web Crypto API compatibility
    useEffect(() => {
        if (isSupabaseConfigured) return; // Skip test in Supabase mode

        const runSelfTest = async () => {
            try {
                const { wrappedDeveloper, wrappedOfficer, wrappedMember, verification } = PRESET_CREDS;
                console.log("[DOCKA Auth] Starting browser-side cryptography self-test...");
                
                const decMasterDev = await decryptWithPassword(wrappedDeveloper, "ParsDeveloper2026");
                const decMasterOfficer = await decryptWithPassword(wrappedOfficer, "ParsOfficer2026");
                const decMasterMember = await decryptWithPassword(wrappedMember, "ParsMember2026");
                const check = await decryptWithPassword(verification, decMasterOfficer);
                
                console.log("[DOCKA Auth] Self-test Developer Decrypt:", !!decMasterDev);
                console.log("[DOCKA Auth] Self-test Officer Decrypt:", !!decMasterOfficer);
                console.log("[DOCKA Auth] Self-test Member Decrypt:", !!decMasterMember);
                console.log("[DOCKA Auth] Self-test Verification Match:", check === 'DOCKA-AUTH-VERIFY');
                console.log("[DOCKA Auth] Browser self-test result: PASSED");
            } catch (err) {
                console.error("[DOCKA Auth] Browser self-test result: FAILED", err);
            }
        };
        runSelfTest();
    }, []);

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

    // Local Auth Handler
    const handleLocalLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsDecrypting(true);

        try {
            const { wrappedDeveloper, wrappedOfficer, wrappedMember, verification } = PRESET_CREDS;

            let decryptedMasterKey = '';
            let derivedRole: UserRole = 'member';

            try {
                decryptedMasterKey = await decryptWithPassword(wrappedDeveloper, password);
                derivedRole = 'developer';
            } catch {
                try {
                    decryptedMasterKey = await decryptWithPassword(wrappedOfficer, password);
                    derivedRole = 'officer';
                } catch {
                    try {
                        decryptedMasterKey = await decryptWithPassword(wrappedMember, password);
                        derivedRole = 'member';
                    } catch (memberErr) {
                        console.error('[DOCKA Auth] Decryption failed for Developer, Officer and Member keys:', memberErr);
                        throw new Error('Invalid Password', { cause: memberErr });
                    }
                }
            }

            const check = await decryptWithPassword(verification, decryptedMasterKey);
            if (check !== 'DOCKA-AUTH-VERIFY') {
                console.error('[DOCKA Auth] Verification payload mismatch. Key check failed.');
                throw new Error('Verification failed');
            }

            const defaultUsernames: Record<UserRole, string> = {
                developer: 'LocalDev',
                officer: 'LocalOfficer',
                member: 'LocalMember'
            };
            sessionStorage.setItem('docka_session_username', defaultUsernames[derivedRole]);

            onLoginSuccess(derivedRole, decryptedMasterKey);
        } catch (err) {
            console.error('[DOCKA Auth] Login process failed:', err);
            setLoginError(t('invalid_password'));
        } finally {
            setIsDecrypting(false);
        }
    };

    // Supabase Auth Handler (Username-to-Email Bypass)
    const handleSupabaseAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;

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
                        .select('role, status, username')
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
                        const approvalSeen = localStorage.getItem('docka_approval_seen_' + signInData.user.id);
                        if (approvalSeen === 'true') {
                            sessionStorage.setItem('docka_session_username', fetchedUsername);
                            onLoginSuccess(userRole, signInData.user.id);
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
            setPassword('');
            setSupabasePassword('');
            setUsername('');
            setLoginError('');
            setAuthLoading(false);
        }
    };

    const handleResetData = () => {
        setShowResetConfirm(true);
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
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '2px' }}>
                    <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        style={{
                            background: language === 'en' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'en' ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <svg viewBox="0 0 60 30" width="12" height="8" style={{ borderRadius: '1px' }}>
                            <rect width="60" height="30" fill="#012169"/>
                            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
                            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
                            <path d="M30,0 L30,30 M0,15 L60,15" stroke="#fff" strokeWidth="10"/>
                            <path d="M30,0 L30,30 M0,15 L60,15" stroke="#C8102E" strokeWidth="6"/>
                        </svg>
                        <span>EN</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setLanguage('tr')}
                        style={{
                            background: language === 'tr' ? 'var(--accent-color)' : 'transparent',
                            color: language === 'tr' ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '18px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <svg viewBox="0 0 30 20" width="12" height="8" style={{ borderRadius: '1px' }}>
                            <rect width="30" height="20" fill="#E30A17"/>
                            <circle cx="10" cy="10" r="5" fill="#fff"/>
                            <circle cx="11.25" cy="10" r="4" fill="#E30A17"/>
                            <polygon points="16.5,10 14.7,11.3 15.4,9.2 13.7,7.9 15.8,7.9" fill="#fff"/>
                        </svg>
                        <span>TR</span>
                    </button>
                </div>

                {/* Theme Toggle */}
                <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                    title={language === 'tr' ? 'Temayı Değiştir' : 'Change Theme'}
                >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
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
                            key={subtitleIndex}
                            className="anim-fade-in"
                            style={{ 
                                fontFamily: 'var(--font-body), "Plus Jakarta Sans", sans-serif',
                                fontSize: '0.92rem',
                                letterSpacing: '0.04em',
                                color: 'var(--text-secondary)',
                                margin: '0 0 1.5rem 0',
                                fontWeight: 500,
                                opacity: 0.95
                            }}
                        >
                            {subtitleIndex === 0 
                                ? 'VELI Koalisyonu için tasarlanmıştır' 
                                : 'Designed for VELI Coalition'
                            }
                        </p>
                        <span style={{ 
                            fontFamily: 'var(--font-body), "Plus Jakarta Sans", sans-serif',
                            fontSize: '0.74rem',
                            letterSpacing: '0.12em',
                            color: 'var(--text-secondary)',
                            opacity: 0.65,
                            fontWeight: 600,
                            textTransform: 'uppercase'
                        }}>
                            made by docka
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
                                    onClick={() => {
                                        if (approvedSessionData) {
                                            sessionStorage.setItem('docka_session_username', approvedSessionData.username);
                                            localStorage.setItem('docka_approval_seen_' + approvedSessionData.userId, 'true');
                                            onLoginSuccess(approvedSessionData.role, approvedSessionData.userId);
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
                            isSupabaseConfigured ? (
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
                                    <form onSubmit={handleSupabaseAuth} className="gate-form">
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
                            ) : (
                                /* Local Master Password Screen */
                                <form onSubmit={handleLocalLogin} className="gate-form">
                                    <div className="secure-gate-icon-wrapper">
                                        <Lock size={26} style={{ color: 'var(--gate-accent)' }} />
                                    </div>

                                    <h2 className="secure-gate-title">
                                        {t('tactical_intel_gateway')}
                                    </h2>
                                    <p className="secure-gate-desc">
                                        {t('enter_password')}
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

                                    <div className="gate-input-group" style={{ marginBottom: '0.5rem' }}>
                                        <input 
                                            type="password" 
                                            className="gate-input-field" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            style={{ textAlign: 'center', letterSpacing: '0.15em' }}
                                            placeholder="••••••••"
                                            required
                                            disabled={isDecrypting}
                                            autoComplete="new-password"
                                        />
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="secure-gate-btn-officer" 
                                        disabled={isDecrypting}
                                    >
                                        {isDecrypting ? t('auth_decrypting') : t('login_btn')}
                                    </button>

                                    <button 
                                        type="button" 
                                        onClick={handleResetData}
                                        className="secure-gate-btn-member" 
                                        style={{ 
                                            marginTop: '0.25rem', 
                                            color: 'var(--color-negative)',
                                            borderColor: 'rgba(244, 63, 94, 0.15)',
                                            background: 'rgba(244, 63, 94, 0.02)'
                                        }}
                                    >
                                        {t('reset_data_btn')}
                                    </button>
                                </form>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

SecureGateOverlay.displayName = 'SecureGateOverlay';
