import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { dbService } from '../utils/dbService';
import { getDefaultTemplates } from '../utils/defaultTemplates';
import type { Depot, UserRole, SupplyRequest, SystemNotification, AuditLogEntry, PortalUser, StockpileTemplates, RegionSettings } from '../types';
import type { Language } from '../context/LanguageContext';

interface RealtimeDeps {
    masterKey: string | null;
    language: Language;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    handleDisconnect: () => void;
    setUserRole: React.Dispatch<React.SetStateAction<UserRole | null>>;
    setPortalUsers: React.Dispatch<React.SetStateAction<PortalUser[]>>;
    setSupplyRequests: React.Dispatch<React.SetStateAction<SupplyRequest[]>>;
    setDepots: React.Dispatch<React.SetStateAction<Record<string, Depot>>>;
    setNotifications: React.Dispatch<React.SetStateAction<SystemNotification[]>>;
    setAuditLogs: React.Dispatch<React.SetStateAction<AuditLogEntry[]>>;
    setFeedbacks: React.Dispatch<React.SetStateAction<any[]>>;
    setTemplates: React.Dispatch<React.SetStateAction<StockpileTemplates>>;
    setRegionSettings: React.Dispatch<React.SetStateAction<RegionSettings>>;
    isRemoteRequestsUpdateRef: React.MutableRefObject<boolean>;
    isRemoteDepotsUpdateRef: React.MutableRefObject<boolean>;
}

export function useRealtimeSubscriptions({
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
}: RealtimeDeps): void {
    useEffect(() => {
        if (!isSupabaseConfigured || !supabase || !masterKey) return;

        // 1. Subscribe to profiles changes
        const profilesChannel = supabase
            .channel('public-profiles')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles' },
                async (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string } }) => {
                    console.debug('[Real-time] Profile changed:', payload);
                    const updatedProfile = payload.new as Partial<PortalUser>;

                    if (updatedProfile) {
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

                        setPortalUsers(prev => {
                            const exists = prev.some(u => u.id === updatedProfile.id);
                            const mappedUser: PortalUser = {
                                id: updatedProfile.id || '',
                                username: updatedProfile.username || 'Unknown',
                                role: updatedProfile.role || 'member',
                                status: (updatedProfile.status || 'pending') as PortalUser['status'],
                                import_count: typeof updatedProfile.import_count === 'number' ? updatedProfile.import_count : 0,
                                request_count: typeof updatedProfile.request_count === 'number' ? updatedProfile.request_count : 0,
                                delivery_count: typeof updatedProfile.delivery_count === 'number' ? updatedProfile.delivery_count : 0
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
                console.debug('[Real-time] Profiles subscription status:', status);
            });

        // 2. Subscribe to supply_requests changes
        const requestsChannel = supabase
            .channel('public-supply-requests')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'supply_requests' },
                (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string } }) => {
                    console.debug('[Real-time] Supply request changed:', payload);
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
                        console.debug('[Real-time] DELETE payload received:', payload);
                        const oldId = payload.old?.id;
                        isRemoteRequestsUpdateRef.current = true;
                        if (oldId) {
                            setSupplyRequests(prev => {
                                const next = prev.filter(r => r.id !== oldId);
                                try { localStorage.setItem('docka_supply_requests', JSON.stringify(next)); } catch (e) {}
                                return next;
                            });
                        } else {
                            dbService.loadRequests(masterKey).then(updatedReqs => {
                                isRemoteRequestsUpdateRef.current = true;
                                setSupplyRequests(updatedReqs);
                            });
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.debug('[Real-time] Supply requests subscription status:', status);
            });

        // 3. Subscribe to depots changes
        const depotsChannel = supabase
            .channel('public-depots')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'depots' },
                (payload: { new: Record<string, unknown>; eventType: string; old?: { id?: string; name?: string } }) => {
                    console.debug('[Real-time] Depot changed:', payload);
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new as { name: string; data: string | Depot };
                        const parsedData = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                            ? JSON.parse(row.data)
                            : row.data;
                        const cleanName = dbService.normalizeDepotName(row.name);

                        setDepots(prev => {
                            const existing = prev[cleanName];
                            if (existing && JSON.stringify(existing) === JSON.stringify(parsedData)) {
                                return prev;
                            }
                            isRemoteDepotsUpdateRef.current = true;
                            const next = { ...prev };
                            if (row.name !== cleanName) {
                                delete next[row.name];
                            }
                            next[cleanName] = {
                                ...parsedData,
                                name: cleanName
                            };
                            return next;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        if (payload.old?.name) {
                            const oldName = dbService.normalizeDepotName(payload.old.name);
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
                console.debug('[Real-time] Depots subscription status:', status);
            });

        // 4. Subscribe to announcements table changes
        const announcementsChannel = supabase
            .channel('public-announcements')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'announcements' },
                (payload) => {
                    console.debug('[Real-time] Announcement changed:', payload);
                    if (payload.eventType === 'INSERT') {
                        const row = payload.new as any;
                        const newAnn: SystemNotification = {
                            id: row.id,
                            type: 'announcement',
                            message: `${row.title}: "${row.content}"`,
                            timestamp: row.created_at,
                            isRead: false,
                            announcementTitle: row.title,
                            announcementContent: row.content,
                            announcementSeverity: row.severity,
                            announcementAuthor: row.author,
                            announcementRole: row.role,
                            pinnedUntil: row.pinned_until || row.pinnedUntil || null
                        };
                        setNotifications(prev => {
                            const exists = prev.some(n => n.id === newAnn.id);
                            if (exists) return prev;
                            const next = [newAnn, ...prev];
                            localStorage.setItem('docka_notifications', JSON.stringify(next));
                            return next;
                        });
                        showToast(language === 'tr' ? "Yeni bir duyuru paylaşıldı!" : "A new announcement has been published!", "info");
                    } else if (payload.eventType === 'UPDATE') {
                        const row = payload.new as any;
                        setNotifications(prev => {
                            const next = prev.map(n => {
                                if (n.id === row.id) {
                                    const updatedPinned = row.pinned_until !== undefined ? row.pinned_until : row.pinnedUntil !== undefined ? row.pinnedUntil : n.pinnedUntil;
                                    return {
                                        ...n,
                                        announcementTitle: row.title || n.announcementTitle,
                                        announcementContent: row.content || n.announcementContent,
                                        announcementSeverity: row.severity || n.announcementSeverity,
                                        pinnedUntil: updatedPinned || null
                                    };
                                }
                                return n;
                            });
                            localStorage.setItem('docka_notifications', JSON.stringify(next));
                            return next;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        if (payload.old?.id) {
                            const deletedId = payload.old.id;
                            setNotifications(prev => {
                                const next = prev.filter(n => n.id !== deletedId);
                                localStorage.setItem('docka_notifications', JSON.stringify(next));
                                return next;
                            });
                        }
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'announcement_pinned' },
                (payload) => {
                    console.debug('[Broadcast] Announcement pin changed:', payload);
                    const { id, pinnedUntil } = payload.payload || {};
                    if (id !== undefined) {
                        setNotifications(prev => {
                            const next = prev.map(n => n.id === id ? { ...n, pinnedUntil } : n);
                            localStorage.setItem('docka_notifications', JSON.stringify(next));
                            return next;
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.debug('[Real-time] Announcements subscription status:', status);
            });

        // 5. Subscribe to audit logs table changes
        const auditLogsChannel = supabase
            .channel('public-audit-logs')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_logs' },
                (payload) => {
                    console.debug('[Real-time] Audit log inserted:', payload);
                    const row = payload.new as any;
                    const newLog: AuditLogEntry = {
                        id: row.id,
                        timestamp: row.timestamp,
                        username: row.username,
                        role: row.role,
                        action: row.action
                    };
                    setAuditLogs(prev => {
                        const exists = prev.some(l => l.id === newLog.id);
                        if (exists) return prev;
                        const next = [newLog, ...prev].slice(0, 300);
                        localStorage.setItem('docka_audit_logs', JSON.stringify(next));
                        return next;
                    });
                }
            )
            .subscribe((status) => {
                console.debug('[Real-time] Audit logs subscription status:', status);
            });

        // 6. Subscribe to system settings changes (templates & region settings)
        const systemSettingsChannel = supabase
            .channel('public-system-settings')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'system_settings' },
                (payload: any) => {
                    console.debug('[Real-time] System settings changed:', payload);
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const row = payload.new;
                        try {
                            const parsedValue = typeof row.setting_value === 'string'
                                ? JSON.parse(row.setting_value)
                                : row.setting_value;
                            if (row.setting_key === 'stockpile_templates') {
                                const defaults = getDefaultTemplates();
                                const merged: StockpileTemplates = {
                                    frontline: { ...defaults.frontline, ...(parsedValue.frontline || {}) },
                                    backline: { ...defaults.backline, ...(parsedValue.backline || {}) },
                                    airfield: { ...defaults.airfield, ...(parsedValue.airfield || parsedValue.aircraft || {}) }
                                };
                                Object.keys(parsedValue || {}).forEach(k => {
                                    if (k !== 'frontline' && k !== 'backline' && k !== 'airfield' && k !== 'aircraft') {
                                        merged[k] = parsedValue[k];
                                    }
                                });
                                setTemplates(merged);
                            } else if (row.setting_key === 'region_settings') {
                                setRegionSettings(parsedValue || {});
                            }
                        } catch (e) {
                            console.error('[Real-time] Failed to parse system setting:', e);
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.debug('[Real-time] System settings subscription status:', status);
            });

        // 7. Subscribe to feedbacks changes
        const feedbacksChannel = supabase
            .channel('public-feedbacks')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'feedbacks' },
                (payload) => {
                    console.debug('[Real-time] Feedback table change:', payload);
                    if (payload.eventType === 'INSERT') {
                        const row = payload.new as any;
                        setFeedbacks(prev => {
                            const exists = prev.some(f => f.id === row.id);
                            if (exists) return prev;
                            const next = [row, ...prev];
                            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
                            return next;
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const row = payload.new as any;
                        setFeedbacks(prev => {
                            const next = prev.map(f => f.id === row.id ? row : f);
                            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
                            return next;
                        });
                    } else if (payload.eventType === 'DELETE') {
                        const row = payload.old as any;
                        setFeedbacks(prev => {
                            const next = prev.filter(f => f.id !== row.id);
                            localStorage.setItem('docka_feedbacks', JSON.stringify(next));
                            return next;
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.debug('[Real-time] Feedbacks subscription status:', status);
            });

        return () => {
            if (supabase) {
                supabase.removeChannel(profilesChannel);
                supabase.removeChannel(requestsChannel);
                supabase.removeChannel(depotsChannel);
                supabase.removeChannel(announcementsChannel);
                supabase.removeChannel(auditLogsChannel);
                supabase.removeChannel(systemSettingsChannel);
                supabase.removeChannel(feedbacksChannel);
            }
        };
    }, [masterKey, handleDisconnect, showToast, language, setUserRole, setPortalUsers, setSupplyRequests, setDepots, setNotifications, setAuditLogs, setFeedbacks, setTemplates, setRegionSettings, isRemoteRequestsUpdateRef, isRemoteDepotsUpdateRef]);
}
