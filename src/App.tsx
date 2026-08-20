import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    CheckCircle,
    AlertOctagon,
    AlertTriangle,
    Info,
    X,
    Bell,
    Megaphone,
    LogOut,
    Download,
    Database,
    Sliders,
    Pin
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { DepotSettingsModal } from './components/DepotSettingsModal';
import { SecureGateOverlay } from './components/SecureGateOverlay';
import { DepotSelectionModal } from './components/DepotSelectionModal';
import { CustomSelect } from './components/CustomSelect';
import { InventoryTab } from './components/InventoryTab';
import { SupplyRequestsTab } from './components/SupplyRequestsTab';
import { CreateRequestModal } from './components/CreateRequestModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DepotDatabaseModal } from './components/DepotDatabaseModal';
 
import { DeveloperPortalModal } from './components/DeveloperPortalModal';
import { AnnouncementModal } from './components/AnnouncementModal';
import { StockpilePasscodesTab } from './components/StockpilePasscodesTab';
import { NotificationsPanel } from './components/NotificationsPanel';
import { AnnouncementsTab } from './components/AnnouncementsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { StockpileTemplatesTab } from './components/StockpileTemplatesTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { TransferCalculatorTab } from './components/TransferCalculatorTab';
import { CoalitionChat } from './components/CoalitionChat';
import { DemandTab } from './components/DemandTab';
import { FeedbackTab } from './components/FeedbackTab';
import { DirectSyncTab } from './components/DirectSyncTab';
import { RegionManagementTab } from './components/RegionManagementTab';
import type { ParsedStockpile } from './utils/savParser';
import { getItemOfficialCategory } from './utils/itemCategories';

import type { Depot, UserRole, SupplyRequest, RequestItem, SystemNotification, AuditLogEntry, PortalUser, ItemInfo, DepotHistoryEntry, StockpileTemplates, RegionSettings } from './types';
import { useLanguage, type Language } from './context/LanguageContext';
import { dbService } from './utils/dbService';
import { getDefaultTemplates } from './utils/defaultTemplates';
import { supabase, isSupabaseConfigured } from './utils/supabaseClient';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { AppSidebar } from './components/AppSidebar';
import { getRelativeTimeString, getDepotDisplayName, getRelativeTimeColor, resolveTemplateSetting } from './utils/helpers';

function getDepotMatchKey(rawFullName: string): string {
    const fullName = rawFullName.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
    const parts = fullName.split(/\s+-\s+/).map(p => p.trim());
    const region = parts[0] || '';
    
    const typePart = parts.find((p, idx) => {
        const l = p.toLowerCase();
        if (idx === 0) return false;
        return (
            l.includes('seaport') || l.includes('depot') || (l.includes('port') && !l.includes('sableport')) ||
            l.includes('seehafen') || l.includes('porto') || l.includes('порт') ||
            l.includes('склад') || l.includes('lager') || l.includes('depósito')
        );
    }) || '';
    
    let type = typePart.toLowerCase();
    if (
        type.includes('seaport') || type.includes('seehafen') || 
        type.includes('porto') || type.includes('порт') || (type.includes('port') && !type.includes('sableport'))
    ) {
        type = 'seaport';
    } else if (
        type.includes('depot') || type.includes('depósito') || 
        type.includes('склад') || type.includes('lager')
    ) {
        type = 'storage depot';
    }
    
    let normalizedRegion = region.toLowerCase();
    if (normalizedRegion === 'the blemish') {
        normalizedRegion = 'blemish';
    }
    if (
        normalizedRegion === 'seaport' || normalizedRegion === 'seehafen' || 
        normalizedRegion === 'porto' || normalizedRegion === 'porto marítimo' || 
        normalizedRegion === 'port maritime' || normalizedRegion === 'морской порт' ||
        normalizedRegion === 'port'
    ) {
        normalizedRegion = 'seaport';
    } else if (
        normalizedRegion === 'storage depot' || normalizedRegion === 'lagerdepot' || 
        normalizedRegion === 'depósito de suprimentos' || normalizedRegion === 'depósito de armazenamento' || 
        normalizedRegion === 'dépôt de stockage' || normalizedRegion === 'dépôt' ||
        normalizedRegion === 'складское помещение' || normalizedRegion === 'склад'
    ) {
        normalizedRegion = 'storage depot';
    }

    const name = parts[parts.length - 1] || '';
    return `${normalizedRegion}_${type}_${name.toLowerCase()}`;
}

const IS_TAURI = typeof window !== 'undefined' && !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

const APP_VERSION = '0.2.0';

const isOutdatedVersion = (clientVer: string, minVer: string): boolean => {
    const parse = (v: string) => v.split('.').map(Number);
    const c = parse(clientVer);
    const m = parse(minVer);
    for (let i = 0; i < Math.max(c.length, m.length); i++) {
        const cVal = c[i] || 0;
        const mVal = m[i] || 0;
        if (cVal < mVal) return true;
        if (cVal > mVal) return false;
    }
    return false;
};

const openExternalUrl = async (url: string) => {
    if (IS_TAURI) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch (err) {
            console.error('Failed to open URL via Tauri:', err);
            window.open(url, '_blank');
        }
    } else {
        window.open(url, '_blank');
    }
};

const resolveRegionForDepotName = (depotName: string | null, depots: Record<string, Depot>): string | null => {
    if (!depotName || depotName === 'all') return null;
    if (depotName.startsWith('town:')) {
        const townGroup = depotName.substring(5);
        return townGroup.split(' - ')[0].trim();
    }
    const target = depots[depotName];
    if (target) {
        return target.name.split(' - ')[0].trim();
    }
    return depotName.split(' - ')[0].trim();
};

export const App: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();


    const [masterKey, setMasterKey] = useState<string | null>(() => {
        return sessionStorage.getItem('docka_session_master_key') || localStorage.getItem('docka_session_master_key');
    });
    const [userRole, setUserRole] = useState<UserRole | null>(() => {
        return (sessionStorage.getItem('docka_session_role') || localStorage.getItem('docka_session_role')) as UserRole | null;
    });
    const [currentUsername, setCurrentUsername] = useState<string | null>(() => {
        return sessionStorage.getItem('docka_session_username') || localStorage.getItem('docka_session_username');
    });
    const [userClan, setUserClan] = useState<string | null>(() => {
        const username = sessionStorage.getItem('docka_session_username') || localStorage.getItem('docka_session_username');
        if (username) {
            const userSpecific = localStorage.getItem(`docka_user_clan_${username}`);
            if (userSpecific) return userSpecific;
        }
        return localStorage.getItem('docka_user_clan');
    });

    const [_showProductionBoardInfo, setShowProductionBoardInfo] = useState(false);
    const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowProductionBoardInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    useEffect(() => {
        if (userClan) {
            localStorage.setItem('docka_user_clan', userClan);
            if (currentUsername) {
                localStorage.setItem(`docka_user_clan_${currentUsername}`, userClan);
            }
            if (isSupabaseConfigured && supabase && masterKey) {
                supabase
                    .from('profiles')
                    .update({ clan: userClan })
                    .eq('id', masterKey)
                    .then(({ error }) => {
                        if (error) console.error('[App] Failed to sync clan to Supabase:', error);
                    });
            }
        } else {
            localStorage.removeItem('docka_user_clan');
            if (currentUsername) {
                localStorage.removeItem(`docka_user_clan_${currentUsername}`);
            }
            if (isSupabaseConfigured && supabase && masterKey) {
                supabase
                    .from('profiles')
                    .update({ clan: null })
                    .eq('id', masterKey)
                    .then(({ error }) => {
                        if (error) console.error('[App] Failed to clear clan from Supabase:', error);
                    });
            }
        }
    }, [userClan, currentUsername, masterKey]);

    // Native window controls utilized instead of custom app-titlebar
    const [depots, setDepots] = useState<Record<string, Depot>>({});
    useEffect(() => {
        (window as any).debugDepots = depots;
    }, [depots]);
    const [templates, setTemplates] = useState<StockpileTemplates>(getDefaultTemplates());
    const [regionSettings, setRegionSettings] = useState<RegionSettings>({});
    const [activeSubDepotFilter, setActiveSubDepotFilter] = useState<string>('all');
    const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
    const [activeDepotName, setActiveDepotName] = useState<string | null>(() => {
        return localStorage.getItem('foxhole_active_depot');
    });
    const [activeTab, setActiveTab] = useState<'inventory' | 'passcodes' | 'requests' | 'announcements' | 'dev-portal' | 'analytics' | 'feedback' | 'leaderboard' | 'templates' | 'transfer-calculator' | 'demand' | 'direct-sync' | 'region-management'>('inventory');
    const [minAppVersion, setMinAppVersion] = useState<string>('0.1.60');
    const isDataLoadedRef = useRef(false);
    const isRemoteDepotsUpdateRef = useRef(false);
    const isRemoteRequestsUpdateRef = useRef(false);
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

    const theme: 'dark' | 'light' = 'dark';
    const setTheme = (_val: 'dark' | 'light') => {};

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('docka_theme', theme);
        if (isSupabaseConfigured && supabase && masterKey) {
            supabase
                .from('profiles')
                .update({ theme })
                .eq('id', masterKey)
                .then(({ error }) => {
                    if (error) console.error('[App] Failed to sync theme to Supabase:', error);
                });
        }
    }, [theme, masterKey]);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [lastSeenFeedbackTime, setLastSeenFeedbackTime] = useState<number>(() => {
        const val = localStorage.getItem('docka_feedback_last_seen_time');
        return val ? Number(val) : 0;
    });

    const handleTabChange = (tab: 'inventory' | 'passcodes' | 'requests' | 'announcements' | 'dev-portal' | 'analytics' | 'feedback' | 'leaderboard' | 'templates' | 'transfer-calculator' | 'demand' | 'direct-sync' | 'region-management') => {
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
    const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(() => {
        const stored = localStorage.getItem('docka_dismissed_announcements');
        try {
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const handleDismissAnnouncement = useCallback((id: string) => {
        setDismissedAnnouncements(prev => {
            const next = prev.includes(id) ? prev : [...prev, id];
            localStorage.setItem('docka_dismissed_announcements', JSON.stringify(next));
            return next;
        });
    }, []);

    const activeAnnouncements = useMemo(() => {
        const severityWeight = {
            critical: 3,
            high: 2,
            normal: 1
        };
        const now = Date.now();

        return notifications
            .filter(n => {
                if (n.type !== 'announcement') return false;
                const isPinned = n.pinnedUntil ? new Date(n.pinnedUntil).getTime() > now : false;
                if (isPinned) return true;
                return !dismissedAnnouncements.includes(n.id);
            })
            .sort((a, b) => {
                const isPinnedA = a.pinnedUntil ? new Date(a.pinnedUntil).getTime() > now : false;
                const isPinnedB = b.pinnedUntil ? new Date(b.pinnedUntil).getTime() > now : false;
                if (isPinnedA !== isPinnedB) {
                    return isPinnedA ? -1 : 1;
                }
                const weightA = severityWeight[a.announcementSeverity || 'normal'] || 1;
                const weightB = severityWeight[b.announcementSeverity || 'normal'] || 1;
                if (weightA !== weightB) {
                    return weightB - weightA;
                }
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
    }, [notifications, dismissedAnnouncements]);

    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isCriticalStockOpen, setIsCriticalStockOpen] = useState(false);
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
    const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
    const [depotsHistory, setDepotsHistory] = useState<DepotHistoryEntry[]>([]);
    if (false as boolean) console.debug(depotsHistory);

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
                    console.error('[App] Failed to load feedbacks:', error);
                } else if (data) {
                    setFeedbacks(data);
                    localStorage.setItem('docka_feedbacks', JSON.stringify(data));
                }
            } catch (err) {
                console.error('[App] Error fetching feedbacks:', err);
            }
        };

        fetchFeedbacks();
    }, [isSupabaseConfigured, masterKey, userRole]);

    // Modal states
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);
    const [settingsDepotKey, setSettingsDepotKey] = useState<string | null>(null);

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
        const username = currentUsername || (userRole === 'developer' ? 'Developer' : userRole === 'logistics_lead' ? 'LogiLead' : userRole === 'officer' ? 'LogiOfficer' : 'LogiMember');
        const entry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            username,
            role: userRole || 'member',
            action
        };
        setAuditLogs(prev => {
            const exists = prev.some(l => l.id === entry.id);
            if (exists) return prev;
            const next = [entry, ...prev].slice(0, 300);
            localStorage.setItem('docka_audit_logs', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            dbService.saveAuditLog(entry).catch(err => {
                console.error('[App] Failed to save audit log to Supabase:', err);
            });
        }
    }, [userRole, currentUsername]);

    const incrementLocalUserStat = useCallback((statType: 'import' | 'request' | 'delivery', amount: number = 1) => {
        const username = currentUsername || 'LocalDev';
        setPortalUsers(prev => {
            const userExists = prev.some(u => u.username.toLowerCase() === username.toLowerCase());
            let next;
            if (userExists) {
                next = prev.map(u => {
                    if (u.username.toLowerCase() === username.toLowerCase()) {
                        return {
                            ...u,
                            import_count: statType === 'import' ? (u.import_count || 0) + amount : (u.import_count || 0),
                            request_count: statType === 'request' ? (u.request_count || 0) + amount : (u.request_count || 0),
                            delivery_count: statType === 'delivery' ? (u.delivery_count || 0) + amount : (u.delivery_count || 0)
                        };
                    }
                    return u;
                });
            } else {
                next = [...prev, {
                    id: username,
                    username: username,
                    role: userRole || 'developer',
                    status: 'approved' as const,
                    import_count: statType === 'import' ? amount : 0,
                    request_count: statType === 'request' ? amount : 0,
                    delivery_count: statType === 'delivery' ? amount : 0
                }];
            }
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });
    }, [currentUsername, userRole]);

    const fetchPortalUsers = useCallback(async () => {
        if (!isSupabaseConfigured || !supabase) {
            const storedUsers = localStorage.getItem('docka_portal_users');
            let list: PortalUser[] = [];
            if (storedUsers) {
                list = JSON.parse(storedUsers);
            }
            const username = currentUsername || 'LocalDev';
            if (username && !list.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                list.push({
                    id: username,
                    username: username,
                    role: userRole || 'developer',
                    status: 'approved',
                    import_count: 0,
                    request_count: 0,
                    delivery_count: 0
                });
                localStorage.setItem('docka_portal_users', JSON.stringify(list));
            }
            setPortalUsers(list);
            return;
        }

        try {
            let { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, username, role, status, import_count, request_count, delivery_count, clan, approved_at');
            if (error && String(error.message).includes('approved_at')) {
                ({ data: profiles, error } = await supabase
                    .from('profiles')
                    .select('id, username, role, status, import_count, request_count, delivery_count, clan'));
            }
            if (error) {
                console.error('[App] Failed to load portal users from Supabase:', error);
            } else if (profiles) {
                const mappedUsers: PortalUser[] = profiles.map((p: any) => {
                    return {
                        id: p.id,
                        username: p.username || 'Unknown',
                        role: (p.role as UserRole) || 'member',
                        status: (p.status || 'pending') as 'pending' | 'approved' | 'rejected',
                        import_count: p.import_count || 0,
                        request_count: p.request_count || 0,
                        delivery_count: p.delivery_count || 0,
                        clan: p.clan || undefined,
                        approvedAt: p.approved_at || undefined
                    };
                });
                const username = currentUsername || sessionStorage.getItem('docka_session_username');
                if (username && !mappedUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                    const storedLocalUsers = localStorage.getItem('docka_portal_users');
                    let localUser: PortalUser | null = null;
                    if (storedLocalUsers) {
                        try {
                            const parsed = JSON.parse(storedLocalUsers);
                            if (Array.isArray(parsed)) {
                                localUser = parsed.find((u: any) => u.username.toLowerCase() === username.toLowerCase()) || null;
                            }
                        } catch (e) {
                            console.error('[App] Failed to parse stored local users:', e);
                        }
                    }
                    mappedUsers.push(localUser || {
                        id: username,
                        username: username,
                        role: userRole || 'developer',
                        status: 'approved',
                        import_count: 0,
                        request_count: 0,
                        delivery_count: 0
                    });
                }
                setPortalUsers(mappedUsers);
                localStorage.setItem('docka_portal_users', JSON.stringify(mappedUsers));
            }
        } catch (err) {
            console.error('[App] Supabase fetch failed for portal users:', err);
        }
    }, [isSupabaseConfigured, currentUsername, userRole]);

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
            let initialNotifications: SystemNotification[] = [];
            const storedNotifs = localStorage.getItem('docka_notifications');
            if (storedNotifs) {
                try {
                    initialNotifications = JSON.parse(storedNotifs);
                } catch {
                    initialNotifications = [];
                }
            }

            let initialAuditLogs: AuditLogEntry[] = [];
            const storedAuditLogs = localStorage.getItem('docka_audit_logs');
            if (storedAuditLogs) {
                try {
                    initialAuditLogs = JSON.parse(storedAuditLogs);
                } catch {
                    initialAuditLogs = [];
                }
            }

            if (isSupabaseConfigured && supabase) {
                try {
                    // Fetch logged-in user profile details (language, theme, clan)
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('language, theme, clan')
                        .eq('id', key)
                        .single();

                    if (profileError) {
                        console.error('[App] Failed to load current user settings from Supabase:', profileError);
                    } else if (profile) {
                        const dbUpdates: Record<string, any> = {};

                        if (profile.language) {
                            if (profile.language !== language) {
                                setLanguage(profile.language as Language);
                            }
                        } else {
                            dbUpdates.language = language;
                        }

                        if (profile.theme) {
                            if (profile.theme !== theme) {
                                setTheme(profile.theme as 'dark' | 'light');
                            }
                        } else {
                            dbUpdates.theme = theme;
                        }

                        if (profile.clan) {
                            if (profile.clan !== userClan) {
                                setUserClan(profile.clan);
                            }
                        } else if (userClan) {
                            dbUpdates.clan = userClan;
                        }

                        if (Object.keys(dbUpdates).length > 0) {
                            await supabase
                                .from('profiles')
                                .update(dbUpdates)
                                .eq('id', key);
                        }
                    }
                } catch (profileErr) {
                    console.error('[App] Error during settings synchronization:', profileErr);
                }

                // Load announcements from database
                try {
                    const dbAnnouncements = await dbService.loadAnnouncements();
                    if (dbAnnouncements && dbAnnouncements.length > 0) {
                        const nonDbNotifications = initialNotifications.filter(n => n.type !== 'announcement');
                        initialNotifications = [...dbAnnouncements, ...nonDbNotifications];
                        localStorage.setItem('docka_notifications', JSON.stringify(initialNotifications));
                    }
                } catch (annError) {
                    console.error('[App] Error loading db announcements:', annError);
                }

                // Load audit logs from database
                try {
                    const dbAuditLogs = await dbService.loadAuditLogs();
                    if (dbAuditLogs && dbAuditLogs.length > 0) {
                        initialAuditLogs = dbAuditLogs;
                        localStorage.setItem('docka_audit_logs', JSON.stringify(initialAuditLogs));
                    }
                } catch (auditError) {
                    console.error('[App] Error loading db audit logs:', auditError);
                }

                await fetchPortalUsers();
                const history = await dbService.loadDepotsHistory();
                setDepotsHistory(history);
            } else {
                await fetchPortalUsers();
            }

            try {
                const loadedTemplates = await dbService.loadTemplates();
                setTemplates(loadedTemplates);
            } catch (err) {
                console.error('[App] Failed to load templates:', err);
            }

            try {
                const loadedRegionSettings = await dbService.loadRegionSettings();
                setRegionSettings(loadedRegionSettings);
            } catch (err) {
                console.error('[App] Failed to load region settings:', err);
            }

            setNotifications(initialNotifications);
            setAuditLogs(initialAuditLogs);

            isDataLoadedRef.current = true;
        } catch (e) {
            console.error('Failed to decrypt database', e);
            showToast('Failed to decrypt database. Incorrect key or data corruption.', 'error');
        } finally {
            setIsInitialLoading(false);
        }
    }, [showToast]);

    // Fetch minimum required version, templates, and region settings on mount
    useEffect(() => {
        const fetchInitialSettings = async () => {
            try {
                const ver = await dbService.loadMinAppVersion();
                if (ver) {
                    setMinAppVersion(ver);
                }
            } catch (err) {
                console.error('[App] Failed to load min app version:', err);
            }
            try {
                const loadedTemplates = await dbService.loadTemplates();
                setTemplates(loadedTemplates);
            } catch (err) {
                console.error('[App] Failed to load templates:', err);
            }
            try {
                const loadedRegionSettings = await dbService.loadRegionSettings();
                setRegionSettings(loadedRegionSettings);
            } catch (err) {
                console.error('[App] Failed to load region settings:', err);
            }
        };
        fetchInitialSettings();
    }, []);

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
            if (isSupabaseConfigured && supabase) {
                const history = await dbService.loadDepotsHistory();
                setDepotsHistory(history);
            }
        } catch (e) {
            console.error('Failed to save depots', e);
        }
    }, [isSupabaseConfigured]);

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



    // Ensure we have an active depot selected if list is not empty
    useEffect(() => {
        if (!activeDepotName || (
            activeDepotName !== 'all' && 
            !activeDepotName.startsWith('town:') && 
            !depots[activeDepotName]
        )) {
            const keys = Object.keys(depots);
            if (keys.length > 0) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setActiveDepotName('all');
            } else {
                setActiveDepotName(null);
            }
        }
    }, [depots, activeDepotName]);

    // Reset sub-depot filter when town/active depot selection changes
    useEffect(() => {
        setActiveSubDepotFilter('all');
    }, [activeDepotName]);

    const importParsedStockpiles = useCallback((stockpiles: ParsedStockpile[]) => {
        if (!stockpiles || stockpiles.length === 0) return;
        
        let syncedCount = 0;
        
        setDepots(prev => {
            const nextDepots = { ...prev };
            
            stockpiles.forEach(stockpile => {
                const { location, timestamp, items: rawItems, townName } = stockpile;

                const items: Record<string, ItemInfo> = {};
                Object.entries(rawItems).forEach(([itemName, count]) => {
                    const officialCat = getItemOfficialCategory(itemName);
                    const category: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle' = 
                        officialCat === 'vehicles' ? (itemName.endsWith('(Crate)') ? 'crate_vehicle' : 'vehicle') :
                        officialCat === 'shippables' ? 'structure' :
                        itemName.endsWith('(Crate)') ? 'crate' : 'item';
                    items[itemName] = { count, category };
                });
                
                const parsedMatchKey = getDepotMatchKey(location);
                const matchedKey = Object.keys(nextDepots).find(k => getDepotMatchKey(k) === parsedMatchKey);
                const targetKey = matchedKey || location;
                const prevDepot = nextDepots[targetKey];
                
                if (prevDepot) {
                    const prevTime = new Date(prevDepot.lastUpdated).getTime();
                    const currTime = new Date(timestamp).getTime();
                    const isWithinCooldown = !isNaN(prevTime) && !isNaN(currTime) && Math.abs(currTime - prevTime) < 15 * 60 * 1000;
                    
                    if (prevDepot.lastUpdated === timestamp || isWithinCooldown) {
                        nextDepots[targetKey] = {
                            ...prevDepot,
                            name: prevDepot.name || location,
                            lastUpdated: timestamp,
                            lastUpdatedBy: currentUsername || 'Developer',
                            previous: prevDepot.previous || null,
                            current: items,
                            townName: townName || prevDepot.townName || null
                        };
                    } else {
                        nextDepots[targetKey] = {
                            ...prevDepot,
                            name: prevDepot.name || location,
                            lastUpdated: timestamp,
                            lastUpdatedBy: currentUsername || 'Developer',
                            previous: prevDepot.current,
                            current: items,
                            townName: townName || prevDepot.townName || null
                        };
                    }
                    
                    if (matchedKey && matchedKey !== location) {
                        nextDepots[location] = nextDepots[matchedKey];
                        delete nextDepots[matchedKey];
                        if (isSupabaseConfigured) {
                            dbService.deleteDepot(matchedKey);
                        }
                    }
                } else {
                    nextDepots[location] = {
                        name: location,
                        customName: null,
                        lastUpdated: timestamp,
                        lastUpdatedBy: currentUsername || 'Developer',
                        previous: null,
                        current: items,
                        townName: townName || null,
                        isIntegrated: false
                    };
                }
                
                checkCriticalStock(location, items);
                syncedCount++;
            });
            
            return nextDepots;
        });
        
        logAction(`Direct SAV Sync: Synced ${syncedCount} stockpiles successfully.`);

        incrementLocalUserStat('import');
        if (isSupabaseConfigured && supabase) {
            dbService.incrementProfileStat('import').then(() => { fetchPortalUsers(); });
        }
    }, [isSupabaseConfigured, checkCriticalStock, logAction, incrementLocalUserStat, fetchPortalUsers]);



    const handleLoginSuccess = useCallback((role: UserRole, key: string, rememberMe?: boolean) => {
        if (rememberMe) {
            localStorage.setItem('docka_remember_me', 'true');
            localStorage.setItem('docka_session_master_key', key);
            localStorage.setItem('docka_session_role', role);
        } else {
            localStorage.removeItem('docka_remember_me');
            localStorage.removeItem('docka_session_master_key');
            localStorage.removeItem('docka_session_role');
            localStorage.removeItem('docka_session_username');
        }

        sessionStorage.setItem('docka_session_master_key', key);
        sessionStorage.setItem('docka_session_role', role);
        setIsInitialLoading(true);
        setMasterKey(key);
        setUserRole(role);
        const username = sessionStorage.getItem('docka_session_username') || localStorage.getItem('docka_session_username');
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
        else if (role === 'logistics_lead') roleLabel = t('logistics_lead_access');
        else if (role === 'officer') roleLabel = t('officer_access');
        else if (role === 'recruit') roleLabel = t('recruit_access');
        
        showToast(t('authorized_access', { role: roleLabel }), 'success');
    }, [showToast, t]);

    const handleDisconnect = useCallback(() => {
        sessionStorage.removeItem('docka_session_master_key');
        sessionStorage.removeItem('docka_session_role');
        sessionStorage.removeItem('docka_session_username');
        localStorage.removeItem('docka_remember_me');
        localStorage.removeItem('docka_session_master_key');
        localStorage.removeItem('docka_session_role');
        localStorage.removeItem('docka_session_username');

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

    const handleRefreshRequests = useCallback(async () => {
        if (!masterKey) return;
        try {
            setIsRefreshingRequests(true);
            const fresh = await dbService.loadRequests(masterKey);
            isRemoteRequestsUpdateRef.current = true;
            setSupplyRequests(fresh);
            showToast(language === 'tr' ? 'Sipariş listesi veritabanından güncellendi.' : 'Supply requests refreshed from database.', 'info');
        } catch (e) {
            console.error('Failed to refresh supply requests:', e);
        } finally {
            setTimeout(() => setIsRefreshingRequests(false), 500);
        }
    }, [masterKey, language, showToast]);

    // Real-time Supabase Subscriptions
    useRealtimeSubscriptions({
        masterKey,
        language,
        showToast,
        handleDisconnect,
        setUserRole,
        setPortalUsers,
        setSupplyRequests,
        setDepots,
        setNotifications,
        setAuditLogs,
        setFeedbacks,
        setTemplates,
        setRegionSettings,
        isRemoteRequestsUpdateRef,
        isRemoteDepotsUpdateRef
    });



    const handleClearAllData = useCallback(() => {
        if (userRole === 'member' || userRole === 'recruit') {
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
        if (userRole === 'member' || userRole === 'recruit') {
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

    const handleDeleteDepotKey = useCallback((depotKey: string) => {
        if (userRole === 'member' || userRole === 'recruit') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        if (!depotKey || !depots[depotKey]) return;
        const displayName = depots[depotKey]?.customName || depots[depotKey]?.name || depotKey;
        setConfirmModal({
            isOpen: true,
            title: t('delete_depot_confirm_title'),
            message: t('delete_depot_confirm_msg', { displayName }),
            onConfirm: () => {
                setDepots(prev => {
                    const nextDepots = { ...prev };
                    delete nextDepots[depotKey];
                    if (masterKey) {
                        dbService.saveDepots(nextDepots, masterKey);
                    }
                    return nextDepots;
                });
                dbService.deleteDepot(depotKey);
                setConfirmModal(null);
                showToast(t('delete_depot_success', { displayName }), 'info');
                logAction(`Deleted depot node: ${depotKey}`);
                if (activeDepotName === depotKey) {
                    setActiveDepotName('all');
                }
                if (activeSubDepotFilter === depotKey) {
                    setActiveSubDepotFilter('all');
                }
            }
        });
    }, [userRole, activeDepotName, activeSubDepotFilter, depots, showToast, t, logAction]);

    const handleSaveDepotSettings = useCallback((depotKey: string, accessCode: string, isCodePublic: boolean, depotType: 'frontline' | 'backline') => {
        if (userRole === 'member' || userRole === 'recruit') {
            showToast(t('role_officer_required_settings'), 'error');
            return;
        }
        if (!depotKey || !depots[depotKey]) return;
        setDepots(prev => {
            const nextDepots = { ...prev };
            if (nextDepots[depotKey]) {
                nextDepots[depotKey] = {
                    ...nextDepots[depotKey],
                    customName: null,
                    accessCode: accessCode || undefined,
                    isCodePublic: isCodePublic,
                    depotType: depotType
                };
            }
            return nextDepots;
        });
        setSettingsDepotKey(null);
        showToast(t('settings_updated'), 'success');
        logAction(`Updated settings for depot ${depotKey}. Role: ${depotType}, Code public: ${isCodePublic}`);
    }, [userRole, depots, showToast, t, logAction]);

    const handleSaveRegionSettings = useCallback(async (newSettings: RegionSettings) => {
        if (userRole !== 'developer' && userRole !== 'logistics_lead') {
            showToast('Sadece Geliştirici (Developer) veya Lojistik Sorumlusu (Logistics Lead) şablon ayarlarını değiştirebilir.', 'error');
            return;
        }
        try {
            await dbService.saveRegionSettings(newSettings);
            setRegionSettings(newSettings);
            showToast(t('settings_updated') || 'Bölge şablon ayarları başarıyla kaydedildi.', 'success');
            logAction(`Updated region settings: ${Object.keys(newSettings).length} regions configured.`);
        } catch (err) {
            console.error('[App] Failed to save region settings:', err);
            showToast('Bölge ayarları kaydedilirken hata oluştu.', 'error');
        }
    }, [userRole, showToast, t, logAction]);

    const handleCreateSupplyRequest = useCallback((
        depotName: string,
        items: RequestItem[]
    ) => {
        if (userRole === 'member' || userRole === 'recruit') {
            showToast(t('role_officer_required_create_req'), 'error');
            return;
        }
        const matchingStockpiles = Object.values(depots)
            .filter(d => {
                if (d.name === depotName) return true;
                const regionPrefix = depotName.split(' - ')[0];
                return d.name.startsWith(regionPrefix) || d.townName === depotName || d.subregion === depotName;
            })
            .map(d => d.customName || d.accessCode || d.name)
            .filter(Boolean);

        const stockpileNamesList = matchingStockpiles.length > 0 ? Array.from(new Set(matchingStockpiles)).join(', ') : 'Public';

        const newRequest: SupplyRequest = {
            id: crypto.randomUUID(),
            depotName,
            items,
            createdTime: new Date().toISOString(),
            status: 'open',
            claimedBy: [],
            createdBy: currentUsername || 'Veli User',
            stockpileNames: stockpileNamesList
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

        if (isSupabaseConfigured && supabase) {
            dbService.incrementProfileStat('request').then(() => {
                fetchPortalUsers();
            });
        }
        incrementLocalUserStat('request');
    }, [userRole, showToast, t, depots, logAction, isSupabaseConfigured, fetchPortalUsers, incrementLocalUserStat]);

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

            if (amount > 0) {
                if (isSupabaseConfigured && supabase) {
                    dbService.incrementProfileStat('delivery', amount).then(() => {
                        fetchPortalUsers();
                    });
                }
                incrementLocalUserStat('delivery', amount);
            }
        }
    }, [supplyRequests, depots, showToast, t, logAction, isSupabaseConfigured, fetchPortalUsers, incrementLocalUserStat]);

    const handleToggleCompleteItem = useCallback((requestId: string, itemIndex: number) => {
        const req = supplyRequests.find(r => r.id === requestId);
        if (!req) return;

        const item = req.items?.[itemIndex];
        if (!item) return;

        const isItemDone = item.quantityDelivered >= item.quantityRequired;
        if (isItemDone && (userRole === 'member' || userRole === 'recruit')) {
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

        if (!isItemDone) {
            const deliveryAmount = Math.max(0, item.quantityRequired - item.quantityDelivered);
            if (deliveryAmount > 0) {
                if (isSupabaseConfigured && supabase) {
                    dbService.incrementProfileStat('delivery', deliveryAmount).then(() => {
                        fetchPortalUsers();
                    });
                }
                incrementLocalUserStat('delivery', deliveryAmount);
            }
        }
    }, [supplyRequests, userRole, showToast, t, logAction, isSupabaseConfigured, fetchPortalUsers, incrementLocalUserStat]);

    const handleToggleComplete = useCallback((requestId: string) => {
        const req = supplyRequests.find(r => r.id === requestId);
        if (!req) return;

        const isNowCompleted = req.status !== 'completed';
        if (!isNowCompleted && (userRole === 'member' || userRole === 'recruit')) {
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

        if (isNowCompleted) {
            const itemsList = req.items || [];
            const totalDeliveryAmount = itemsList.reduce((acc, item) => {
                return acc + Math.max(0, item.quantityRequired - item.quantityDelivered);
            }, 0);
            if (totalDeliveryAmount > 0) {
                if (isSupabaseConfigured && supabase) {
                    dbService.incrementProfileStat('delivery', totalDeliveryAmount).then(() => {
                        fetchPortalUsers();
                    });
                }
                incrementLocalUserStat('delivery', totalDeliveryAmount);
            }
        }
    }, [supplyRequests, userRole, showToast, t, logAction, isSupabaseConfigured, fetchPortalUsers, incrementLocalUserStat]);

    const handleDeleteRequest = useCallback((requestId: string) => {
        if (userRole === 'member' || userRole === 'recruit') {
            showToast(t('role_officer_required_delete'), 'error');
            return;
        }
        const targetReq = supplyRequests.find(r => r.id === requestId);
        setConfirmModal({
            isOpen: true,
            title: t('delete_request_confirm_title'),
            message: t('delete_request_confirm_msg'),
            onConfirm: () => {
                setSupplyRequests(prev => prev.filter(req => req.id !== requestId));
                dbService.deleteRequest(requestId, targetReq?.discordChannelId);
                setConfirmModal(null);
                showToast(t('request_removed'), 'info');
                logAction(`Deleted supply request #${requestId.substring(0, 5).toUpperCase()}.`);
            }
        });
    }, [userRole, showToast, t, logAction, supplyRequests]);

    const handleResetLeaderboard = useCallback(async () => {
        if (userRole !== 'developer') {
            showToast('Only developers can reset leaderboard', 'error');
            return;
        }
        try {
            await dbService.resetLeaderboardStats();
            showToast('Leaderboard reset successfully', 'success');
            logAction('Reset all leaderboard statistics for a new war.');
            await fetchPortalUsers();
        } catch (err: any) {
            const errMsg = err?.message || err?.details || 'Failed to reset leaderboard';
            showToast(errMsg, 'error');
        }
    }, [userRole, fetchPortalUsers, showToast, logAction]);

    const handleUpdateMinAppVersion = useCallback(async (version: string) => {
        if (userRole !== 'developer') {
            showToast('Only developers can update app version', 'error');
            return;
        }
        try {
            await dbService.saveMinAppVersion(version);
            setMinAppVersion(version);
            showToast(language === 'tr' ? `Minimum gerekli sürüm ${version} olarak güncellendi.` : `Minimum required version updated to ${version}.`, 'success');
            logAction(`Updated minimum required app version to ${version}.`);
        } catch (err: any) {
            const errMsg = err?.message || 'Failed to update minimum app version';
            showToast(errMsg, 'error');
        }
    }, [userRole, showToast, logAction, language]);



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

    const handlePublishAnnouncement = useCallback((title: string, content: string, severity: 'normal' | 'high' | 'critical', pinnedUntil?: string) => {
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
            announcementRole: (userRole === 'developer' ? 'developer' : 'officer') as UserRole,
            pinnedUntil: pinnedUntil || null
        };
        setNotifications(prev => {
            const exists = prev.some(n => n.id === newNotif.id);
            if (exists) return prev;
            const next = [newNotif, ...prev];
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            dbService.saveAnnouncement(newNotif).catch(err => {
                console.error('[App] Failed to save announcement to Supabase:', err);
            });
        }

        logAction(`Published global announcement [${severity}]${pinnedUntil ? ' (Pinned)' : ''}: ${title} - ${content}`);
        showToast('Announcement published successfully', 'success');
        setActiveTab('announcements');
    }, [userRole, showToast, logAction, currentUsername]);

    const handlePinAnnouncement = useCallback((id: string, pinnedUntil: string | null) => {
        setNotifications(prev => {
            const next = prev.map(n => n.id === id ? { ...n, pinnedUntil } : n);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            dbService.updateAnnouncementPin(id, pinnedUntil).catch(err => {
                console.error('[App] Failed to update announcement pin in Supabase:', err);
            });
            try {
                supabase.channel('public-announcements').send({
                    type: 'broadcast',
                    event: 'announcement_pinned',
                    payload: { id, pinnedUntil }
                });
            } catch (broadcastErr) {
                console.error('[App] Failed to broadcast announcement pin:', broadcastErr);
            }
        }

        logAction(`Updated announcement pin #${id.substring(0, 5)}`);
        showToast(language === 'tr' ? 'Duyuru pini güncellendi' : 'Announcement pin updated', 'success');
    }, [showToast, logAction, language]);

    const handleDeleteAnnouncement = useCallback((id: string) => {
        if (userRole === 'member' || userRole === 'recruit') {
            showToast('You do not have permission to delete announcements', 'error');
            return;
        }
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id);
            localStorage.setItem('docka_notifications', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            dbService.deleteAnnouncement(id).catch(err => {
                console.error('[App] Failed to delete announcement from Supabase:', err);
            });
        }

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
    const handleApproveUser = useCallback(async (id: string, approvedRole?: UserRole) => {
        const targetUser = portalUsers.find(u => u.id === id);
        if (!targetUser) return;

        const username = targetUser.username;
        const targetRole = approvedRole || targetUser.role;

        setPortalUsers(prev => {
            const next = prev.map(u => u.id === id ? { ...u, role: targetRole, status: 'approved' as const } : u);
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ 
                        status: 'approved',
                        role: targetRole,
                        approved_at: new Date().toISOString()
                    })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to approve user in Supabase:', err);
                showToast('Failed to sync approval to database.', 'error');
                fetchPortalUsers();
            }
        }

        logAction(`Approved registration request for user ${username}.`);
        showToast(`Approved registration for ${username}`, 'success');
    }, [portalUsers, isSupabaseConfigured, showToast, logAction, fetchPortalUsers]);

    const handleRejectUser = useCallback(async (id: string) => {
        const targetUser = portalUsers.find(u => u.id === id);
        if (!targetUser) return;

        const username = targetUser.username;

        setPortalUsers(prev => {
            const next = prev.map(u => u.id === id ? { ...u, status: 'rejected' as const } : u);
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
                fetchPortalUsers();
            }
        }

        logAction(`Rejected registration request for user ${username}.`);
        showToast(`Rejected registration for ${username}`, 'warning');
    }, [portalUsers, isSupabaseConfigured, showToast, logAction, fetchPortalUsers]);

    const handleUpdateUserRole = useCallback(async (id: string, nextRole: UserRole) => {
        const targetUser = portalUsers.find(u => u.id === id);
        if (!targetUser) return;

        if (nextRole === 'developer') {
            showToast('Developer role cannot be assigned.', 'error');
            return;
        }

        const username = targetUser.username;

        setPortalUsers(prev => {
            const next = prev.map(u => u.id === id ? { ...u, role: nextRole } : u);
            localStorage.setItem('docka_portal_users', JSON.stringify(next));
            return next;
        });

        const isCurrentUser = id === masterKey || (username && currentUsername && username.toLowerCase() === currentUsername.toLowerCase());
        if (isCurrentUser) {
            setUserRole(nextRole);
            sessionStorage.setItem('docka_session_role', nextRole);
            if (localStorage.getItem('docka_remember_me') === 'true') {
                localStorage.setItem('docka_session_role', nextRole);
            }
        }

        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: nextRole })
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error('[App] Failed to update user role in Supabase:', err);
                showToast('Failed to update user role in database.', 'error');
                fetchPortalUsers();
                return;
            }
        }

        logAction(`Updated user ${username} role to ${nextRole}.`);
        showToast(`Updated ${username} role.`, 'success');
    }, [portalUsers, isSupabaseConfigured, showToast, logAction, fetchPortalUsers, masterKey, currentUsername]);

    const getDepotRegion = (dep: Depot): string => {
        const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
        const rawRegion = parts[0] || 'Unknown Region';
        if (rawRegion === 'The Blemish' || rawRegion === 'The Blemsh') return 'Blemish';
        return rawRegion;
    };

    const isDepotType = (str: string): boolean => {
        const lower = str.toLowerCase();
        return (
            lower.includes('seaport') || lower.includes('storage depot') || lower.includes('depot') ||
            lower.includes('seehafen') || lower.includes('lagerdepot') || lower.includes('porto') ||
            lower.includes('depósito') || lower.includes('порт') || lower.includes('склад') ||
            lower.includes('dépôt')
        );
    };

    const getDepotTown = (dep: Depot) => {
        let town = dep.townName;
        if (town && !isDepotType(town)) {
            const trimmed = town.trim();
            if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") return "Light's End";
            if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
            if (trimmed === 'Rising Loom') return 'Therizo';
            return town;
        }
        const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 3 && !isDepotType(parts[1])) {
            const trimmed = parts[1];
            if (trimmed === 'Glimmerhaven' || trimmed === 'Lights End' || trimmed === "Light’s End" || trimmed === "Light's End") return "Light's End";
            if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
            if (trimmed === 'Rising Loom') return 'Therizo';
            return parts[1];
        }
        return null;
    };

    const getDepotGroup = (dep: Depot): string => {
        const region = getDepotRegion(dep);
        const town = getDepotTown(dep);
        return town ? `${region} - ${town}` : region;
    };

    const getSubDepotLabel = (dep: Depot) => {
        if (dep.customName) return dep.customName;
        let label = dep.name;
        const region = getDepotRegion(dep);
        const town = getDepotTown(dep);
        if (region && label.toLowerCase().startsWith(region.toLowerCase())) {
            label = label.substring(region.length);
            label = label.replace(/^[\s-–—:]+/, '');
        }
        if (town && label.toLowerCase().startsWith(town.toLowerCase())) {
            label = label.substring(town.length);
            label = label.replace(/^[\s-–—:]+/, '');
        }
        return label || dep.name;
    };

    const integratedDepots = useMemo(() => {
        const filtered: Record<string, Depot> = {};
        Object.entries(depots).forEach(([key, dep]) => {
            if (dep.isIntegrated) {
                filtered[key] = dep;
            }
        });
        return filtered;
    }, [depots]);

    const handleIntegrateDepot = useCallback((depotKey: string, subregion: string, accessCode: string) => {
        setDepots(prev => {
            if (!prev[depotKey]) return prev;
            const target = prev[depotKey];
            const parts = target.name.split(' - ').map(s => s.trim()).filter(Boolean);
            const region = parts[0] || 'Unknown Region';
            
            let structureType = 'Storage Depot';
            for (let i = 1; i < parts.length; i++) {
                const p = parts[i];
                const l = p.toLowerCase();
                if (l.includes('seaport') || l.includes('depot') || (l.includes('port') && !l.includes('sableport'))) {
                    structureType = p;
                    break;
                }
            }

            let tag = '';
            const lastPart = parts[parts.length - 1];
            const subLower = subregion.toLowerCase();
            if (lastPart && 
                lastPart.toLowerCase() !== structureType.toLowerCase() && 
                lastPart.toLowerCase() !== region.toLowerCase() && 
                lastPart.toLowerCase() !== subLower) {
                tag = lastPart;
            }

            // Keep base depot name clean: "Region - StructureType - Tag" (without injecting subregion into name)
            const cleanBaseName = tag
                ? `${region} - ${structureType} - ${tag}`
                : `${region} - ${structureType}`;

            const updated: Depot = {
                ...target,
                name: cleanBaseName,
                subregion: subregion,
                townName: subregion,
                accessCode: accessCode,
                isIntegrated: true
            };

            const nextDepots = { ...prev, [depotKey]: updated };
            if (isSupabaseConfigured) {
                dbService.saveDepots(nextDepots, sessionStorage.getItem('docka_session_master_key') || '');
            }
            return nextDepots;
        });
        showToast(language === 'tr' ? `${depotKey} deposu entegre edildi!` : `Depot ${depotKey} integrated!`, 'success');
        logAction(`Approved & integrated depot: ${depotKey} into subregion ${subregion}`);
    }, [showToast, language, logAction, isSupabaseConfigured]);

    const activeDepot = useMemo<Depot | null>(() => {
        if (!activeDepotName) return null;
        if (activeDepotName === 'all') {
            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';
            Object.values(integratedDepots).forEach(dep => {
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

        if (activeDepotName.startsWith('town:')) {
            const town = activeDepotName.substring(5);
            const townDepots = Object.values(integratedDepots).filter(dep => getDepotGroup(dep) === town);

            if (activeSubDepotFilter !== 'all') {
                const target = integratedDepots[activeSubDepotFilter];
                if (target) return target;
            }

            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';
            townDepots.forEach(dep => {
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
                name: `town:${town}`,
                customName: town,
                subregion: town,
                current: mergedCurrent,
                previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null,
                lastUpdated: latestUpdated || new Date().toISOString()
            } as Depot;
        }

        return integratedDepots[activeDepotName] || null;
    }, [activeDepotName, activeSubDepotFilter, integratedDepots, t]);

    const depotOptions = useMemo(() => {
        const options = [
            { value: 'all', label: t('all_depots') || 'Tüm Depolar', isStale: false }
        ];

        const groups = new Set<string>();
        Object.values(integratedDepots).forEach(dep => {
            const group = getDepotGroup(dep);
            if (group) groups.add(group);
        });

        Array.from(groups).sort().forEach(group => {
            const groupDepots = Object.values(integratedDepots).filter(d => getDepotGroup(d) === group);
            const hasStaleDepot = groupDepots.some(d => {
                return d.lastUpdated 
                    ? (Date.now() - new Date(d.lastUpdated).getTime()) / (1000 * 60 * 60) >= 12 
                    : false;
            });

            options.push({
                value: `town:${group}`,
                label: group,
                isStale: hasStaleDepot
            });
        });

        return options;
    }, [integratedDepots, t]);

    const currentTownDepotsList = useMemo(() => {
        if (!activeDepotName || !activeDepotName.startsWith('town:')) return [];
        const townName = activeDepotName.substring(5);
        return Object.entries(integratedDepots)
            .filter(([, dep]) => getDepotGroup(dep) === townName)
            .map(([key, dep]) => ({
                key,
                label: getSubDepotLabel(dep)
            }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
    }, [activeDepotName, integratedDepots]);

    const unreadCount = notifications.filter(n => n.type !== 'critical_stock' && !n.isRead).length;
    const unreadFeedbackCount = userRole === 'developer'
        ? feedbacks.filter(f => new Date(f.created_at).getTime() > lastSeenFeedbackTime).length
        : 0;



    const isOutdated = !import.meta.env.DEV && isOutdatedVersion(APP_VERSION, minAppVersion);

    if (isOutdated) {
        const forceUpdateTranslations: Record<string, Record<string, string>> = {
            tr: {
                title: 'YENİ SÜRÜM MEVCUT',
                desc: `VELI Logistics Tracker uygulamasının eski bir sürümünü (v${APP_VERSION}) kullanıyorsunuz. Devam edebilmek için lütfen en az v${minAppVersion} sürümüne güncelleyin.`,
                button: 'Yeni Sürümü İndir (GitHub)'
            },
            en: {
                title: 'NEW VERSION AVAILABLE',
                desc: `You are using an outdated version of VELI Logistics Tracker (v${APP_VERSION}). Please update to at least v${minAppVersion} to continue.`,
                button: 'Download New Version (GitHub)'
            }
        };
        const langKey = language === 'tr' ? 'tr' : 'en';
        const tVer = forceUpdateTranslations[langKey];

        return (
            <div className="react-root-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '480px',
                    margin: '1.5rem',
                    padding: '2.5rem',
                    borderRadius: '12px',
                    background: 'rgba(20, 21, 26, 0.65)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.1)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    textAlign: 'center',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.5rem', color: '#ef4444' }}>
                        <AlertTriangle size={28} />
                    </div>
                    
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0', letterSpacing: '0.05em', color: '#fff', textTransform: 'uppercase' }}>
                        {tVer.title}
                    </h2>
                    
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 2rem 0' }}>
                        {tVer.desc}
                    </p>

                    <button 
                        type="button"
                        onClick={() => openExternalUrl(minAppVersion ? `https://github.com/dockadev/veli-logistics-tracker/releases/tag/v${minAppVersion}` : 'https://github.com/dockadev/veli-logistics-tracker/releases')}
                        className="btn btn-primary"
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '0.5rem', 
                            width: '100%', 
                            padding: '0.75rem', 
                            borderRadius: '6px', 
                            fontWeight: 700, 
                            fontSize: '0.85rem',
                            textDecoration: 'none',
                            background: 'var(--accent-color)',
                            color: '#000',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
                            cursor: 'pointer'
                        }}
                    >
                        <Download size={16} />
                        {tVer.button}
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
                    version={APP_VERSION}
                />
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="react-root-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
                <div className="anim-pulse-glow" style={{ textAlign: 'center' }}>
                    <Database size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 1.25rem auto', display: 'block' }} />
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                        {language === 'tr' ? 'Veritabanı Şifresi Çözülüyor...' : 'Decrypting Logistics Database...'}
                    </div>
                </div>
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
                        <button
                            onClick={handleDisconnect}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem', 
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '4px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                            }}
                            title={language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
                        >
                            <LogOut size={13} />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                                {language === 'tr' ? 'Çıkış Yap' : 'Log Out'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="app-container">
                {isInitialLoading && !activeDepot && Object.keys(depots).length === 0 ? (
                    <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                        <Database size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
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
                        {/* Top Announcement Banner (Visible at the very top of main view) */}
                        {activeAnnouncements.slice(0, 1).map(ann => {
                            const isPinned = ann.pinnedUntil ? new Date(ann.pinnedUntil).getTime() > Date.now() : false;

                            return (
                                <div 
                                    key={ann.id}
                                    className="anim-fade-in"
                                    style={{
                                        marginBottom: '1.25rem',
                                        padding: '0.85rem 1.25rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: isPinned ? 'rgba(245, 158, 11, 0.12)' :
                                                    ann.announcementSeverity === 'critical' ? 'rgba(239, 68, 68, 0.12)' :
                                                    ann.announcementSeverity === 'high' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                        border: '1px solid ' + (isPinned ? 'rgba(245, 158, 11, 0.4)' :
                                                                ann.announcementSeverity === 'critical' ? 'rgba(239, 68, 68, 0.35)' :
                                                                ann.announcementSeverity === 'high' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)'),
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: '1rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                        <Megaphone size={20} style={{ 
                                            color: isPinned ? '#f59e0b' :
                                                   ann.announcementSeverity === 'critical' ? '#ef4444' :
                                                   ann.announcementSeverity === 'high' ? '#f59e0b' : 'var(--accent-color)',
                                            marginTop: '2px',
                                            flexShrink: 0 
                                        }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{ 
                                                    fontSize: '0.85rem', 
                                                    fontWeight: 800, 
                                                    fontFamily: 'var(--font-heading)',
                                                    color: isPinned ? '#f59e0b' :
                                                           ann.announcementSeverity === 'critical' ? '#ef4444' :
                                                           ann.announcementSeverity === 'high' ? '#f59e0b' : 'var(--text-primary)'
                                                }}>
                                                    {ann.announcementTitle || 'DUYURU / ANNOUNCEMENT'}
                                                </span>
                                                {isPinned && (
                                                    <span 
                                                        style={{
                                                            background: 'rgba(245, 158, 11, 0.2)',
                                                            color: '#f59e0b',
                                                            border: '1px solid rgba(245, 158, 11, 0.4)',
                                                            fontSize: '0.6rem',
                                                            fontWeight: 800,
                                                            padding: '0.15rem 0.45rem',
                                                            borderRadius: '4px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.05em',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem'
                                                        }}
                                                        title={t('pinned_cannot_dismiss')}
                                                    >
                                                        <Pin size={11} />
                                                        <span>{t('pinned_badge')}</span>
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                    • {getRelativeTimeString(ann.timestamp, language)} ({ann.announcementAuthor || 'Admin'})
                                                </span>
                                            </div>
                                            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                                                {ann.announcementContent || ann.message}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                                        <button 
                                            className="btn btn-secondary"
                                            onClick={() => setActiveTab('announcements')}
                                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
                                        >
                                            {language === 'tr' ? 'Tümünü Gör' : 'View All'}
                                        </button>
                                        {!isPinned && (
                                            <button
                                                type="button"
                                                onClick={() => handleDismissAnnouncement(ann.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-secondary)',
                                                    padding: '0.25rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '4px',
                                                    transition: 'all 0.15s',
                                                    opacity: 0.7
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
                                                title={language === 'tr' ? 'Kapat' : 'Dismiss'}
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <section className="data-panel" style={{ position: 'relative' }}>
                            {!activeDepot && activeTab === 'inventory' ? (
                        <div className="table-container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                            <div className="empty-row" style={{ border: 'none' }}>
                                <Database size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4, display: 'block' }} />
                                <p>{t('no_active_depot')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeDepot && (activeTab === 'inventory' || activeTab === 'analytics') && (
                                <div className="depot-interface-header">
                                    <div className="depot-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: activeTab === 'analytics' ? '100%' : 'auto' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: activeTab === 'analytics' ? 'space-between' : 'flex-start', width: '100%', flexWrap: 'wrap' }}>
                                            <CustomSelect
                                                options={depotOptions}
                                                value={activeDepotName || 'all'}
                                                onChange={(val) => setActiveDepotName(val)}
                                                className="header-depot-select"
                                            />
                                            {activeDepotName && activeDepotName !== 'all' && (
                                                 (() => {
                                                     const targetDepot = depots[activeDepotName];
                                                     let regName = resolveRegionForDepotName(activeDepotName, depots);
                                                     let townName = targetDepot?.townName || targetDepot?.subregion || null;
                                                     let subName = targetDepot?.subregion || targetDepot?.townName || null;

                                                     if (!townName && activeDepotName.startsWith('town:')) {
                                                         const subKey = activeDepotName.substring(5);
                                                         const parts = subKey.split(' - ');
                                                         regName = parts[0];
                                                         townName = parts[1] || null;
                                                         subName = parts[1] || null;
                                                     }

                                                     if (!regName) return null;

                                                     const setting = resolveTemplateSetting(regName, townName, subName, regionSettings);
                                                     const type = setting?.templateType;

                                                     const getTemplateColor = (tType?: string) => {
                                                         if (!tType || tType === 'unassigned') return '#ef4444';
                                                         try {
                                                             const saved = localStorage.getItem('foxhole_template_colors');
                                                             if (saved) {
                                                                 const map = JSON.parse(saved);
                                                                 if (map[tType]) return map[tType];
                                                             }
                                                         } catch (e) {}
                                                         if (tType === 'frontline') return '#ef4444';
                                                         if (tType === 'backline') return '#ffffff';
                                                         if (tType === 'airfield') return '#06b6d4';
                                                         return '#10b981';
                                                     };

                                                     const color = getTemplateColor(type);
                                                     const isUnassigned = !type || type === 'unassigned';
                                                     const label = isUnassigned
                                                         ? (language === 'tr' ? 'ŞABLON ATANMADI' : 'TEMPLATE UNASSIGNED')
                                                         : type === 'airfield' ? 'AIRFIELD' : type.toUpperCase();

                                                     return (
                                                         <span className="depot-template-badge" style={{
                                                             background: `${color}20`,
                                                             color: color,
                                                             border: `1px solid ${color}60`
                                                         }}>
                                                             {label}
                                                         </span>
                                                     );
                                                 })()
                                            )}
                                            
                                        </div>

                                        {/* Toggle Chips for Sub-depots of the Town */}
                                        {(activeTab === 'inventory' || activeTab === 'analytics') && currentTownDepotsList.length > 0 && (
                                            <div className="depot-filter-chips">
                                                <span className="depot-filter-label">
                                                    {language === 'tr' ? 'Depo Seçimi:' : 'Stockpile Filter:'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSubDepotFilter('all')}
                                                    className={`depot-chip ${activeSubDepotFilter === 'all' ? 'selected' : ''}`}
                                                >
                                                    {language === 'tr' ? 'Tümü' : 'All'}
                                                </button>
                                                {currentTownDepotsList.map(item => {
                                                    const isSelected = activeSubDepotFilter === item.key;
                                                    const depObj = depots[item.key];
                                                    const isStale = depObj?.lastUpdated 
                                                        ? (Date.now() - new Date(depObj.lastUpdated).getTime()) / (1000 * 60 * 60) >= 12 
                                                        : false;
                                                    return (
                                                        <button
                                                            key={item.key}
                                                            type="button"
                                                            onClick={() => setActiveSubDepotFilter(item.key)}
                                                            className={`depot-chip ${isSelected ? 'selected' : ''} ${isStale ? 'stale' : ''}`}
                                                        >
                                                            {item.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {(activeTab === 'inventory' || activeTab === 'analytics') && (
                                            <>
                                                <p style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.35rem 0 0 0' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                                        {activeDepotName === 'all' 
                                                            ? (t('global_search_desc') || 'Tüm depoların verilerinde arama yapın.') 
                                                            : `${t('location')}: ${activeDepotName && activeDepotName.startsWith('town:') && activeSubDepotFilter === 'all' 
                                                                ? `${activeDepot.customName} (${language === 'tr' ? 'Birleşik Lojistik Deposu' : 'Combined Logistics Depot'})` 
                                                                : getDepotDisplayName(activeDepot)}`}
                                                    </span>
                                                    {activeDepotName !== 'all' && (() => {
                                                        const lastUpdated = activeDepot.lastUpdated;
                                                        const isStale = lastUpdated ? (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60) >= 12 : false;
                                                        return (
                                                            <>
                                                                <span style={{ color: 'var(--text-muted)' }}>|</span>
                                                                <span style={{ 
                                                                    fontWeight: 700, 
                                                                    fontSize: '0.85rem', 
                                                                    color: 'var(--text-secondary)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.35rem',
                                                                    flexWrap: 'wrap'
                                                                }}>
                                                                    {t('last_updated')}: <span title={lastUpdated} style={{ color: getRelativeTimeColor(lastUpdated), fontWeight: 800 }}>{getRelativeTimeString(lastUpdated, language)}</span>
                                                                    {isStale && (
                                                                        <span style={{ 
                                                                            marginLeft: '0.5rem', 
                                                                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                            color: '#ef4444', 
                                                                            fontWeight: 700,
                                                                            fontSize: '0.74rem',
                                                                            padding: '0.2rem 0.5rem',
                                                                            borderRadius: '4px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.3rem',
                                                                            boxShadow: '0 1px 2px rgba(239, 68, 68, 0.05)'
                                                                        }}>
                                                                            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                                                                            {language === 'tr' ? 'Lütfen bu depoyu güncelleyin!' : 'Please update this depot!'}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </p>
                                            </>
                                        )}
                                    </div>

                                </div>
                            )}







                            {activeTab === 'dev-portal' && (
                                <div className="depot-interface-header">
                                    <div className="depot-title-group">
                                        <h2>{userRole === 'developer' ? t('developer_portal') : userRole === 'logistics_lead' ? 'Logistics Lead Portal' : 'Officer Portal'}</h2>
                                        <p>{userRole === 'developer' ? t('developer_portal_desc') : userRole === 'logistics_lead' ? 'Access template configurations and logistics audit logs.' : 'Access historical logistics logs and security operations records.'}</p>
                                    </div>
                                </div>
                            )}


                            {/* Tab Contents */}
                            {activeTab === 'inventory' && (
                                <ErrorBoundary>
                                    <InventoryTab
                                        depots={depots}
                                        activeDepot={activeDepot}
                                        templates={templates}
                                        regionSettings={regionSettings}
                                    />
                                </ErrorBoundary>
                            )}
                            {activeTab === 'passcodes' && userRole !== 'recruit' && (
                                <ErrorBoundary>
                                    <StockpilePasscodesTab
                                        depots={depots}
                                        userRole={userRole}
                                        regionSettings={regionSettings}
                                        onEditDepotSettings={setSettingsDepotKey}
                                        onDeleteDepot={handleDeleteDepotKey}
                                    />
                                </ErrorBoundary>
                            )}
                            {activeTab === 'requests' && (
                                <ErrorBoundary>
                                    <SupplyRequestsTab
                                        requests={supplyRequests}
                                        userRole={userRole}
                                        depots={depots}
                                        templates={templates}
                                        regionSettings={regionSettings}
                                        onOpenCreateModal={() => setIsCreateRequestOpen(true)}
                                        onUpdateProgress={handleUpdateProgress}
                                        onToggleCompleteItem={handleToggleCompleteItem}
                                        onDeleteRequest={handleDeleteRequest}
                                        onToggleRequestStatus={handleToggleComplete}
                                        onRefresh={handleRefreshRequests}
                                        isRefreshing={isRefreshingRequests}
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
                                                     seenBy: n.seenBy || [],
                                                     pinnedUntil: n.pinnedUntil || null
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
                                                 seenBy: n.seenBy || [],
                                                 pinnedUntil: n.pinnedUntil || null
                                             };
                                         })}
                                         onOpenPublishModal={userRole !== 'member' ? () => setIsAnnouncementOpen(true) : undefined}
                                         userRole={userRole}
                                         onDeleteAnnouncement={handleDeleteAnnouncement}
                                         onPinAnnouncement={handlePinAnnouncement}
                                     />
                                 </ErrorBoundary>
                             )}
                                       {activeTab === 'analytics' && (
                                     <ErrorBoundary>
                                          <AnalyticsTab 
                                               depots={integratedDepots} 
                                               theme={theme} 
                                               supplyRequests={supplyRequests} 
                                               auditLogs={auditLogs} 
                                               activeDepotName={activeDepotName} 
                                               activeSubDepotFilter={activeSubDepotFilter}
                                                
                                               templates={templates}
                                               regionSettings={regionSettings}
                                           />
                                     </ErrorBoundary>
                                )}
                                        {activeTab === 'demand' && (
                                     <ErrorBoundary>
                                          <DemandTab 
                                               depots={integratedDepots} 
                                               templates={templates}
                                               regionSettings={regionSettings}
                                           />
                                     </ErrorBoundary>
                                )}
                              {activeTab === 'templates' && (userRole === 'developer' || userRole === 'logistics_lead') && (
                                   <ErrorBoundary>
                                        <StockpileTemplatesTab
                                             templates={templates}
                                             onSaveTemplates={async (newTemplates) => {
                                                 await dbService.saveTemplates(newTemplates);
                                                 setTemplates(newTemplates);
                                             }}
                                             userRole={userRole}
                                             regionSettings={regionSettings}
                                             onSaveRegionSettings={handleSaveRegionSettings}
                                             depots={integratedDepots}
                                        />
                                   </ErrorBoundary>
                              )}
                              {activeTab === 'transfer-calculator' && (
                                   <ErrorBoundary>
                                        <TransferCalculatorTab
                                             depots={integratedDepots}
                                             templates={templates}
                                             regionSettings={regionSettings}
                                             userRole={userRole}
                                             onSaveRequest={(req) => {
                                                 setSupplyRequests(prev => [req, ...prev]);
                                                 showToast(language === 'tr' ? "Sevkiyat planı Discord'a gönderildi!" : "Transport shipping plan sent to Discord!", 'success');
                                             }}
                                             currentUsername={currentUsername}
                                        />
                                   </ErrorBoundary>
                              )}
                              {activeTab === 'region-management' && (userRole === 'developer' || userRole === 'logistics_lead' || userRole === 'officer') && (
                                   <ErrorBoundary>
                                       <RegionManagementTab
                                           depots={depots}
                                           userRole={userRole}
                                           onIntegrateDepot={handleIntegrateDepot}
                                           onDeleteDepot={handleDeleteDepotKey}
                                       />
                                   </ErrorBoundary>
                              )}
                              {activeTab === 'leaderboard' && (
                                   <ErrorBoundary>
                                       <LeaderboardTab
                                           portalUsers={portalUsers}
                                       />
                                   </ErrorBoundary>
                               )}
                              {activeTab === 'direct-sync' && (
                                  <ErrorBoundary>
                                      <DirectSyncTab
                                          onSyncStockpiles={importParsedStockpiles}
                                      />
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
                                          onUpdateUserRole={handleUpdateUserRole}
                                          userRole={userRole}
                                          auditLogs={auditLogs}
                                          onClearAuditLogs={handleClearAuditLogs}
                                          feedbacks={feedbacks}
                                          onDeleteFeedback={handleDeleteFeedback}
                                          onUpdateFeedbackStatus={handleUpdateFeedbackStatus}
                                          onRefreshUsers={fetchPortalUsers}
                                          onResetLeaderboard={handleResetLeaderboard}
                                          minAppVersion={minAppVersion}
                                          onUpdateMinAppVersion={handleUpdateMinAppVersion}
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
                <p>{t('tactical_logistics_dashboard')} | v{APP_VERSION}</p>
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

            {settingsDepotKey && depots[settingsDepotKey] && (
                <DepotSettingsModal
                    isOpen={!!settingsDepotKey}
                    currentName={depots[settingsDepotKey].name}
                    currentAccessCode={depots[settingsDepotKey].accessCode || ''}
                    currentIsCodePublic={depots[settingsDepotKey].isCodePublic ?? false}
                    currentDepotType={depots[settingsDepotKey].depotType || 'backline'}
                    onSave={(accessCode, isCodePublic, depotType) => handleSaveDepotSettings(settingsDepotKey, accessCode, isCodePublic, depotType)}
                    onClose={() => setSettingsDepotKey(null)}
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
            <AppSidebar
                activeTab={activeTab}
                handleTabChange={handleTabChange}
                userRole={userRole}
                depots={depots}
                unreadFeedbackCount={unreadFeedbackCount}
                isChatOpen={isChatOpen}
                setIsChatOpen={setIsChatOpen}
                setChatUnreadCount={setChatUnreadCount}
                chatUnreadCount={chatUnreadCount}
                isPersonalizeOpen={isPersonalizeOpen}
                setIsPersonalizeOpen={setIsPersonalizeOpen}
                userClan={userClan}
            />

            {/* Coalition Chat Widget (Bottom-right float) */}


            {isCreateRequestOpen && (
                <CreateRequestModal
                    isOpen={isCreateRequestOpen}
                    depots={depots}
                    templates={templates}
                    regionSettings={regionSettings}
                    depotsHistory={depotsHistory}
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
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55)',
                            zIndex: 9999,
                            overflow: 'visible',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.02)', borderBottom: '1px solid rgba(16, 185, 129, 0.25)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <Sliders size={18} style={{ color: 'var(--accent-color)' }} />
                                <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{language === 'tr' ? 'Kişiselleştir' : 'Personalize'}</h2>
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


                            {/* Regiment/Clan Tag Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {language === 'tr' ? 'Koalisyon Birliği' : 'Regiment Tag'}
                                </span>
                                <CustomSelect
                                    options={[
                                        { value: '', label: language === 'tr' ? '-- Birlik Yok (No Regiment) --' : '-- No Regiment --' },
                                        ...['UBGE', 'PARS', 'JgF', 'RU', 'AFC', 'VOG', 'SBR'].map(clan => ({ value: clan, label: clan }))
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
