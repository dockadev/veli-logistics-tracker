import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    UploadCloud,
    Trash2,
    Search,
    Compass,
    FileText,
    CheckCircle,
    AlertOctagon,
    AlertTriangle,
    Info,
    X,
    Truck,
    Bell,
    Megaphone,
    ShieldAlert,
    BarChart3,
    MessageSquare,
    Sliders,
    Moon,
    Sun,
    Lightbulb,
    Lock,
    Unlock
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { DepotSettingsModal } from './components/DepotSettingsModal';
import { SecureGateOverlay } from './components/SecureGateOverlay';
import { DepotSelectionModal } from './components/DepotSelectionModal';
import { CustomSelect } from './components/CustomSelect';
import { InventoryTab } from './components/InventoryTab';
import { CrossSearchTab } from './components/CrossSearchTab';
import { SupplyRequestsTab } from './components/SupplyRequestsTab';
import { CreateRequestModal } from './components/CreateRequestModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DepotDatabaseModal } from './components/DepotDatabaseModal';

import { DeveloperPortalModal } from './components/DeveloperPortalModal';
import { AnnouncementModal } from './components/AnnouncementModal';
import { NotificationsPanel } from './components/NotificationsPanel';
import { AnnouncementsTab } from './components/AnnouncementsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { CoalitionChat } from './components/CoalitionChat';
import { CompactOverlay } from './components/CompactOverlay';
import { FeedbackTab } from './components/FeedbackTab';
import { ManualCsvImportModal } from './components/ManualCsvImportModal';

import type { Depot, UserRole, SupplyRequest, RequestItem, SystemNotification, AuditLogEntry, PortalUser, ItemInfo } from './types';
import { parseCSV } from './utils/csvParser';
import { useLanguage, type TranslationKey, type Language } from './context/LanguageContext';
import { dbService } from './utils/dbService';
import { supabase, isSupabaseConfigured } from './utils/supabaseClient';
import { getRelativeTimeString } from './utils/helpers';

function getDepotMatchKey(fullName: string): string {
    const parts = fullName.split(/\s+-\s+/).map(p => p.trim());
    const region = parts[0] || '';
    const type = parts.find(p => {
        const l = p.toLowerCase();
        return l.includes('seaport') || l.includes('depot') || l.includes('port');
    }) || '';
    const name = parts[parts.length - 1] || '';
    return `${region.toLowerCase()}_${type.toLowerCase()}_${name.toLowerCase()}`;
}

const IS_TAURI = typeof window !== 'undefined' && !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

const getTauriApis = async () => {
    if (!IS_TAURI) return null;
    try {
        const windowApi = await import('@tauri-apps/api/window');
        const dpiApi = await import('@tauri-apps/api/dpi');
        return { windowApi, dpiApi };
    } catch (err) {
        console.error('Failed to import Tauri APIs:', err);
        return null;
    }
};

const APP_VERSION = '0.0.1';
const REMOTE_VERSION_URL = 'https://raw.githubusercontent.com/dockadev/foxhole-depot-tracker-releases/main/version.json';
const DOWNLOAD_REDIRECT_URL = 'https://github.com/dockadev/foxhole-depot-tracker-releases/releases';

export const App: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const [isVersionOutdated, setIsVersionOutdated] = useState(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch(REMOTE_VERSION_URL, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (data && typeof data.version === 'string') {
                    setLatestVersion(data.version);
                    if (data.version !== APP_VERSION) {
                        setIsVersionOutdated(true);
                    }
                }
            } catch (err) {
                console.error('Failed to check remote version:', err);
            }
        };
        checkVersion();
    }, []);

    const [masterKey, setMasterKey] = useState<string | null>(() => {
        return sessionStorage.getItem('docka_session_master_key');
    });
    const [userRole, setUserRole] = useState<UserRole | null>(() => {
        return sessionStorage.getItem('docka_session_role') as UserRole | null;
    });
    const [currentUsername, setCurrentUsername] = useState<string | null>(() => {
        return sessionStorage.getItem('docka_session_username');
    });
    const [userClan, setUserClan] = useState<string | null>(() => {
        const username = sessionStorage.getItem('docka_session_username');
        if (username) {
            const userSpecific = localStorage.getItem(`docka_user_clan_${username}`);
            if (userSpecific) return userSpecific;
        }
        return localStorage.getItem('docka_user_clan');
    });

    const [isOverlayMode, setIsOverlayMode] = useState<boolean>(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);

    useEffect(() => {
        if (userClan) {
            localStorage.setItem('docka_user_clan', userClan);
            if (currentUsername) {
                localStorage.setItem(`docka_user_clan_${currentUsername}`, userClan);
            }
        } else {
            localStorage.removeItem('docka_user_clan');
            if (currentUsername) {
                localStorage.removeItem(`docka_user_clan_${currentUsername}`);
            }
        }
    }, [userClan, currentUsername]);

    const handleToggleOverlayMode = useCallback(async (enable: boolean) => {
        if (!IS_TAURI) return;
        const apis = await getTauriApis();
        if (!apis) return;
        const { windowApi, dpiApi } = apis;
        const appWindow = windowApi.getCurrentWindow();

        try {
            if (enable) {
                await appWindow.setDecorations(false);
                await appWindow.setSize(new dpiApi.LogicalSize(320, 420));
                await appWindow.setResizable(false);
                await appWindow.setAlwaysOnTop(isAlwaysOnTop);
                setIsOverlayMode(true);
            } else {
                await appWindow.setDecorations(true);
                await appWindow.setSize(new dpiApi.LogicalSize(1400, 850));
                await appWindow.setResizable(true);
                await appWindow.setAlwaysOnTop(false);
                await appWindow.center();
                setIsOverlayMode(false);
            }
        } catch (err) {
            console.error('Failed to toggle overlay mode:', err);
        }
    }, [isAlwaysOnTop]);

    const handleToggleAlwaysOnTop = useCallback(async (pin: boolean) => {
        setIsAlwaysOnTop(pin);
        if (!IS_TAURI) return;
        const apis = await getTauriApis();
        if (!apis) return;
        try {
            const appWindow = apis.windowApi.getCurrentWindow();
            await appWindow.setAlwaysOnTop(pin);
        } catch (err) {
            console.error('Failed to set always on top:', err);
        }
    }, []);

    // Native window controls utilized instead of custom app-titlebar
    const [depots, setDepots] = useState<Record<string, Depot>>({});
    const [revealedDepotCode, setRevealedDepotCode] = useState<string | null>(null);
    const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
    const [activeDepotName, setActiveDepotName] = useState<string | null>(() => {
        return localStorage.getItem('foxhole_active_depot');
    });
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d'>(() => {
        return (localStorage.getItem('foxhole_analytics_time_range') as '1d' | '7d' | '30d') || '7d';
    });
    const [activeTab, setActiveTab] = useState<'inventory' | 'cross-search' | 'requests' | 'announcements' | 'dev-portal' | 'analytics' | 'feedback'>('inventory');
    const isDataLoadedRef = useRef(false);
    const isRemoteDepotsUpdateRef = useRef(false);
    const isRemoteRequestsUpdateRef = useRef(false);
    const announcementsChannelRef = useRef<import('@supabase/supabase-js').RealtimeChannel | null>(null);
    const pendingLogsRef = useRef<Record<string, Record<string, number>>>({});
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => {
        return !!sessionStorage.getItem('docka_session_master_key');
    });

    const [isDepotSelectorOpen, setIsDepotSelectorOpen] = useState(false);
    const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
    const [isDepotDbModalOpen, setIsDepotDbModalOpen] = useState(false);

    useEffect(() => {
        // Clear legacy glass overrides to ensure default CSS values are used
        localStorage.removeItem('docka_glass_blur');
        localStorage.removeItem('docka_glass_opacity');
    }, []);

    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const stored = localStorage.getItem('docka_theme');
        return (stored === 'light' ? 'light' : 'dark') as 'dark' | 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('docka_theme', theme);
    }, [theme]);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [lastSeenFeedbackTime, setLastSeenFeedbackTime] = useState<number>(() => {
        const val = localStorage.getItem('docka_feedback_last_seen_time');
        return val ? Number(val) : 0;
    });

    const handleTabChange = (tab: 'inventory' | 'cross-search' | 'requests' | 'announcements' | 'dev-portal' | 'analytics' | 'feedback') => {
        setActiveTab(tab);
        setIsChatOpen(false);
        setIsPersonalizeOpen(false);
        if (tab === 'feedback' || tab === 'dev-portal') {
            const now = Date.now();
            localStorage.setItem('docka_feedback_last_seen_time', String(now));
            setLastSeenFeedbackTime(now);
        }
    };



    // Feature addition states
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isCriticalStockOpen, setIsCriticalStockOpen] = useState(false);
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
    const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);

    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [feedbacks, setFeedbacks] = useState<{ id: string; username: string; message: string; created_at: string; category?: 'bug' | 'idea'; status?: 'pending' | 'in_progress' | 'completed' }[]>(() => {
        const localFeedbacks = localStorage.getItem('docka_feedbacks');
        if (localFeedbacks) {
            try {
                return JSON.parse(localFeedbacks);
            } catch {
                return [];
            }
        }
        return [];
    });

    useEffect(() => {
        if (!isSupabaseConfigured || !supabase || !masterKey || userRole !== 'developer') return;

        const fetchFeedbacks = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase
                    .from('feedbacks')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) {
                    console.warn('[App] Supabase feedbacks fetch failed (table might not exist):', error.message);
                } else if (data) {
                    setFeedbacks(data);
                    localStorage.setItem('docka_feedbacks', JSON.stringify(data));
                }
            } catch (err) {
                console.error('[App] Feedbacks load error:', err);
            }
        };

        fetchFeedbacks();
    }, [masterKey, userRole]);

    // Modal states
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);
    const [isDepotSettingsOpen, setIsDepotSettingsOpen] = useState(false);

    // Toast states
    const [toast, setToast] = useState<{
        message: string;
        type: 'success' | 'info' | 'error' | 'warning';
    } | null>(null);
    const [toastVisible, setToastVisible] = useState(false);

    const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' | 'warning') => {
        setToast({ message, type });
        setToastVisible(true);
    }, []);

    useEffect(() => {
        if (!toastVisible || !toast) return;
        const exitTimer = setTimeout(() => {
            setToastVisible(false);
        }, 5000);
        return () => clearTimeout(exitTimer);
    }, [toastVisible, toast]);

    useEffect(() => {
        if (toast && !toastVisible) {
            const cleanupTimer = setTimeout(() => {
                setToast(null);
            }, 300);
            return () => clearTimeout(cleanupTimer);
        }
    }, [toastVisible, toast]);

    // Local logging service
    const logAction = useCallback((action: string) => {
        const username = currentUsername || (userRole === 'developer' ? 'Developer' : userRole === 'officer' ? 'LogiOfficer' : 'LogiMember');
        const entry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            username,
            role: userRole || 'member',
            action
        };
        setAuditLogs(prev => {
            const next = [entry, ...prev].slice(0, 300);
            localStorage.setItem('docka_audit_logs', JSON.stringify(next));
            return next;
        });
    }, [userRole, currentUsername]);

    const checkCriticalStock = useCallback((depotName: string, items: Record<string, ItemInfo>) => {
        console.debug('checkCriticalStock stub called for:', depotName, Object.keys(items).length);
    }, []);

    // Helper: Decrypt and load data from dbService
    const decryptAndLoadData = useCallback(async (key: string) => {
        try {
            // Decrypt depots
            const parsedDepots = await dbService.loadDepots(key);
            setDepots(parsedDepots || {});

            // Decrypt supply requests
            const parsedRequests = await dbService.loadRequests(key);
            if (Array.isArray(parsedRequests)) {
                const sanitized = parsedRequests.map((req: SupplyRequest) => ({
                    ...req,
                    claimedBy: Array.isArray(req.claimedBy) 
                        ? req.claimedBy 
                        : (req.claimedBy ? [req.claimedBy] : [])
                }));
                setSupplyRequests(sanitized);
            } else {
                setSupplyRequests([]);
            }
            
            // Load features states
            const storedNotifs = localStorage.getItem('docka_notifications');
            if (storedNotifs) setNotifications(JSON.parse(storedNotifs));

            if (isSupabaseConfigured && supabase) {
                try {
                    const { data: profiles, error } = await supabase
                        .from('profiles')
                        .select('id, username, role, status');
                    if (error) {
                        console.error('[App] Failed to load portal users from Supabase:', error);
                    } else if (profiles) {
                        const mappedUsers: PortalUser[] = profiles.map((p: { id: string; username: string | null; role: string | null; status: string | null }) => {
                            return {
                                id: p.id,
                                username: p.username || 'Unknown',
                                role: (p.role as UserRole) || 'member',
                                status: (p.status || 'pending') as 'pending' | 'approved' | 'rejected'
                            };
                        });
                        setPortalUsers(mappedUsers);
                        localStorage.setItem('docka_portal_users', JSON.stringify(mappedUsers));
                    }
                } catch (err) {
                    console.error('[App] Supabase session fetch failed for portal users:', err);
                }
            } else {
                const storedUsers = localStorage.getItem('docka_portal_users');
                if (storedUsers) {
                    setPortalUsers(JSON.parse(storedUsers));
                } else {
                    setPortalUsers([]);
                }
            }

            const storedAuditLogs = localStorage.getItem('docka_audit_logs');
            if (storedAuditLogs) setAuditLogs(JSON.parse(storedAuditLogs));

            isDataLoadedRef.current = true;
        } catch (e) {
            console.error('Failed to decrypt database', e);
            showToast('Failed to decrypt database. Incorrect key or data corruption.', 'error');
        } finally {
            setIsInitialLoading(false);
        }
    }, [showToast]);

    // Effects to decrypt when masterKey is available
    useEffect(() => {
        if (masterKey) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            decryptAndLoadData(masterKey);
        }
    }, [masterKey, decryptAndLoadData]);

    // Helpers to encrypt and save data
    const saveEncryptedDepots = useCallback(async (nextDepots: Record<string, Depot>, key: string, skipSupabase = false) => {
        try {
            await dbService.saveDepots(nextDepots, key, skipSupabase);
        } catch (e) {
            console.error('Failed to save depots', e);
        }
    }, []);

    const saveEncryptedRequests = useCallback(async (nextRequests: SupplyRequest[], key: string, skipSupabase = false) => {
        try {
            await dbService.saveRequests(nextRequests, key, skipSupabase);
        } catch (e) {
            console.error('Failed to save requests', e);
        }
    }, []);

    // Effect to encrypt and save depots
    useEffect(() => {
        if (masterKey && isDataLoadedRef.current) {
            const skip = isRemoteDepotsUpdateRef.current;
            isRemoteDepotsUpdateRef.current = false;
            saveEncryptedDepots(depots, masterKey, skip);
        }
    }, [depots, masterKey, saveEncryptedDepots]);

    // Effect to encrypt and save requests immediately (fixes race condition with real-time Postgres channel)
    useEffect(() => {
        if (masterKey && isDataLoadedRef.current) {
            const skip = isRemoteRequestsUpdateRef.current;
            isRemoteRequestsUpdateRef.current = false;

            if (skip) {
                // Remote update received - skip saving
                return;
            }

            // Save requests immediately
            saveEncryptedRequests(supplyRequests, masterKey, false);

            // Process and write pending audit logs in bulk (without timeout/debounce delay)
            const logs = pendingLogsRef.current;
            pendingLogsRef.current = {}; // reset to prevent race conditions
            
            Object.entries(logs).forEach(([reqId, items]) => {
                const itemEntries = Object.entries(items).filter(([, amt]) => amt !== 0);
                if (itemEntries.length > 0) {
                    const itemsStr = itemEntries.map(([name, amt]) => `${amt > 0 ? '+' : ''}${amt} ${name}`).join(', ');
                    logAction(`Registered delivery: ${itemsStr} in request #${reqId.substring(0, 5).toUpperCase()}.`);
                }
            });
        }
    }, [supplyRequests, masterKey, saveEncryptedRequests, logAction]);

    // Save active depot name to localStorage
    useEffect(() => {
        if (activeDepotName) {
            localStorage.setItem('foxhole_active_depot', activeDepotName);
        } else {
            localStorage.removeItem('foxhole_active_depot');
        }
    }, [activeDepotName]);

    // Save analytics time range to localStorage
    useEffect(() => {
        localStorage.setItem('foxhole_analytics_time_range', timeRange);
    }, [timeRange]);

    // Ensure we have an active depot selected if list is not empty
    useEffect(() => {
        if (!activeDepotName || (activeDepotName !== 'all' && !depots[activeDepotName])) {
            const keys = Object.keys(depots);
            if (keys.length > 0) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setActiveDepotName('all');
            } else {
                setActiveDepotName(null);
            }
        }
    }, [depots, activeDepotName]);

    const importCSVData = useCallback((text: string) => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_csv'), 'error');
            return false;
        }

        const trimmed = text.trim();
        if (!trimmed) {
            showToast(t('paste_csv_first'), 'warning');
            return false;
        }

        const parsed = parseCSV(trimmed);
        if (!parsed) {
            showToast(t('invalid_csv_format'), 'error');
            return false;
        }

        if ('error' in parsed && parsed.error) {
            showToast(t(parsed.error as TranslationKey) || parsed.error, 'error');
            return false;
        }

        const { location, timestamp, items } = parsed as { location: string; timestamp: string; items: Record<string, ItemInfo> };

        if (location === '__proto__' || location === 'constructor') {
            showToast(t('invalid_depot_name'), 'error');
            return false;
        }

        // Rule 3 check: If depot has no positive count materials, skip import
        if (Object.keys(items).length === 0) {
            showToast(t('no_items_positive_qty'), 'error');
            return false;
        }

        const parsedMatchKey = getDepotMatchKey(location);
        const matchedKey = Object.keys(depots).find(k => getDepotMatchKey(k) === parsedMatchKey);
        const isUpdate = !!matchedKey;

        setDepots(prev => {
            const nextDepots = { ...prev };
            const targetKey = matchedKey || location;
            const prevDepot = nextDepots[targetKey];

            if (prevDepot) {
                if (prevDepot.lastUpdated === timestamp) {
                    nextDepots[targetKey] = {
                        ...prevDepot,
                        name: location,
                        lastUpdated: timestamp,
                        current: items
                    };
                } else {
                    nextDepots[targetKey] = {
                        ...prevDepot,
                        name: location,
                        lastUpdated: timestamp,
                        previous: prevDepot.current,
                        current: items
                    };
                }

                // If key changed (e.g. sub-region segments changed or OLD parser key matches NEW key), rename key in record
                if (matchedKey && matchedKey !== location) {
                    nextDepots[location] = nextDepots[matchedKey];
                    delete nextDepots[matchedKey];
                }
            } else {
                nextDepots[location] = {
                    name: location,
                    customName: null,
                    lastUpdated: timestamp,
                    previous: null,
                    current: items
                };
            }
            return nextDepots;
        });

        setActiveDepotName(location);
        showToast(isUpdate ? t('import_updated', { location }) : t('import_success', { location }), 'success');
        
        // Log action & scan critical stock alarms
        logAction(isUpdate ? `Updated stock data for depot: ${location}` : `Imported stock data for depot: ${location}`);
        checkCriticalStock(location, items);
        return true;
    }, [userRole, depots, showToast, t, logAction, checkCriticalStock]);



    const handleLoginSuccess = useCallback((role: UserRole, key: string) => {
        sessionStorage.setItem('docka_session_master_key', key);
        sessionStorage.setItem('docka_session_role', role);
        setIsInitialLoading(true);
        setMasterKey(key);
        setUserRole(role);
        const username = sessionStorage.getItem('docka_session_username');
        setCurrentUsername(username);
        
        // Load user-specific clan tag if exists
        if (username) {
            const storedClan = localStorage.getItem(`docka_user_clan_${username}`);
            if (storedClan) {
                setUserClan(storedClan);
            }
        }
        
        let roleLabel = t('member_access');
        if (role === 'developer') roleLabel = t('developer_access');
        else if (role === 'officer') roleLabel = t('officer_access');
        
        showToast(t('authorized_access', { role: roleLabel }), 'success');
    }, [showToast, t]);

    const handleDisconnect = useCallback(() => {
        sessionStorage.removeItem('docka_session_master_key');
        sessionStorage.removeItem('docka_session_role');
        sessionStorage.removeItem('docka_session_username');
        isDataLoadedRef.current = false;
        setMasterKey(null);
        setUserRole(null);
        setCurrentUsername(null);
        setUserClan(null);
        setDepots({});
        setSupplyRequests([]);
        setNotifications([]);
        setAuditLogs([]);
        showToast(t('session_terminated'), 'info');
    }, [showToast, t]);

    // Real-time Supabase Subscriptions
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase || !masterKey) return;

        // 1. Subscribe to profiles changes
        const profilesChannel = supabase
            .channel('public-profiles')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                async (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string } }) => {
                    console.log('[Real-time] Profile changed:', payload);
                    const updatedProfile = payload.new as Partial<PortalUser>;
                    
                    if (updatedProfile) {
                        // If the updated profile is for the logged-in user, apply role change in real-time
                        if (updatedProfile.id === masterKey) {
                            const nextRole = updatedProfile.role as UserRole;
                            const nextStatus = updatedProfile.status;
                            
                            if (nextRole && nextRole !== sessionStorage.getItem('docka_session_role')) {
                                setUserRole(nextRole);
                                sessionStorage.setItem('docka_session_role', nextRole);
                                showToast(`Your role has been updated to ${nextRole}.`, 'info');
                            }
                            
                            if (nextStatus === 'rejected') {
                                showToast('Your access has been revoked by a developer.', 'error');
                                handleDisconnect();
                                return;
                            }
                        }

                        // Update portalUsers list in real-time
                        setPortalUsers(prev => {
                            const exists = prev.some(u => u.id === updatedProfile.id);
                            const mappedUser: PortalUser = {
                                id: updatedProfile.id || '',
                                username: updatedProfile.username || 'Unknown',
                                role: updatedProfile.role || 'member',
                                status: (updatedProfile.status || 'pending') as PortalUser['status']
                            };

                            if (payload.eventType === 'INSERT') {
                                if (exists) return prev;
                                return [...prev, mappedUser];
                            } else if (payload.eventType === 'UPDATE') {
                                return prev.map(u => u.id === updatedProfile.id ? mappedUser : u);
                            } else if (payload.eventType === 'DELETE') {
                                const oldId = payload.old?.id;
                                return oldId ? prev.filter(u => u.id !== oldId) : prev;
                            }
                            return prev;
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Real-time] Profiles subscription status:', status);
            });

        // 2. Subscribe to supply_requests changes
        const requestsChannel = supabase
            .channel('public-supply-requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'supply_requests' },
                (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string } }) => {
                    console.log('[Real-time] Supply request changed:', payload);
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new as { id: string; data: string | SupplyRequest; status: 'open' | 'completed' };
                        const parsedData = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                            ? JSON.parse(row.data)
                            : row.data;
                        const requestItem = {
                            ...parsedData,
                            id: row.id,
                            status: row.status,
                            claimedBy: Array.isArray(parsedData.claimedBy)
                                ? parsedData.claimedBy
                                : (parsedData.claimedBy ? [parsedData.claimedBy] : [])
                        } as SupplyRequest;

                        setSupplyRequests(prev => {
                            const existingIdx = prev.findIndex(r => r.id === requestItem.id);
                            if (existingIdx !== -1) {
                                const existing = prev[existingIdx];
                                // Compare content to avoid triggering update on identical payload
                                if (JSON.stringify(existing) === JSON.stringify(requestItem)) {
                                    return prev;
                                }
                                isRemoteRequestsUpdateRef.current = true;
                                const next = [...prev];
                                next[existingIdx] = requestItem;
                                return next;
                            }
                            isRemoteRequestsUpdateRef.current = true;
                            return [requestItem, ...prev];
                        });
                    } else if (payload.eventType === 'DELETE') {
                        if (payload.old?.id) {
                            const oldId = payload.old.id;
                            setSupplyRequests(prev => {
                                const exists = prev.some(r => r.id === oldId);
                                if (!exists) return prev;
                                isRemoteRequestsUpdateRef.current = true;
                                return prev.filter(r => r.id !== oldId);
                            });
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Real-time] Supply requests subscription status:', status);
            });

        // 3. Subscribe to depots changes
        const depotsChannel = supabase
            .channel('public-depots')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'depots' },
                (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string; name?: string } }) => {
                    console.log('[Real-time] Depot changed:', payload);
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new as { name: string; data: string | Depot };
                        const parsedData = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                            ? JSON.parse(row.data)
                            : row.data;
                        setDepots(prev => {
                            const existing = prev[row.name];
                            if (existing && JSON.stringify(existing) === JSON.stringify(parsedData)) {
                                return prev;
                            }
                            isRemoteDepotsUpdateRef.current = true;
                            return {
                               ...prev,
                                [row.name]: parsedData
                            };
                        });
                    } else if (payload.eventType === 'DELETE') {
                        if (payload.old?.name) {
                            const oldName = payload.old.name;
                            setDepots(prev => {
                                if (!prev[oldName]) return prev;
                                isRemoteDepotsUpdateRef.current = true;
                                const next = { ...prev };
                                delete next[oldName];
                                return next;
                            });
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Real-time] Depots subscription status:', status);
            });

        // 4. Subscribe to announcements broadcast
        const announcementsChannel = supabase
            .channel('public-announcements')
            .on('broadcast', { event: 'new-announcement' }, (payload) => {
                console.log('[Real-time Broadcast] Announcement received:', payload);
                const newAnn = payload.payload as SystemNotification;
                setNotifications(prev => {
                    const exists = prev.some(n => n.id === newAnn.id);
                    if (exists) return prev;
                    const next = [newAnn, ...prev];
                    localStorage.setItem('docka_notifications', JSON.stringify(next));
                    return next;
                });
                showToast("Yeni bir duyuru paylaşıldı!", "info");
            })
            .subscribe((status) => {
                console.log('[Real-time Broadcast] Announcements subscription status:', status);
            });

        announcementsChannelRef.current = announcementsChannel;

        return () => {
            if (supabase) {
                supabase.removeChannel(profilesChannel);
                supabase.removeChannel(requestsChannel);
                supabase.removeChannel(depotsChannel);
                supabase.removeChannel(announcementsChannel);
            }
        };
    }, [masterKey, handleDisconnect, showToast, t]);



    const handleClearAllData = useCallback(() => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: t('clear_db_confirm_title'),
            message: t('clear_db_confirm_msg'),
            onConfirm: () => {
                setDepots({});
                setSupplyRequests([]);
                localStorage.removeItem('docka_enc_depots');
                localStorage.removeItem('docka_enc_requests');
                localStorage.removeItem('docka_notifications');
                localStorage.removeItem('docka_audit_logs');
                setNotifications([]);
                setAuditLogs([]);
                setActiveDepotName(null);
                if (isSupabaseConfigured && supabase) {
                    dbService.clearAllData();
                }
                setConfirmModal(null);
                showToast(t('clear_db_success'), 'warning');
                logAction('Cleared all depot nodes and logistics request entries from local storage.');
            }
        });
    }, [userRole, showToast, t, logAction]);

    const handleClearAuditLogs = useCallback(() => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: t('clear_logs_confirm_title'),
            message: t('clear_logs_confirm_msg'),
            onConfirm: () => {
                setAuditLogs([]);
                localStorage.removeItem('docka_audit_logs');
                setConfirmModal(null);
                showToast(t('clear_logs_success'), 'info');
                logAction('Cleared audit log history.');
            }
        });
    }, [userRole, showToast, t, logAction]);

    const handleDeleteActiveDepot = useCallback(() => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        if (!activeDepotName) return;
        const displayName = depots[activeDepotName]?.customName || activeDepotName;
        setConfirmModal({
            isOpen: true,
            title: t('delete_depot_confirm_title'),
            message: t('delete_depot_confirm_msg', { displayName }),
            onConfirm: () => {
                setDepots(prev => {
                    const nextDepots = { ...prev };
                    delete nextDepots[activeDepotName];
                    return nextDepots;
                });
                if (isSupabaseConfigured && supabase) {
                    dbService.deleteDepot(activeDepotName);
                }
                setConfirmModal(null);
                showToast(t('delete_depot_success', { displayName }), 'info');
                logAction(`Deleted depot node: ${activeDepotName}`);
            }
        });
    }, [userRole, activeDepotName, depots, showToast, t, logAction]);

    const handleSaveDepotSettings = useCallback((newCustomName: string, accessCode: string, isCodePublic: boolean) => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_settings'), 'error');
            return;
        }
        if (!activeDepotName) return;
        setDepots(prev => {
            const nextDepots = { ...prev };
            if (nextDepots[activeDepotName]) {
                nextDepots[activeDepotName] = {
                    ...nextDepots[activeDepotName],
                    customName: newCustomName || null,
                    accessCode: accessCode || undefined,
                    isCodePublic: isCodePublic
                };
            }
            return nextDepots;
        });
        setIsDepotSettingsOpen(false);
        showToast(t('settings_updated'), 'success');
        logAction(`Updated settings for depot ${activeDepotName}. Custom name: ${newCustomName || 'None'}, code public: ${isCodePublic}`);
    }, [userRole, activeDepotName, showToast, t, logAction]);

    const handleCreateSupplyRequest = useCallback((
        depotName: string,
        items: RequestItem[]
    ) => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_create_req'), 'error');
            return;
        }
        const newRequest: SupplyRequest = {
            id: crypto.randomUUID(),
            depotName,
            items,
            createdTime: new Date().toISOString(),
            status: 'open',
            claimedBy: []
        };
        setSupplyRequests(prev => [newRequest, ...prev]);
        setIsCreateRequestOpen(false);
        showToast(t('request_created', { count: items.length }), 'success');

        // Create notification
        const alertMsg = `Supply request opened for ${depots[depotName]?.customName || depotName} (${items.length} items).`;
        const newNotif: SystemNotification = {
            id: crypto.randomUUID(),
            type: 'request_created',
            message: alertMsg,
            timestamp: new Date().toISOString(),
            isRead: false
        };
        setNotifications(prev => {
            const next = [newNotif, ...prev];
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });

        logAction(`Created supply request #${newRequest.id.substring(0, 5).toUpperCase()} containing ${items.length} items.`);
    }, [userRole, showToast, t, depots, logAction]);

    const handleUpdateProgress = useCallback((requestId: string, itemIndex: number, amount: number) => {
        setSupplyRequests(prev => prev.map(req => {
            if (req.id === requestId) {
                const itemsList = req.items || [];
                const updatedItems = itemsList.map((item, idx) => {
                    if (idx === itemIndex) {
                        const nextDelivered = Math.min(item.quantityRequired, item.quantityDelivered + amount);
                        return {
                            ...item,
                            quantityDelivered: nextDelivered
                        };
                    }
                    return item;
                });
                const allCompleted = updatedItems.every(item => item.quantityDelivered >= item.quantityRequired);
                const nextStatus: 'open' | 'completed' = allCompleted ? 'completed' : req.status;

                return {
                    ...req,
                    items: updatedItems,
                    status: nextStatus
                };
            }
            return req;
        }));

        const req = supplyRequests.find(r => r.id === requestId);
        if (req) {
            const itemsList = req.items || [];
            let name = '';
            const updatedItems = itemsList.map((item, idx) => {
                if (idx === itemIndex) {
                    name = item.itemName;
                    const nextDelivered = Math.min(item.quantityRequired, item.quantityDelivered + amount);
                    return { ...item, quantityDelivered: nextDelivered };
                }
                return item;
            });
            const allCompleted = updatedItems.every(item => item.quantityDelivered >= item.quantityRequired);
            const willBeCompleted = allCompleted && req.status !== 'completed';

            if (willBeCompleted) {
                logAction(`Supply request #${requestId.substring(0, 5).toUpperCase()} completed.`);
            }

            showToast(t('cargo_delivered'), 'success');
            
            // Queue delivery logs for bulk write instead of writing immediately
            if (!pendingLogsRef.current[requestId]) {
                pendingLogsRef.current[requestId] = {};
            }
            pendingLogsRef.current[requestId][name] = (pendingLogsRef.current[requestId][name] || 0) + amount;
        }
    }, [supplyRequests, depots, showToast, t, logAction]);

    const handleToggleCompleteItem = useCallback((requestId: string, itemIndex: number) => {
        const req = supplyRequests.find(r => r.id === requestId);
        if (!req) return;

        const item = req.items?.[itemIndex];
        if (!item) return;

        const isItemDone = item.quantityDelivered >= item.quantityRequired;
        if (isItemDone && userRole === 'member') {
            showToast(t('role_officer_required_reopen'), 'error');
            return;
        }

        setSupplyRequests(prev => prev.map(r => {
            if (r.id === requestId) {
                const itemsList = r.items || [];
                const updatedItems = itemsList.map((itm, idx) => {
                    if (idx === itemIndex) {
                        return {
                            ...itm,
                            quantityDelivered: isItemDone ? 0 : itm.quantityRequired
                        };
                    }
                    return itm;
                });
                const allCompleted = updatedItems.every(itm => itm.quantityDelivered >= itm.quantityRequired);
                const nextStatus: 'open' | 'completed' = allCompleted ? 'completed' : 'open';

                return {
                    ...r,
                    items: updatedItems,
                    status: nextStatus
                };
            }
            return r;
        }));

        const itemsList = req.items || [];
        let itmName = '';
        const updatedItems = itemsList.map((itm, idx) => {
            if (idx === itemIndex) {
                itmName = itm.itemName;
                return {
                    ...itm,
                    quantityDelivered: isItemDone ? 0 : itm.quantityRequired
                };
            }
            return itm;
        });
        const allCompleted = updatedItems.every(itm => itm.quantityDelivered >= itm.quantityRequired);
        const willBeCompleted = allCompleted && req.status !== 'completed';

        if (willBeCompleted) {
            logAction(`Supply request #${requestId.substring(0, 5).toUpperCase()} completed.`);
        }

        showToast(t('item_status_toggled'), 'info');
        logAction(`Toggled complete status of item: ${itmName} in request #${requestId.substring(0, 5).toUpperCase()}.`);
    }, [supplyRequests, userRole, showToast, t, logAction]);

    const handleToggleComplete = useCallback((requestId: string) => {
        const req = supplyRequests.find(r => r.id === requestId);
        if (!req) return;

        const isNowCompleted = req.status !== 'completed';
        if (!isNowCompleted && userRole === 'member') {
            showToast(t('role_officer_required_reopen'), 'error');
            return;
        }

        setSupplyRequests(prev => prev.map(r => {
            if (r.id === requestId) {
                const nextStatus: 'open' | 'completed' = isNowCompleted ? 'completed' : 'open';
                const itemsList = r.items || [];
                const updatedItems = itemsList.map(item => ({
                    ...item,
                    quantityDelivered: isNowCompleted ? item.quantityRequired : 0
                }));

                return {
                    ...r,
                    status: nextStatus,
                    items: updatedItems
                };
            }
            return r;
        }));

        if (isNowCompleted) {
            logAction(`Manually completed supply request #${requestId.substring(0, 5).toUpperCase()}.`);
        } else {
            logAction(`Reopened supply request #${requestId.substring(0, 5).toUpperCase()}.`);
        }
        showToast(t('request_status_updated'), 'info');
    }, [supplyRequests, userRole, showToast, t, logAction]);

    const handleDeleteRequest = useCallback((requestId: string) => {
        if (userRole === 'member') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: t('delete_request_confirm_title'),
            message: t('delete_request_confirm_msg'),
            onConfirm: () => {
                setSupplyRequests(prev => prev.filter(req => req.id !== requestId));
                if (isSupabaseConfigured && supabase) {
                    dbService.deleteRequest(requestId);
                }
                setConfirmModal(null);
                showToast(t('request_removed'), 'info');
                logAction(`Deleted supply request #${requestId.substring(0, 5).toUpperCase()}.`);
            }
        });
    }, [userRole, showToast, t, logAction]);



    // Manage Notifications Panel Actions (General vs Critical Stock)
    const handleMarkGeneralNotificationsRead = useCallback(() => {
        setNotifications(prev => {
            const next = prev.map(n => n.type !== 'critical_stock' ? { ...n, isRead: true } : n);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
    }, []);

    const handleMarkCriticalStockRead = useCallback(() => {
        setNotifications(prev => {
            const next = prev.map(n => n.type === 'critical_stock' ? { ...n, isRead: true } : n);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
    }, []);

    const handleClearGeneralNotifications = useCallback(() => {
        setNotifications(prev => {
            const next = prev.filter(n => n.type === 'critical_stock');
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
    }, []);

    const handleClearCriticalStock = useCallback(() => {
        setNotifications(prev => {
            const next = prev.filter(n => n.type !== 'critical_stock');
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
    }, []);

    const handleDeleteNotification = useCallback((id: string) => {
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
    }, []);

    const handleNotificationClick = useCallback((notif: SystemNotification) => {
        setNotifications(prev => {
            const next = prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
        setIsNotificationsOpen(false);
        setIsCriticalStockOpen(false);
        if (notif.type === 'announcement') {
            setActiveTab('announcements');
        } else if (notif.type === 'request_created') {
            setActiveTab('requests');
        }
    }, []);

    const handlePublishAnnouncement = useCallback((title: string, content: string, severity: 'normal' | 'high' | 'critical') => {
        // Push notification
        const authorName = currentUsername || (userRole === 'developer' ? 'Developer' : 'Officer');
        const newNotif: SystemNotification = {
            id: crypto.randomUUID(),
            type: 'announcement',
            message: `${title}: "${content}"`,
            timestamp: new Date().toISOString(),
            isRead: false,
            announcementTitle: title,
            announcementContent: content,
            announcementSeverity: severity,
            announcementAuthor: authorName,
            announcementRole: (userRole === 'developer' ? 'developer' : 'officer') as UserRole
        };
        setNotifications(prev => {
            const next = [newNotif, ...prev];
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });

        // Broadcast to other users in real-time
        if (isSupabaseConfigured && supabase && announcementsChannelRef.current) {
            announcementsChannelRef.current.send({
                type: 'broadcast',
                event: 'new-announcement',
                payload: newNotif
            });
        }

        logAction(`Published global announcement [${severity}]: ${title} - ${content}`);
        showToast('Announcement published successfully', 'success');
        setActiveTab('announcements');
    }, [userRole, showToast, logAction, currentUsername]);

    const handleDeleteAnnouncement = useCallback((id: string) => {
        if (userRole === 'member') {
            showToast('You do not have permission to delete announcements', 'error');
            return;
        }
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });
        logAction(`Deleted announcement entry #${id.substring(0, 5)}`);
        showToast('Announcement deleted successfully', 'info');
    }, [userRole, showToast, logAction]);

    const handleSendFeedback = useCallback(async (messageText: string, category: 'bug' | 'idea') => {
        const newFeedback = {
            id: crypto.randomUUID(),
            username: currentUsername || 'Guest',
            message: messageText,
            category,
            status: 'pending' as const,
            created_at: new Date().toISOString()
        };

        // Optimistic local update
        setFeedbacks(prev => {
            const next = [newFeedback, ...prev];
            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('feedbacks')
                    .insert([
                        {
                            username: currentUsername || 'Guest',
                            message: messageText,
                            category,
                            status: 'pending'
                        }
                    ]);
                if (error) {
                    console.error('[App] Supabase feedback insert error:', error.message);
                    setFeedbacks(prev => {
                        const next = prev.filter(f => f.id !== newFeedback.id);
                        localStorage.setItem('docka_feedbacks', JSON.stringify(next));
                        return next;
                    });
                    if (error.message.includes('public.feedbacks') || error.message.includes('schema cache')) {
                        showToast(language === 'tr' 
                            ? 'Veritabanı hatası: public.feedbacks tablosu bulunamadı. Lütfen feedbacks_schema.sql dosyasını veritabanında çalıştırın.' 
                            : 'Database error: public.feedbacks table not found. Please run feedbacks_schema.sql on your database.', 'error');
                    } else {
                        showToast(language === 'tr' ? 'Geri bildirim veritabanına kaydedilemedi.' : 'Could not save feedback to database.', 'error');
                    }
                } else {
                    showToast(language === 'tr' ? 'Geri bildiriminiz başarıyla gönderildi.' : 'Your feedback was successfully submitted.', 'success');
                    // Fetch latest to stay synchronized
                    const { data } = await supabase
                        .from('feedbacks')
                        .select('*')
                        .order('created_at', { ascending: false });
                    if (data) {
                        setFeedbacks(data);
                        localStorage.setItem('docka_feedbacks', JSON.stringify(data));
                    }
                }
            } catch (err) {
                console.error('[App] Feedback submission error:', err);
                setFeedbacks(prev => {
                    const next = prev.filter(f => f.id !== newFeedback.id);
                    localStorage.setItem('docka_feedbacks', JSON.stringify(next));
                    return next;
                });
                showToast(language === 'tr' ? 'Geri bildirim gönderilemedi.' : 'Could not send feedback.', 'error');
            }
        } else {
            showToast(language === 'tr' ? 'Geri bildiriminiz yerel olarak kaydedildi (Çevrimdışı Mod).' : 'Your feedback was saved locally (Offline Mode).', 'success');
        }
    }, [currentUsername, language, showToast]);

    const handleDeleteFeedback = useCallback(async (id: string) => {
        setFeedbacks(prev => {
            const next = prev.filter(fb => fb.id !== id);
            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('feedbacks')
                    .delete()
                    .eq('id', id);
                if (error) {
                    console.error('[App] Supabase feedback delete error:', error.message);
                    showToast(language === 'tr' ? 'Geri bildirim silinemedi.' : 'Could not delete feedback.', 'error');
                } else {
                    showToast(language === 'tr' ? 'Geri bildirim başarıyla silindi.' : 'Feedback successfully deleted.', 'success');
                }
            } catch (err) {
                console.error('[App] Feedback delete error:', err);
            }
        } else {
            showToast(language === 'tr' ? 'Geri bildirim yerel olarak silindi.' : 'Feedback deleted locally.', 'success');
        }
    }, [language, showToast]);

    const handleUpdateFeedbackStatus = useCallback(async (id: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
        setFeedbacks(prev => {
            const next = prev.map(fb => fb.id === id ? { ...fb, status: newStatus } : fb);
            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('feedbacks')
                    .update({ status: newStatus })
                    .eq('id', id);
                if (error) {
                    console.error('[App] Supabase feedback status update error:', error.message);
                    showToast(language === 'tr' ? 'Geri bildirim durumu güncellenemedi.' : 'Could not update feedback status.', 'error');
                } else {
                    showToast(language === 'tr' ? 'Geri bildirim durumu güncellendi.' : 'Feedback status successfully updated.', 'success');
                }
            } catch (err) {
                console.error('[App] Feedback status update error:', err);
            }
        } else {
            showToast(language === 'tr' ? 'Geri bildirim durumu yerel olarak güncellendi.' : 'Feedback status updated locally.', 'success');
        }
    }, [language, showToast]);

    // Manage Developer Portal Admin Operations
    const handleApproveUser = useCallback(async (id: string, approvedRole?: 'member' | 'officer') => {
        let username = '';
        let targetRole: UserRole = 'member';
        setPortalUsers(prev => {
            const next = prev.map(u => {
                if (u.id === id) {
                    username = u.username;
                    targetRole = approvedRole || u.role;
                    return { ...u, role: targetRole, status: 'approved' as const };
                }
                return u;
            });
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ 
                        status: 'approved',
                        role: targetRole
                    })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to approve user in Supabase:', err);
                showToast('Failed to sync approval to database.', 'error');
            }
        }

        logAction(`Approved registration request for user ${username}.`);
        showToast(`Approved registration for ${username}`, 'success');
    }, [showToast, logAction]);

    const handleRejectUser = useCallback(async (id: string) => {
        let username = '';
        setPortalUsers(prev => {
            const next = prev.map(u => {
                if (u.id === id) {
                    username = u.username;
                    return { ...u, status: 'rejected' as const };
                }
                return u;
            });
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ status: 'rejected' })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to reject user in Supabase:', err);
                showToast('Failed to sync rejection to database.', 'error');
            }
        }

        logAction(`Rejected registration request for user ${username}.`);
        showToast(`Rejected registration for ${username}`, 'warning');
    }, [showToast, logAction]);

    const handlePromoteUser = useCallback(async (id: string) => {
        let username = '';
        setPortalUsers(prev => {
            const next = prev.map(u => {
                if (u.id === id) {
                    username = u.username;
                    return { ...u, role: 'officer' as const };
                }
                return u;
            });
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: 'officer' })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to promote user in Supabase:', err);
                showToast('Failed to sync promotion to database.', 'error');
            }
        }

        logAction(`Promoted user ${username} to Officer role.`);
        showToast(`Promoted ${username} to Officer`, 'success');
    }, [showToast, logAction]);

    const handleDemoteUser = useCallback(async (id: string) => {
        let username = '';
        setPortalUsers(prev => {
            const next = prev.map(u => {
                if (u.id === id) {
                    username = u.username;
                    return { ...u, role: 'member' as const };
                }
                return u;
            });
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: 'member' })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to demote user in Supabase:', err);
                showToast('Failed to demote user in Supabase.', 'error');
            }
        }

        logAction(`Demoted user ${username} to Member role.`);
        showToast(`Demoted ${username} to Member`, 'info');
    }, [showToast, logAction]);


    const activeDepot = useMemo(() => {
        if (!activeDepotName) return null;
        if (activeDepotName === 'all') {
            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';
            Object.values(depots).forEach(dep => {
                if (dep.lastUpdated && dep.lastUpdated > latestUpdated) {
                    latestUpdated = dep.lastUpdated;
                }
                if (dep.current) {
                    Object.entries(dep.current).forEach(([itemName, itemInfo]) => {
                        if (!mergedCurrent[itemName]) {
                            mergedCurrent[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedCurrent[itemName].count += itemInfo.count;
                    });
                }
                if (dep.previous) {
                    Object.entries(dep.previous).forEach(([itemName, itemInfo]) => {
                        if (!mergedPrevious[itemName]) {
                            mergedPrevious[itemName] = { count: 0, category: itemInfo.category };
                        }
                        mergedPrevious[itemName].count += itemInfo.count;
                    });
                }
            });
            return {
                name: 'all',
                customName: t('all_depots') || 'Tüm Depolar',
                current: mergedCurrent,
                previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null,
                lastUpdated: latestUpdated || new Date().toISOString()
            } as Depot;
        }
        return depots[activeDepotName] || null;
    }, [activeDepotName, depots, t]);

    const depotOptions = useMemo(() => {
        const options = [
            { value: 'all', label: t('all_depots') || 'Tüm Depolar' }
        ];
        Object.entries(depots).forEach(([name, dep]) => {
            options.push({
                value: name,
                label: dep.customName || dep.name
            });
        });
        return options;
    }, [depots, t]);

    const hasCodeAccess = userRole === 'officer' || userRole === 'developer' || !!activeDepot?.isCodePublic;
    const isCodeRevealed = revealedDepotCode === activeDepotName;
    const unreadCount = notifications.filter(n => n.type !== 'critical_stock' && !n.isRead).length;
    const unreadFeedbackCount = userRole === 'developer'
        ? feedbacks.filter(f => new Date(f.created_at).getTime() > lastSeenFeedbackTime).length
        : 0;

    if (isVersionOutdated) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: '#0a0b0d',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-body)',
                color: '#fff',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <div style={{
                    maxWidth: '480px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2.5rem',
                    backdropFilter: 'blur(20px)'
                }}>
                    <AlertOctagon size={48} style={{ color: '#ef4444', marginBottom: '1.25rem', display: 'inline-block' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', margin: '0 0 1rem 0', fontFamily: 'var(--font-heading)' }}>
                        Update Required
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 2rem 0' }}>
                        You are using an outdated version of the application (v{APP_VERSION}). A new update (v{latestVersion || 'unknown'}) is available. Please download and install the latest version to continue.
                    </p>
                    <button
                        onClick={() => window.open(DOWNLOAD_REDIRECT_URL, '_blank')}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer'
                        }}
                    >
                        <UploadCloud size={16} />
                        <span>Download Update</span>
                    </button>
                </div>
            </div>
        );
    }

    if (!userRole || !masterKey) {
        return (
            <div className="react-root-container">
                <SecureGateOverlay 
                    onLoginSuccess={handleLoginSuccess} 
                    theme={theme}
                    setTheme={setTheme}
                />
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="react-root-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
                <div className="anim-pulse-glow" style={{ textAlign: 'center' }}>
                    <Compass size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 1.25rem auto', display: 'block' }} />
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                        {language === 'tr' ? 'Veritabanı Şifresi Çözülüyor...' : 'Decrypting Logistics Database...'}
                    </div>
                </div>
            </div>
        );
    }

    if (isOverlayMode) {
        return (
            <div className="react-root-container" style={{ background: 'transparent' }}>
                <CompactOverlay
                    language={language}
                    onCloseOverlay={() => handleToggleOverlayMode(false)}
                    onImportCSV={importCSVData}
                    isAlwaysOnTop={isAlwaysOnTop}
                    onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
                />
                {toast && (
                    <div className="toast-container">
                        <div className={`toast-message ${toast.type} ${!toastVisible ? 'toast-fade-out' : ''}`}>
                            {toast.type === 'success' && <CheckCircle size={18} />}
                            {toast.type === 'error' && <AlertOctagon size={18} />}
                            {toast.type === 'warning' && <AlertTriangle size={18} />}
                            {toast.type === 'info' && <Info size={18} />}
                            <div className="toast-content">{toast.message}</div>
                            
                            <div className="toast-timer-ring">
                                <svg width="18" height="18" viewBox="0 0 20 20">
                                    <circle cx="10" cy="10" r="8" fill="transparent" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                    <circle className="toast-timer-ring-fill" cx="10" cy="10" r="8" fill="transparent" stroke="currentColor" strokeWidth="2" strokeDasharray="50.24" strokeDashoffset="0" />
                                </svg>
                            </div>

                            <button className="toast-close" onClick={() => setToastVisible(false)}>
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="react-root-container">
            <header className="main-header">
                <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative' }}>
                    <div className="logo-area" style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="logo-brand" onClick={() => setActiveTab('inventory')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
                                <span className="logo-text-word" style={{ fontSize: '1.1rem', letterSpacing: '0.04em', fontWeight: 800, color: 'var(--text-primary)' }}>VELI Logistics</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>Logistics Tracker App</span>
                            </div>
                        </div>
                    </div>

                    {/* Welcome message in the center of Header */}
                    <div className="header-welcome-message" style={{ 
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.78rem', 
                        fontWeight: 700, 
                        fontFamily: 'var(--font-heading)',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        pointerEvents: 'none'
                    }}>
                        <span>
                            {language === 'tr' ? 'Hoş geldin,' : 'Welcome,'}
                        </span>
                        {userClan && (
                            <span className="clan-tag-badge" style={{
                                background: 'rgba(217, 83, 30, 0.15)',
                                color: 'var(--accent-color)',
                                border: '1px solid rgba(217, 83, 30, 0.35)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                letterSpacing: '0.03em'
                            }}>
                                {userClan}
                            </span>
                        )}
                        <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                            {currentUsername || 'User'}
                        </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => setIsNotificationsOpen(true)}
                            className="btn btn-secondary"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: '0.35rem 0.5rem', 
                                position: 'relative',
                                background: 'transparent'
                            }}
                            title={t('notifications')}
                        >
                            <Bell size={15} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    background: 'var(--color-negative)',
                                    color: '#fff',
                                    borderRadius: '50%',
                                    fontSize: '0.55rem',
                                    width: '13px',
                                    height: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="app-container">
                {isInitialLoading && !activeDepot && Object.keys(depots).length === 0 ? (
                    <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                        <Compass size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <h2 style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('select_depot')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                            {language === 'tr' 
                                ? 'Envanter durumunu görüntülemek, analizleri incelemek veya lojistik siparişleri yönetmek için lütfen yukarıdaki menüden bir depo seçin.' 
                                : 'Please select a depot from the top dropdown menu to inspect stock levels, analyze runway forecast or manage production requests.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="data-panel" style={{ position: 'relative' }}>
                            {!activeDepot && (activeTab === 'inventory' || activeTab === 'cross-search') ? (
                        <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                            <div className="empty-row" style={{ border: 'none' }}>
                                <Compass size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4, display: 'block' }} />
                                <p>{t('no_active_depot')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeDepot && (activeTab === 'inventory' || activeTab === 'cross-search' || activeTab === 'analytics') && (
                                <div className="depot-interface-header">
                                    <div className="depot-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: activeTab === 'analytics' ? '100%' : 'auto' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: activeTab === 'analytics' ? 'space-between' : 'flex-start', width: '100%', flexWrap: 'wrap' }}>
                                            <CustomSelect
                                                options={depotOptions}
                                                value={activeDepotName || 'all'}
                                                onChange={(val) => setActiveDepotName(val)}
                                                className="header-depot-select"
                                            />
                                            {activeTab === 'analytics' && (
                                                <div style={{ 
                                                    display: 'flex', 
                                                    background: theme === 'light' ? 'var(--bg-surface)' : 'rgba(0, 0, 0, 0.25)', 
                                                    padding: '3px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid var(--border-color)',
                                                    alignItems: 'center'
                                                }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTimeRange('1d')}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            background: timeRange === '1d' ? 'var(--accent-color)' : 'transparent',
                                                            color: timeRange === '1d' ? '#06060c' : 'var(--text-secondary)',
                                                            border: 'none',
                                                            borderRadius: '5px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {language === 'tr' ? '1 Gün' : '1 Day'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTimeRange('7d')}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            background: timeRange === '7d' ? 'var(--accent-color)' : 'transparent',
                                                            color: timeRange === '7d' ? '#06060c' : 'var(--text-secondary)',
                                                            border: 'none',
                                                            borderRadius: '5px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {language === 'tr' ? '7 Gün' : '7 Days'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setTimeRange('30d')}
                                                        style={{
                                                            padding: '0.35rem 0.65rem',
                                                            background: timeRange === '30d' ? 'var(--accent-color)' : 'transparent',
                                                            color: timeRange === '30d' ? '#06060c' : 'var(--text-secondary)',
                                                            border: 'none',
                                                            borderRadius: '5px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {language === 'tr' ? '1 Ay' : '1 Month'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {(activeTab === 'inventory' || activeTab === 'cross-search' || activeTab === 'analytics') && (
                                            <>
                                                <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.35rem 0 0 0' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                        {activeDepotName === 'all' ? (t('global_search_desc') || 'Tüm depoların verilerinde arama yapın.') : `${t('location')}: ${activeDepot.name}`}
                                                    </span>
                                                    <span style={{ color: 'var(--text-muted)' }}>|</span>
                                                    <span style={{ 
                                                        fontWeight: 700, 
                                                        fontSize: '0.85rem', 
                                                        color: 'var(--accent-color)'
                                                     }}>
                                                        {t('last_updated')}: <span title={activeDepot.lastUpdated}>{getRelativeTimeString(activeDepot.lastUpdated, language)}</span>
                                                     </span>
                                                </p>
                                                
                                                {activeDepot.accessCode && (
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.5rem', 
                                                        marginTop: '0.35rem',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-secondary)'
                                                    }}>
                                                        {hasCodeAccess ? (
                                                            <div 
                                                                onClick={() => setRevealedDepotCode(prev => prev === activeDepotName ? null : activeDepotName)}
                                                                style={{ 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.4rem', 
                                                                    background: 'rgba(255, 255, 255, 0.05)', 
                                                                    padding: '0.2rem 0.5rem', 
                                                                    borderRadius: '4px',
                                                                    border: '1px solid var(--border-color)',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none'
                                                                }}
                                                                title={t('click_to_reveal')}
                                                            >
                                                                {isCodeRevealed ? <Unlock size={12} className="text-positive" /> : <Lock size={12} className="text-warning" />}
                                                                <span>{t('access_code')}:</span>
                                                                <span style={{ 
                                                                    fontFamily: 'monospace', 
                                                                    fontWeight: 'bold', 
                                                                    letterSpacing: '0.1em',
                                                                    filter: isCodeRevealed ? 'none' : 'blur(4px)',
                                                                    transition: 'filter 0.2s ease',
                                                                    color: 'var(--accent-color)'
                                                                }}>
                                                                    {activeDepot.accessCode}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ 
                                                                display: 'inline-flex', 
                                                                alignItems: 'center', 
                                                                gap: '0.4rem', 
                                                                background: 'rgba(255, 0, 0, 0.05)', 
                                                                padding: '0.2rem 0.5rem', 
                                                                borderRadius: '4px',
                                                                border: '1px solid rgba(255, 0, 0, 0.15)',
                                                                color: 'var(--color-negative)'
                                                            }}>
                                                                <Lock size={12} />
                                                                <span>{t('access_code')}: {t('code_locked_for_members')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {userRole !== 'member' && activeDepotName !== 'all' && activeTab !== 'analytics' && (
                                        <div className="depot-actions">
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => setIsDepotSettingsOpen(true)}
                                                style={{ fontSize: '0.7rem', padding: '0.35rem 0.75rem', marginRight: '0.5rem' }}
                                            >
                                                {t('edit_settings')}
                                            </button>
                                            <button
                                                className="btn btn-secondary text-negative"
                                                onClick={handleDeleteActiveDepot}
                                                style={{ fontSize: '0.7rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center' }}
                                            >
                                                <Trash2 size={14} style={{ marginRight: '0.4rem' }} />
                                                {t('delete_depot')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'requests' && (
                                <div className="depot-interface-header">
                                    <div className="depot-title-group">
                                        <h2>{t('supply_request_board')}</h2>
                                        <p>{t('supply_request_board_desc')}</p>
                                    </div>
                                </div>
                            )}



                            {activeTab === 'dev-portal' && (
                                <div className="depot-interface-header">
                                    <div className="depot-title-group">
                                        <h2>{userRole === 'officer' ? 'Officer Portal' : t('developer_portal')}</h2>
                                        <p>{userRole === 'officer' ? 'Access historical logistics logs and security operations records.' : t('developer_portal_desc')}</p>
                                    </div>
                                </div>
                            )}


                            {/* Tab Contents */}
                            {activeTab === 'inventory' && (
                                <ErrorBoundary>
                                    <InventoryTab
                                        depots={depots}
                                        activeDepotName={activeDepotName}
                                    />
                                </ErrorBoundary>
                            )}
                            {activeTab === 'cross-search' && (
                                <ErrorBoundary>
                                    <CrossSearchTab depots={depots} />
                                </ErrorBoundary>
                            )}
                            {activeTab === 'requests' && (
                                <ErrorBoundary>
                                    <SupplyRequestsTab
                                        requests={supplyRequests}
                                        userRole={userRole}
                                        depots={depots}
                                        onOpenCreateModal={() => setIsCreateRequestOpen(true)}
                                        onUpdateProgress={handleUpdateProgress}
                                        onToggleCompleteItem={handleToggleCompleteItem}
                                        onDeleteRequest={handleDeleteRequest}
                                        onToggleRequestStatus={handleToggleComplete}
                                    />
                                </ErrorBoundary>
                            )}
                            {activeTab === 'announcements' && (
                                 <ErrorBoundary>
                                     <AnnouncementsTab
                                         announcements={notifications.filter(n => n.type === 'announcement').map(n => {
                                             if (n.announcementTitle) {
                                                 return {
                                                     id: n.id,
                                                     title: n.announcementTitle,
                                                     content: n.announcementContent || '',
                                                     severity: n.announcementSeverity || 'normal',
                                                     author: n.announcementAuthor || 'System',
                                                     role: n.announcementRole || 'member',
                                                     timestamp: n.timestamp,
                                                     seenBy: n.seenBy || []
                                                 };
                                             }
                                             // Fallback parser for old format
                                             const msg = n.message || '';
                                             let severity: 'normal' | 'high' | 'critical' = 'normal';
                                             if (msg.startsWith('[HIGH]')) severity = 'high';
                                             else if (msg.startsWith('[CRITICAL]')) severity = 'critical';

                                             const cleanMsg = msg.replace(/^\[.*?\]\s*/, '');
                                             const parts = cleanMsg.split(' from ');
                                             const titleAndContent = parts[0] || '';
                                             const authorPart = parts[1] || '';
                                             const author = authorPart.replace(/:$/, '').trim() || 'System';
                                             const role = author.toLowerCase() === 'developer' ? 'developer' : 'officer';

                                             const colonIdx = titleAndContent.indexOf(':');
                                             const title = colonIdx !== -1 ? titleAndContent.substring(0, colonIdx).trim() : 'Announcement';
                                             let content = colonIdx !== -1 ? titleAndContent.substring(colonIdx + 1).trim() : titleAndContent;
                                             if (content.startsWith('"') && content.endsWith('"')) {
                                                 content = content.substring(1, content.length - 1);
                                             }

                                             return {
                                                 id: n.id,
                                                 title: title,
                                                 content: content,
                                                 severity: severity,
                                                 author: author,
                                                 role: role as UserRole,
                                                 timestamp: n.timestamp,
                                                 seenBy: n.seenBy || []
                                             };
                                         })}
                                         onOpenPublishModal={userRole !== 'member' ? () => setIsAnnouncementOpen(true) : undefined}
                                         userRole={userRole}
                                         onDeleteAnnouncement={handleDeleteAnnouncement}
                                     />
                                 </ErrorBoundary>
                             )}
                             {activeTab === 'analytics' && (
                                  <ErrorBoundary>
                                       <AnalyticsTab depots={depots} theme={theme} supplyRequests={supplyRequests} auditLogs={auditLogs} activeDepotName={activeDepotName} timeRange={timeRange} />
                                  </ErrorBoundary>
                              )}
                             {activeTab === 'feedback' && (
                                 <ErrorBoundary>
                                     <FeedbackTab
                                         language={language}
                                         onSendFeedback={handleSendFeedback}
                                     />
                                 </ErrorBoundary>
                             )}
                             {activeTab === 'dev-portal' && userRole !== 'member' && (
                                 <ErrorBoundary>
                                     <DeveloperPortalModal
                                         users={portalUsers}
                                         onApproveUser={handleApproveUser}
                                         onRejectUser={handleRejectUser}
                                         onPromoteUser={handlePromoteUser}
                                         onDemoteUser={handleDemoteUser}
                                         userRole={userRole}
                                         auditLogs={auditLogs}
                                         onClearAuditLogs={handleClearAuditLogs}
                                         feedbacks={feedbacks}
                                         onDeleteFeedback={handleDeleteFeedback}
                                         onUpdateFeedbackStatus={handleUpdateFeedbackStatus}
                                     />
                                 </ErrorBoundary>
                             )}
                        </>
                    )}
                </section>
                    </>
                )}
            </main>

            <footer className="main-footer">
                <p>{t('tactical_logistics_dashboard')}</p>
            </footer>

            {/* Modals */}
            {confirmModal && (
                <ConfirmModal
                    isOpen={!!confirmModal}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {isDepotSettingsOpen && (
                <DepotSettingsModal
                    isOpen={isDepotSettingsOpen}
                    currentCustomName={activeDepot?.customName || null}
                    currentName={activeDepot?.name || ''}
                    currentAccessCode={activeDepot?.accessCode || ''}
                    currentIsCodePublic={activeDepot?.isCodePublic ?? false}
                    onSave={handleSaveDepotSettings}
                    onClose={() => setIsDepotSettingsOpen(false)}
                />
            )}

            {isDepotSelectorOpen && (
                <DepotSelectionModal
                    isOpen={isDepotSelectorOpen}
                    depots={depots}
                    activeDepotName={activeDepotName}
                    onSelect={(name) => {
                        setActiveDepotName(name);
                        setIsDepotSelectorOpen(false);
                    }}
                    onClose={() => setIsDepotSelectorOpen(false)}
                />
            )}



            {/* Integrated Navigation Tabs (Left Vertical Sidebar Menu) */}
            <div className={`vertical-navigation-sidebar anim-fade-in ${isChatOpen || isPersonalizeOpen ? 'forced-collapsed' : ''}`}>
                <button
                    className="vertical-nav-btn"
                    onClick={() => setIsCsvModalOpen(true)}
                    data-tooltip={t('csv_input')}
                    type="button"
                >
                    <UploadCloud size={18} />
                    <span>{t('csv_input')}</span>
                </button>

                {IS_TAURI && (
                    <button
                        className="vertical-nav-btn capturer-nav-btn"
                        onClick={() => handleToggleOverlayMode(true)}
                        data-tooltip={t('csv_capturer')}
                        type="button"
                    >
                        <Compass size={18} style={{ color: 'var(--accent-color)' }} />
                        <span style={{ color: 'var(--accent-color)' }}>{t('csv_capturer')}</span>
                    </button>
                )}

                <div style={{ width: '80%', height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '0.25rem auto' }} />

                <button
                    className={`vertical-nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => handleTabChange('inventory')}
                    data-tooltip={t('tab_inventory')}
                >
                    <FileText size={18} />
                    <span>{t('tab_inventory')}</span>
                </button>
                <button
                    className={`vertical-nav-btn ${activeTab === 'cross-search' ? 'active' : ''}`}
                    onClick={() => handleTabChange('cross-search')}
                    data-tooltip={t('tab_cross_search')}
                >
                    <Search size={18} />
                    <span>{t('tab_cross_search')}</span>
                </button>
                <button
                    className={`vertical-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => handleTabChange('requests')}
                    data-tooltip={t('tab_supply_requests')}
                >
                    <Truck size={18} />
                    <span>{t('tab_supply_requests')}</span>
                </button>
                <button
                    className={`vertical-nav-btn ${activeTab === 'announcements' ? 'active' : ''}`}
                    onClick={() => handleTabChange('announcements')}
                    data-tooltip={t('announcements')}
                >
                    <Megaphone size={18} />
                    <span>{t('announcements')}</span>
                </button>
                <button
                    className={`vertical-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => handleTabChange('analytics')}
                    data-tooltip="Analytics"
                >
                    <BarChart3 size={18} />
                    <span>Analytics</span>
                </button>
                
                {userRole !== 'member' && (
                    <button
                        className={`vertical-nav-btn dev-portal-nav-btn ${activeTab === 'dev-portal' ? 'active' : ''}`}
                        onClick={() => handleTabChange('dev-portal')}
                        data-tooltip={
                            unreadFeedbackCount > 0
                                ? (language === 'tr' ? `${unreadFeedbackCount} yeni bildirim` : `${unreadFeedbackCount} new notifications`)
                                : "Dev Portal"
                        }
                    >
                        <ShieldAlert size={18} />
                        <span>Dev Portal</span>
                        {unreadFeedbackCount > 0 && (
                            <span className="nav-badge">{unreadFeedbackCount}</span>
                        )}
                    </button>
                )}

                <button
                    className={`vertical-nav-btn ${activeTab === 'feedback' ? 'active' : ''}`}
                    onClick={() => handleTabChange('feedback')}
                    data-tooltip={language === 'tr' ? 'Geri Bildirim' : 'Feedback'}
                >
                    <Lightbulb size={18} />
                    <span>{language === 'tr' ? 'Geri Bildirim' : 'Feedback'}</span>
                </button>

                <button
                    className={`vertical-nav-btn ${isChatOpen ? 'active' : ''}`}
                    onClick={() => {
                        setIsChatOpen(!isChatOpen);
                        setIsPersonalizeOpen(false);
                    }}
                    data-tooltip={
                        chatUnreadCount > 0
                            ? (chatUnreadCount > 10
                                ? (language === 'tr' ? '10+ yeni mesaj' : '10+ new messages')
                                : (language === 'tr' ? `${chatUnreadCount} yeni mesaj` : `${chatUnreadCount} new messages`))
                            : (language === 'tr' ? 'Sohbet' : 'Chat')
                    }
                >
                    <MessageSquare size={18} />
                    <span>{language === 'tr' ? 'Sohbet' : 'Chat'}</span>
                    {chatUnreadCount > 0 && (
                        <span className="nav-badge">
                            {chatUnreadCount > 10 ? '10+' : chatUnreadCount}
                        </span>
                    )}
                </button>

                <button
                    className={`vertical-nav-btn ${isPersonalizeOpen ? 'active' : ''}`}
                    onClick={() => {
                        setIsPersonalizeOpen(!isPersonalizeOpen);
                        setIsChatOpen(false);
                    }}
                    data-tooltip={language === 'tr' ? 'Kişiselleştir' : 'Personalize'}
                >
                    <Sliders size={18} />
                    <span>{language === 'tr' ? 'Kişiselleştir' : 'Personalize'}</span>
                </button>

                <a
                    href="https://discord.gg/pars-foxhole"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vertical-nav-btn discord-nav-btn"
                    data-tooltip="PARS"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 127.14 96.36"
                        fill="currentColor"
                        style={{ flexShrink: 0 }}
                    >
                        <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.4-5c.87-.64,1.72-1.31,2.53-2a75.76,75.76,0,0,0,72.71,0c.81.7,1.66,1.37,2.53,2a68.43,68.43,0,0,1-10.4,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129,54.65,122.64,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
                    </svg>
                    <span>PARS</span>
                </a>
            </div>

            {/* Coalition Chat Widget (Bottom-right float) */}


            {isCreateRequestOpen && (
                <CreateRequestModal
                    isOpen={isCreateRequestOpen}
                    depots={depots}
                    activeDepotName={activeDepotName}
                    onSave={handleCreateSupplyRequest}
                    onClose={() => setIsCreateRequestOpen(false)}
                    showToast={showToast}
                />
            )}

            {isDepotDbModalOpen && (
                <DepotDatabaseModal
                    isOpen={isDepotDbModalOpen}
                    depots={depots}
                    activeDepotName={activeDepotName}
                    setActiveDepotName={setActiveDepotName}
                    onDetailedAnalysis={() => setActiveTab('analytics')}
                    onClearAllData={handleClearAllData}
                    userRole={userRole}
                    onClose={() => setIsDepotDbModalOpen(false)}
                />
            )}

            {/* Feature modals */}
            {isNotificationsOpen && (
                <NotificationsPanel
                    isOpen={isNotificationsOpen}
                    notifications={notifications.filter(n => n.type !== 'critical_stock')}
                    onMarkAllRead={handleMarkGeneralNotificationsRead}
                    onClearAll={handleClearGeneralNotifications}
                    onClose={() => setIsNotificationsOpen(false)}
                    onDeleteNotification={handleDeleteNotification}
                    onClickNotification={handleNotificationClick}
                />
            )}

            {isCriticalStockOpen && (
                <NotificationsPanel
                    isOpen={isCriticalStockOpen}
                    notifications={notifications.filter(n => n.type === 'critical_stock')}
                    onMarkAllRead={handleMarkCriticalStockRead}
                    onClearAll={handleClearCriticalStock}
                    onClose={() => setIsCriticalStockOpen(false)}
                    onDeleteNotification={handleDeleteNotification}
                    title={t('critical_stock_alerts')}
                    icon={<AlertTriangle size={18} style={{ color: '#f97316' }} />}
                    onClickNotification={handleNotificationClick}
                />
            )}

            {isAnnouncementOpen && (
                <AnnouncementModal
                    isOpen={isAnnouncementOpen}
                    onPublish={handlePublishAnnouncement}
                    onClose={() => setIsAnnouncementOpen(false)}
                />
            )}

            {isCsvModalOpen && (
                <ManualCsvImportModal
                    isOpen={isCsvModalOpen}
                    onClose={() => setIsCsvModalOpen(false)}
                    onImport={importCSVData}
                    userRole={userRole}
                />
            )}

            {/* Developer Portal is now a page tab, not a modal */}

            {userRole && masterKey && (
                <div style={{ display: isChatOpen ? 'block' : 'none' }}>
                    <ErrorBoundary>
                        <CoalitionChat 
                            currentUsername={currentUsername} 
                            userClan={userClan} 
                            theme={theme} 
                            userRole={userRole} 
                            showToast={showToast} 
                            isFloatingOnly={true}
                            isChatOpen={isChatOpen}
                            onUnreadChange={setChatUnreadCount}
                            onClose={() => setIsChatOpen(false)}
                        />
                    </ErrorBoundary>
                </div>
            )}

            {isPersonalizeOpen && (
                <ErrorBoundary>
                    <div 
                        className="personalize-popup-panel anim-fade-in"
                        style={{
                            position: 'fixed',
                            left: '5.5rem',
                            top: '110px',
                            width: '360px',
                            background: theme === 'dark' ? '#000000' : '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                            zIndex: 9999,
                            overflow: 'visible',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme === 'dark' ? '#000000' : 'rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <Sliders size={18} />
                                <h2>{language === 'tr' ? 'Kişiselleştir' : 'Personalize'}</h2>
                            </div>
                            <button 
                                type="button" 
                                className="modal-close"
                                onClick={() => setIsPersonalizeOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
                                aria-label="Close personalization settings"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem', overflow: 'visible' }}>
                            {/* Language Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {language === 'tr' ? 'Dil Seçimi' : 'Language'}
                                </span>
                                <CustomSelect
                                    options={[
                                        { value: 'en', label: 'English (EN)' },
                                        { value: 'tr', label: 'Türkçe (TR)' },
                                        { value: 'pt-BR', label: 'Português (Brasil) (PT-BR)' },
                                        { value: 'ru', label: 'Русский (RU)' },
                                        { value: 'de', label: 'Deutsch (DE)' }
                                    ]}
                                    value={language}
                                    onChange={(val) => setLanguage(val as Language)}
                                    placeholder={language === 'tr' ? 'Dil Seçin' : 'Select Language'}
                                />
                            </div>

                            {/* Theme Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {language === 'tr' ? 'Tema' : 'Theme'}
                                </span>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1rem',
                                    background: 'var(--btn-secondary-bg)',
                                    padding: '0.65rem 1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-color)',
                                    alignSelf: 'stretch'
                                }}>
                                    <Sun size={16} style={{ color: theme === 'light' ? 'var(--accent-color)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
                                    
                                    <label style={{
                                        position: 'relative',
                                        display: 'inline-block',
                                        width: '46px',
                                        height: '24px',
                                        cursor: 'pointer'
                                    }}>
                                        <input 
                                            type="checkbox" 
                                            checked={theme === 'dark'}
                                            onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                            borderRadius: '24px',
                                            border: '1px solid var(--border-color)',
                                            transition: 'background-color 0.2s'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                height: '16px',
                                                width: '16px',
                                                left: theme === 'dark' ? '24px' : '4px',
                                                bottom: '3px',
                                                backgroundColor: theme === 'dark' ? '#fff' : 'var(--accent-color)',
                                                borderRadius: '50%',
                                                transition: 'left 0.2s, background-color 0.2s',
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.4)'
                                            }} />
                                        </div>
                                    </label>
                                    
                                    <Moon size={16} style={{ color: theme === 'dark' ? 'var(--accent-color)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
                                </div>
                            </div>

                            {/* Regiment/Clan Tag Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {language === 'tr' ? 'Koalisyon Birliği (Regiment Tag)' : 'Regiment Tag'}
                                </span>
                                <CustomSelect
                                    options={[
                                        { value: '', label: language === 'tr' ? '-- Birlik Yok (No Regiment) --' : '-- No Regiment --' },
                                        ...['UBGE', 'PARS', 'JgF', 'G.H.R', 'RU', 'AFC', 'VOG', 'SBR'].map(clan => ({ value: clan, label: clan }))
                                    ]}
                                    value={userClan || ''}
                                    onChange={(val) => setUserClan(val || null)}
                                    placeholder={language === 'tr' ? 'Birlik Seçin' : 'Select Regiment'}
                                />
                            </div>
                        </div>
                    </div>
                </ErrorBoundary>
            )}

            {toast && (
                <div className="toast-container">
                    <div className={`toast-message ${toast.type} ${!toastVisible ? 'toast-fade-out' : ''}`}>
                        {toast.type === 'success' && <CheckCircle size={18} />}
                        {toast.type === 'error' && <AlertOctagon size={18} />}
                        {toast.type === 'warning' && <AlertTriangle size={18} />}
                        {toast.type === 'info' && <Info size={18} />}
                        <div className="toast-content">{toast.message}</div>
                        
                        {/* Premium Countdown Ring */}
                        <div className="toast-timer-ring">
                            <svg width="18" height="18" viewBox="0 0 20 20">
                                <circle cx="10" cy="10" r="8" fill="transparent" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                                <circle className="toast-timer-ring-fill" cx="10" cy="10" r="8" fill="transparent" stroke="currentColor" strokeWidth="2" strokeDasharray="50.24" strokeDashoffset="0" />
                            </svg>
                        </div>

                        <button className="toast-close" onClick={() => setToastVisible(false)}>
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
