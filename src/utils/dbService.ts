import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Depot, SupplyRequest } from '../types';
import { isVehicleName } from './csvParser';

function migrateDepot(depot: Depot): Depot {
    if (!depot) return depot;
    if (depot.current) {
        Object.entries(depot.current).forEach(([name, item]) => {
            if (name.endsWith('(Crate)') && isVehicleName(name) && item.category !== 'crate_vehicle') {
                item.category = 'crate_vehicle';
            }
        });
    }
    if (depot.previous) {
        Object.entries(depot.previous).forEach(([name, item]) => {
            if (name.endsWith('(Crate)') && isVehicleName(name) && item.category !== 'crate_vehicle') {
                item.category = 'crate_vehicle';
            }
        });
    }
    return depot;
}

function migrateRequest(req: SupplyRequest): SupplyRequest {
    if (!req || !req.items) return req;
    req.items.forEach(item => {
        if (item.itemName.endsWith('(Crate)') && isVehicleName(item.itemName) && item.itemCategory !== 'crate_vehicle') {
            item.itemCategory = 'crate_vehicle';
        }
    });
    return req;
}

export const dbService = {
    // Depots Management
    async loadDepots(masterKey: string): Promise<Record<string, Depot>> {
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
                        data.forEach((row: { name: string; data: string | Depot }) => {
                            try {
                                const parsed = typeof row.data === 'string' && (row.data.startsWith('{') || row.data.startsWith('['))
                                    ? JSON.parse(row.data)
                                    : row.data;
                                record[row.name] = migrateDepot(parsed);
                            } catch (e) {
                                console.error(`[DB Service] Failed to parse depot ${row.name}:`, e);
                            }
                        });
                        return record;
                    }
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for depots:', err);
            }
        }
        
        // Fallback to local storage (encrypted)
        const encDepotsStr = localStorage.getItem('docka_enc_depots');
        if (!encDepotsStr) return {};
        try {
            const encObj = JSON.parse(encDepotsStr);
            const { decryptWithPassword } = await import('./crypto');
            const decrypted = await decryptWithPassword(encObj, masterKey);
            const parsed = JSON.parse(decrypted);
            Object.keys(parsed).forEach(key => {
                parsed[key] = migrateDepot(parsed[key]);
            });
            return parsed;
        } catch (e) {
            console.error('[DB Service] Local decryption of depots failed:', e);
            return {};
        }
    },

    async saveDepots(depots: Record<string, Depot>, masterKey: string, skipSupabase = false): Promise<void> {
        if (!skipSupabase && isSupabaseConfigured && supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    // Save to Supabase (bulk upsert all depots at once)
                    const rows = Object.entries(depots).map(([name, depot]) => ({
                        name,
                        data: JSON.stringify(depot),
                        updated_by: session.user.id,
                        updated_at: new Date().toISOString()
                    }));
                    if (rows.length > 0) {
                        const { error } = await supabase
                            .from('depots')
                            .upsert(rows, { onConflict: 'name' });
                        if (error) {
                            console.error('[DB Service] Error saving depots to Supabase:', error);
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error('[DB Service] Supabase session fetch failed for saveDepots:', err);
            }
        }

        // Fallback to local storage
        const { encryptWithPassword } = await import('./crypto');
        const encrypted = await encryptWithPassword(JSON.stringify(depots), masterKey);
        localStorage.setItem('docka_enc_depots', JSON.stringify(encrypted));
    },

    async deleteDepot(name: string): Promise<void> {
        if (isSupabaseConfigured && supabase) {
            try {
                const { error } = await supabase
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
    async loadRequests(masterKey: string): Promise<SupplyRequest[]> {
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
        const encReqsStr = localStorage.getItem('docka_enc_requests');
        if (!encReqsStr) return [];
        try {
            const encObj = JSON.parse(encReqsStr);
            const { decryptWithPassword } = await import('./crypto');
            const decrypted = await decryptWithPassword(encObj, masterKey);
            const parsed = JSON.parse(decrypted) as SupplyRequest[];
            return parsed.map(migrateRequest);
        } catch (e) {
            console.error('[DB Service] Local decryption of requests failed:', e);
            return [];
        }
    },

    async saveRequests(requests: SupplyRequest[], masterKey: string, skipSupabase = false): Promise<void> {
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

        // Fallback to local storage
        const { encryptWithPassword } = await import('./crypto');
        const encrypted = await encryptWithPassword(JSON.stringify(requests), masterKey);
        localStorage.setItem('docka_enc_requests', JSON.stringify(encrypted));
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
    }
};
