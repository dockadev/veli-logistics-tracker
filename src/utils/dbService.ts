import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Depot, SupplyRequest, DepotHistoryEntry, SystemNotification, AuditLogEntry, StockpileTemplates, StockpileTemplateRule, RegionSettings } from '../types';
import { getItemOfficialCategory } from './itemCategories';
import { getDefaultTemplates } from './defaultTemplates';

function migrateDepot(depot: Depot): Depot {
    if (!depot) return depot;
    if (depot.isIntegrated === undefined) {
        depot.isIntegrated = true;
    }
    if (depot.current) {
        Object.entries(depot.current).forEach(([name, item]) => {
            const cat = getItemOfficialCategory(name);
            const isVeh = cat === 'vehicles' || cat === 'vehicle_crates';
            if (name.endsWith('(Crate)') && isVeh && item.category !== 'crate_vehicle') {
                item.category = 'crate_vehicle';
            }
        });
    }
    if (depot.previous) {
        Object.entries(depot.previous).forEach(([name, item]) => {
            const cat = getItemOfficialCategory(name);
            const isVeh = cat === 'vehicles' || cat === 'vehicle_crates';
            if (name.endsWith('(Crate)') && isVeh && item.category !== 'crate_vehicle') {
                item.category = 'crate_vehicle';
            }
        });
    }
    return depot;
}

function migrateRequest(req: SupplyRequest): SupplyRequest {
    if (!req || !req.items) return req;
    req.items.forEach(item => {
        item.itemCategory = getItemOfficialCategory(item.itemName);
    });
    return req;
}

function normalizeDepotName(name: string): string {
    let clean = name.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
    const parts = clean.split(/\s+-\s+/).map(p => p.trim());
    if (parts.length > 0) {
        if (parts[0] === 'The Blemish') {
            parts[0] = 'Blemish';
        }
        const mappedParts = parts.map((part, index) => {
            if (index === 1) return part;
            const trimmed = part.trim();
            if (trimmed === 'The Blemish') return 'Blemish';
            const lower = trimmed.toLowerCase();
            if (
                lower === 'seaport' || 
                lower === 'seehafen' || 
                lower === 'porto' || 
                lower === 'porto marítimo' || 
                lower === 'port maritime' || 
                lower === 'морской порт' ||
                lower === 'port'
            ) {
                return 'Seaport';
            }
            if (
                lower === 'storage depot' || 
                lower === 'lagerdepot' || 
                lower === 'depósito de suprimentos' || 
                lower === 'depósito de armazenamento' || 
                lower === 'dépôt de stockage' ||
                lower === 'dépôt' ||
                lower === 'скladское помещение' ||
                lower === 'складское помещение' ||
                lower === 'склад'
            ) {
                return 'Storage Depot';
            }
            if (
                lower === 'aircraft depot' ||
                lower === 'flugzeugdepot' ||
                lower === 'depósito de aeronaves' ||
                lower === 'dépôt d\'avions' ||
                lower === 'авиационный склад'
            ) {
                return 'Aircraft Depot';
            }
            return part;
        });
        return mappedParts.join(' - ');
    }
    return clean;
}

function getMatchKey(rawFullName: string): string {
    const fullName = rawFullName.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
    const parts = fullName.split(/\s+-\s+/).map(p => p.trim());
    const region = parts[0] || '';
    
    const typePart = parts.find(p => {
        const l = p.toLowerCase();
        return (
            l.includes('seaport') || l.includes('depot') || l.includes('port') ||
            l.includes('seehafen') || l.includes('porto') || l.includes('порт') ||
            l.includes('скlad') || l.includes('скladское') || l.includes('склад') || l.includes('lager') || l.includes('depósito')
        );
    }) || '';
    
    let type = typePart.toLowerCase();
    if (
        type.includes('seaport') || type.includes('seehafen') || 
        type.includes('porto') || type.includes('порт') || type.includes('port')
    ) {
        type = 'seaport';
    } else if (
        type.includes('aircraft') || type.includes('flugzeug') ||
        type.includes('aeronaves') || type.includes('авиационный')
    ) {
        type = 'aircraft depot';
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
    const name = parts[parts.length - 1] || '';
    return `${normalizedRegion}_${type}_${name.toLowerCase()}`;
}

export const dbService = {
    normalizeDepotName(name: string): string {
        return normalizeDepotName(name);
    },

    // Depots Management
    async loadDepots(_masterKey: string): Promise<Record<string, Depot>> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data, error } = await supabase
                        .from('depots')
                        .select('*');
                    if (error) {
                        console.error('[DB Service] Error loading depots from Supabase:', error);
                    } else if (data) {
                        const record: Record<string, Depot> = {};
                        const matchKeyGroups: Record<string, { key: string; depot: Depot; rawName: string }[]> = {};
                        
                        data.forEach((row: { name: string; data: string | Depot }) => {
                            try {
                                const parsed = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                                    ? JSON.parse(row.data)
                                    : row.data;
                                const migrated = migrateDepot(parsed);
                                const cleanName = normalizeDepotName(row.name);
                                migrated.name = cleanName;
                                
                                const mKey = getMatchKey(cleanName);
                                if (!matchKeyGroups[mKey]) {
                                    matchKeyGroups[mKey] = [];
                                }
                                matchKeyGroups[mKey].push({ key: cleanName, depot: migrated, rawName: row.name });
                            } catch (e) {
                                console.error(`[DB Service] Failed to parse depot ${row.name}:`, e);
                            }
                        });

                        const keysToDeleteFromDb: string[] = [];
                        Object.keys(matchKeyGroups).forEach(mKey => {
                            const group = matchKeyGroups[mKey];
                            if (group.length === 1) {
                                record[group[0].key] = group[0].depot;
                            } else {
                                group.sort((a, b) => {
                                    const timeA = new Date(a.depot.lastUpdated).getTime();
                                    const timeB = new Date(b.depot.lastUpdated).getTime();
                                    const isTimeValidA = !isNaN(timeA);
                                    const isTimeValidB = !isNaN(timeB);
                                    
                                    if (isTimeValidA && isTimeValidB) {
                                        if (timeB !== timeA) return timeB - timeA;
                                    } else if (isTimeValidA) {
                                        return -1;
                                    } else if (isTimeValidB) {
                                        return 1;
                                    }
                                    return b.key.length - a.key.length;
                                });
                                
                                const winner = group[0];
                                record[winner.key] = winner.depot;
                                
                                for (let i = 1; i < group.length; i++) {
                                    keysToDeleteFromDb.push(group[i].rawName);
                                    if (group[i].key !== winner.key) {
                                        keysToDeleteFromDb.push(group[i].key);
                                    }
                                }
                            }
                        });

                        if (keysToDeleteFromDb.length > 0) {
                            console.log('[DB Service] Deleting obsolete merged duplicate rows:', keysToDeleteFromDb);
                            supabase.from('depots').delete().in('name', keysToDeleteFromDb).then(({ error }) => {
                                if (error) console.error('[DB Service] Failed to delete obsolete depots:', error);
                            });
                        }
                        
                        return record;
                    }
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for depots:', err);
            }
        }
        
        // Fallback to local storage (unencrypted JSON)
        const localDepotsStr = localStorage.getItem('docka_local_depots');
        if (!localDepotsStr) return {};
        try {
            const parsed = JSON.parse(localDepotsStr);
            const cleanRecord: Record<string, Depot> = {};
            const matchKeyGroups: Record<string, { key: string; depot: Depot }[]> = {};
            
            Object.keys(parsed).forEach(key => {
                const cleanKey = normalizeDepotName(key);
                const migrated = migrateDepot(parsed[key]);
                migrated.name = cleanKey;
                
                const mKey = getMatchKey(cleanKey);
                if (!matchKeyGroups[mKey]) {
                    matchKeyGroups[mKey] = [];
                }
                matchKeyGroups[mKey].push({ key: cleanKey, depot: migrated });
            });
            
            Object.keys(matchKeyGroups).forEach(mKey => {
                const group = matchKeyGroups[mKey];
                if (group.length === 1) {
                    cleanRecord[group[0].key] = group[0].depot;
                } else {
                    group.sort((a, b) => {
                        const timeA = new Date(a.depot.lastUpdated).getTime();
                        const timeB = new Date(b.depot.lastUpdated).getTime();
                        const isTimeValidA = !isNaN(timeA);
                        const isTimeValidB = !isNaN(timeB);
                        
                        if (isTimeValidA && isTimeValidB) {
                            if (timeB !== timeA) return timeB - timeA;
                        } else if (isTimeValidA) {
                            return -1;
                        } else if (isTimeValidB) {
                            return 1;
                        }
                        return b.key.length - a.key.length;
                    });
                    const winner = group[0];
                    cleanRecord[winner.key] = winner.depot;
                }
            });
            return cleanRecord;
        } catch (e) {
            console.error('[DB Service] Local parsing of depots failed:', e);
            return {};
        }
    },

    async saveDepots(depots: Record<string, Depot>, _masterKey: string, skipSupabase = false): Promise<void> {
        const client = supabase;
        if (!skipSupabase && isSupabaseConfigured && client) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session) {
                    // Synchronize Supabase table by deleting any depots that are not in memory record
                    const { data: existing } = await client.from('depots').select('name');
                    if (existing) {
                        const nextNames = new Set(Object.keys(depots));
                        const namesToDelete = existing
                            .map((r: { name: string }) => r.name)
                            .filter((name: string) => !nextNames.has(name));
                        
                        if (namesToDelete.length > 0) {
                            await Promise.all(namesToDelete.map(async (name) => {
                                await client.from('depots').delete().eq('name', name);
                            }));
                        }
                    }

                    // Save to Supabase (bulk upsert all depots at once)
                    const rows = Object.entries(depots).map(([name, depot]) => ({
                        name,
                        data: JSON.stringify(depot),
                        updated_by: session.user.id,
                        updated_at: new Date().toISOString()
                    }));
                    if (rows.length > 0) {
                        const { error } = await client
                            .from('depots')
                            .upsert(rows, { onConflict: 'name' });
                        if (error) {
                            console.error('[DB Service] Error saving depots to Supabase:', error);
                        } else {
                            // Find the most recently updated depot to record in history
                            let newestDepotName = '';
                            let newestTime = 0;
                            Object.entries(depots).forEach(([name, depot]) => {
                                if (depot.lastUpdated) {
                                    const t = new Date(depot.lastUpdated).getTime();
                                    if (t > newestTime) {
                                        newestTime = t;
                                        newestDepotName = name;
                                    }
                                }
                            });

                            if (newestDepotName && (new Date().getTime() - newestTime < 60000)) {
                                const newestDepot = depots[newestDepotName];
                                // Check if this history entry was already logged to prevent double-logging
                                const { data: existing } = await client
                                    .from('depots_history')
                                    .select('id')
                                    .eq('depot_name', newestDepotName)
                                    .eq('imported_at', newestDepot.lastUpdated)
                                    .limit(1);

                                if (!existing || existing.length === 0) {
                                    await client.from('depots_history').insert({
                                        depot_name: newestDepotName,
                                        items: newestDepot.current,
                                        imported_by: session.user.id,
                                        imported_at: newestDepot.lastUpdated
                                    });

                                    // Clean up history older than 7 days
                                    const sevenDaysAgo = new Date();
                                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                                    await client
                                        .from('depots_history')
                                        .delete()
                                        .lt('imported_at', sevenDaysAgo.toISOString());
                                }
                            }
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for saveDepots:', err);
            }
        }

        // Fallback to local storage (unencrypted JSON)
        localStorage.setItem('docka_local_depots', JSON.stringify(depots));
    },

    async deleteDepot(name: string): Promise<void> {
        // Fallback / local storage update
        const local = localStorage.getItem('docka_local_depots');
        if (local) {
            try {
                const depots = JSON.parse(local);
                if (depots[name]) {
                    delete depots[name];
                    localStorage.setItem('docka_local_depots', JSON.stringify(depots));
                }
            } catch (e) {
                console.error('[DB Service] Error updating local depots on delete:', e);
            }
        }

        const client = supabase;
        if (isSupabaseConfigured && client) {
            try {
                const { error } = await client
                    .from('depots')
                    .delete()
                    .eq('name', name);
                if (error) {
                    console.error(`[DB Service] Error deleting depot ${name} from Supabase:`, error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase delete depot failed:', err);
            }
        }
    },

    // Supply Requests Management
    async loadRequests(_masterKey: string): Promise<SupplyRequest[]> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data, error } = await supabase
                        .from('supply_requests')
                        .select('*');
                    if (error) {
                        console.error('[DB Service] Error loading requests from Supabase:', error);
                    } else if (data) {
                        return data.map((row: { id: string; data: string | SupplyRequest; status: 'open' | 'completed' }) => {
                            const parsedData = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                                ? JSON.parse(row.data)
                                : row.data;
                            const migrated = migrateRequest({
                                ...parsedData,
                                id: row.id,
                                status: row.status
                            } as SupplyRequest);
                            return migrated;
                        });
                    }
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for requests:', err);
            }
        }

        // Fallback to local storage
        // Fallback to local storage (unencrypted JSON)
        const localReqsStr = localStorage.getItem('docka_local_requests');
        if (!localReqsStr) return [];
        try {
            const parsed = JSON.parse(localReqsStr) as SupplyRequest[];
            return parsed.map(migrateRequest);
        } catch (e) {
            console.error('[DB Service] Local parsing of requests failed:', e);
            return [];
        }
    },

    async saveRequests(requests: SupplyRequest[], _masterKey: string, skipSupabase = false): Promise<void> {
        if (!skipSupabase && isSupabaseConfigured && supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    // Save to Supabase (bulk upsert all requests at once)
                    const rows = requests.map(req => ({
                        id: req.id,
                        data: JSON.stringify(req),
                        status: req.status,
                        updated_by: session.user.id,
                        updated_at: new Date().toISOString()
                    }));
                    if (rows.length > 0) {
                        const { error } = await supabase
                            .from('supply_requests')
                            .upsert(rows, { onConflict: 'id' });
                        if (error) {
                            console.error('[DB Service] Error saving requests to Supabase:', error);
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for saveRequests:', err);
            }
        }

        // Fallback to local storage (unencrypted JSON)
        localStorage.setItem('docka_local_requests', JSON.stringify(requests));
    },

    async deleteRequest(id: string): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('supply_requests')
                    .delete()
                    .eq('id', id);
                if (error) {
                    console.error(`[DB Service] Error deleting request ${id} from Supabase:`, error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase delete request failed:', err);
            }
        }
    },

    async clearAllData(): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error: error1 } = await supabase
                    .from('depots')
                    .delete()
                    .neq('name', '');
                const { error: error2 } = await supabase
                    .from('supply_requests')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                if (error1) console.error('[DB Service] Error clearing depots from Supabase:', error1);
                if (error2) console.error('[DB Service] Error clearing requests from Supabase:', error2);
            } catch (err) {
                console.error('[DB Service] Supabase clear all failed:', err);
            }
        }
    },

    async incrementProfileStat(statType: 'import' | 'request' | 'delivery', amount: number = 1): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase.rpc('increment_profile_stat', { 
                    stat_type: statType,
                    amount: amount
                });
                if (error) {
                    console.error(`[DB Service] Error incrementing profile stat ${statType} by ${amount}:`, error);
                }
            } catch (err) {
                console.error('[DB Service] RPC call failed for incrementProfileStat:', err);
            }
        }
    },

    async resetLeaderboardStats(): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase.rpc('reset_leaderboard_stats');
                if (error) {
                    throw error;
                }
            } catch (err: any) {
                console.error('[DB Service] RPC call failed for resetLeaderboardStats:', err?.message || err, err?.details, err?.hint);
                throw err;
            }
        }
    },

    async loadDepotsHistory(): Promise<DepotHistoryEntry[]> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('depots_history')
                    .select('*')
                    .order('imported_at', { ascending: true });
                if (error) {
                    console.error('[DB Service] Error loading depots history:', error);
                    return [];
                }
                return data || [];
            } catch (err) {
                console.error('[DB Service] Supabase loadDepotsHistory failed:', err);
                return [];
            }
        }
        return [];
    },

    async loadAnnouncements(): Promise<SystemNotification[]> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('announcements')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) {
                    console.warn('[DB Service] Announcements table load failed (table might not exist yet):', error);
                } else if (data) {
                    return data.map((row: any) => ({
                        id: row.id,
                        type: 'announcement',
                        message: `${row.title}: "${row.content}"`,
                        timestamp: row.created_at,
                        isRead: false,
                        announcementTitle: row.title,
                        announcementContent: row.content,
                        announcementSeverity: row.severity,
                        announcementAuthor: row.author,
                        announcementRole: row.role
                    }));
                }
            } catch (err) {
                console.error('[DB Service] Supabase loadAnnouncements failed:', err);
            }
        }
        return [];
    },

    async saveAnnouncement(ann: SystemNotification): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('announcements')
                    .insert({
                        id: ann.id,
                        title: ann.announcementTitle || '',
                        content: ann.announcementContent || '',
                        severity: ann.announcementSeverity || 'normal',
                        author: ann.announcementAuthor || 'Unknown',
                        role: ann.announcementRole || 'member',
                        created_at: ann.timestamp
                    });
                if (error) {
                    console.error('[DB Service] Error saving announcement to Supabase:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase saveAnnouncement failed:', err);
            }
        }
    },

    async deleteAnnouncement(id: string): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('announcements')
                    .delete()
                    .eq('id', id);
                if (error) {
                    console.error('[DB Service] Error deleting announcement from Supabase:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase deleteAnnouncement failed:', err);
            }
        }
    },

    async loadAuditLogs(): Promise<AuditLogEntry[]> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('audit_logs')
                    .select('*')
                    .order('timestamp', { ascending: false })
                    .limit(300);
                if (error) {
                    console.warn('[DB Service] Audit logs table load failed (table might not exist yet):', error);
                } else if (data) {
                    return data.map((row: any) => ({
                        id: row.id,
                        timestamp: row.timestamp,
                        username: row.username,
                        role: row.role,
                        action: row.action
                    }));
                }
            } catch (err) {
                console.error('[DB Service] Supabase loadAuditLogs failed:', err);
            }
        }
        return [];
    },

    async saveAuditLog(log: AuditLogEntry): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('audit_logs')
                    .insert({
                        id: log.id,
                        username: log.username,
                        role: log.role,
                        action: log.action,
                        timestamp: log.timestamp
                    });
                if (error) {
                    console.error('[DB Service] Error saving audit log to Supabase:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase saveAuditLog failed:', err);
            }
        }
    },

    async loadTemplates(): Promise<StockpileTemplates> {
        const defaults = getDefaultTemplates();

        // Normalise stored template keys: map straight-quote keys to their
        // curly-quote equivalents so stale Supabase/local data doesn't shadow
        // the correctly keyed defaults.
        const normalizeKeys = (raw: Record<string, StockpileTemplateRule>): Record<string, StockpileTemplateRule> => {
            const result: Record<string, StockpileTemplateRule> = {};
            // Build a lookup: straight-quote version of each default key -> original key
            const straightToOriginal: Record<string, string> = {};
            Object.keys(defaults.frontline).forEach(k => {
                straightToOriginal[k.replace(/[\u201c\u201d]/g, '"')] = k;
            });
            Object.entries(raw).forEach(([k, v]) => {
                const mapped = straightToOriginal[k] || straightToOriginal[k.replace(/[\u201c\u201d]/g, '"')] || k;
                result[mapped] = v;
            });
            return result;
        };

        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('setting_value')
                    .eq('setting_key', 'stockpile_templates')
                    .single();
                if (!error && data && data.setting_value) {
                    const parsed = typeof data.setting_value === 'string'
                        ? JSON.parse(data.setting_value)
                        : data.setting_value;
                    
                    const merged: StockpileTemplates = {
                        frontline: { ...defaults.frontline, ...normalizeKeys(parsed.frontline || {}) },
                        backline: { ...defaults.backline, ...normalizeKeys(parsed.backline || {}) },
                        aircraft: { ...defaults.aircraft, ...normalizeKeys(parsed.aircraft || {}) }
                    };

                    Object.keys(parsed).forEach(k => {
                        if (k !== 'frontline' && k !== 'backline' && k !== 'aircraft') {
                            merged[k] = normalizeKeys(parsed[k] || {});
                        }
                    });

                    return merged;
                }
            } catch (err) {
                console.warn('[DB Service] Supabase loadTemplates failed or table not ready, using defaults/local:', err);
            }
        }

        const local = localStorage.getItem('docka_stockpile_templates');
        if (local) {
            try {
                const parsed = JSON.parse(local);
                const merged: StockpileTemplates = {
                    frontline: { ...defaults.frontline, ...normalizeKeys(parsed.frontline || {}) },
                    backline: { ...defaults.backline, ...normalizeKeys(parsed.backline || {}) },
                    aircraft: { ...defaults.aircraft, ...normalizeKeys(parsed.aircraft || {}) }
                };

                Object.keys(parsed).forEach(k => {
                    if (k !== 'frontline' && k !== 'backline' && k !== 'aircraft') {
                        merged[k] = normalizeKeys(parsed[k] || {});
                    }
                });

                return merged;
            } catch (e) {
                console.error('[DB Service] Local parsing of templates failed:', e);
            }
        }
        return defaults;
    },


    async saveTemplates(templates: StockpileTemplates): Promise<void> {
        localStorage.setItem('docka_stockpile_templates', JSON.stringify(templates));
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('system_settings')
                    .upsert({
                        setting_key: 'stockpile_templates',
                        setting_value: JSON.stringify(templates),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'setting_key' });
                if (error) {
                    console.error('[DB Service] Error saving templates to Supabase system_settings:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase saveTemplates failed:', err);
            }
        }
    },

    async loadTemplateColors(): Promise<Record<string, string>> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('setting_value')
                    .eq('setting_key', 'template_colors')
                    .single();
                if (!error && data && data.setting_value) {
                    const parsed = typeof data.setting_value === 'string'
                        ? JSON.parse(data.setting_value)
                        : data.setting_value;
                    return parsed as Record<string, string>;
                }
            } catch (err) {
                console.warn('[DB Service] Supabase loadTemplateColors failed:', err);
            }
        }
        const local = localStorage.getItem('foxhole_template_colors');
        if (local) {
            try { return JSON.parse(local); } catch (e) {}
        }
        return { frontline: '#ef4444', backline: '#ffffff', aircraft: '#06b6d4' };
    },

    async saveTemplateColors(colors: Record<string, string>): Promise<void> {
        localStorage.setItem('foxhole_template_colors', JSON.stringify(colors));
        if (isSupabaseConfigured && supabase) {
            try {
                await supabase
                    .from('system_settings')
                    .upsert({
                        setting_key: 'template_colors',
                        setting_value: JSON.stringify(colors),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'setting_key' });
            } catch (err) {
                console.error('[DB Service] Supabase saveTemplateColors failed:', err);
            }
        }
    },

    async loadRegionSettings(): Promise<RegionSettings> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('setting_value')
                    .eq('setting_key', 'region_settings')
                    .single();
                if (!error && data && data.setting_value) {
                    const parsed = typeof data.setting_value === 'string'
                        ? JSON.parse(data.setting_value)
                        : data.setting_value;
                    return parsed as RegionSettings;
                }
            } catch (err) {
                console.warn('[DB Service] Supabase loadRegionSettings failed, using local/empty:', err);
            }
        }

        const local = localStorage.getItem('docka_region_settings');
        if (local) {
            try {
                return JSON.parse(local) as RegionSettings;
            } catch (e) {
                console.error('[DB Service] Local parsing of region settings failed:', e);
            }
        }
        return {};
    },

    async saveRegionSettings(settings: RegionSettings): Promise<void> {
        localStorage.setItem('docka_region_settings', JSON.stringify(settings));
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('system_settings')
                    .upsert({
                        setting_key: 'region_settings',
                        setting_value: JSON.stringify(settings),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'setting_key' });
                if (error) {
                    console.error('[DB Service] Error saving region settings to Supabase system_settings:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase saveRegionSettings failed:', err);
            }
        }
    },

    async loadMinAppVersion(): Promise<string> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('setting_value')
                    .eq('setting_key', 'min_app_version')
                    .single();
                if (!error && data && data.setting_value) {
                    const val = typeof data.setting_value === 'string'
                        ? data.setting_value
                        : JSON.stringify(data.setting_value);
                    return val.replace(/^"|"$/g, '').trim();
                }
            } catch (err) {
                console.warn('[DB Service] Supabase loadMinAppVersion failed:', err);
            }
        }
        return '0.1.64';
    },

    async saveMinAppVersion(version: string): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
                    .from('system_settings')
                    .upsert({
                        setting_key: 'min_app_version',
                        setting_value: version,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'setting_key' });
                if (error) {
                    console.error('[DB Service] Error saving min app version to Supabase system_settings:', error);
                }
            } catch (err) {
                console.error('[DB Service] Supabase saveMinAppVersion failed:', err);
            }
        }
    }
};
