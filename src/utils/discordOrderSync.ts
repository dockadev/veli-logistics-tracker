import type { SupplyRequest } from '../types';

const WORKER_SYNC_URL = 'https://foxhole-depot-tracker-bot.efemertk476.workers.dev/sync-order';
const WORKER_DELETE_CHANNEL_URL = 'https://foxhole-depot-tracker-bot.efemertk476.workers.dev/delete-channel';

// Internal worker endpoints are protected with a shared secret header.
// The secret is stored in Supabase (system_settings) and loaded at runtime,
// so it is never hardcoded in the app binary source.
let cachedInternalSecret: string | null = null;

async function getInternalSecret(): Promise<string> {
    if (cachedInternalSecret !== null) return cachedInternalSecret;
    try {
        const { dbService } = await import('./dbService');
        cachedInternalSecret = await dbService.loadInternalApiSecret();
    } catch {
        cachedInternalSecret = '';
    }
    return cachedInternalSecret;
}

async function internalHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const secret = await getInternalSecret();
    if (secret) {
        headers['x-internal-secret'] = secret;
    }
    return headers;
}

export async function syncOrderToDiscord(req: SupplyRequest): Promise<{ messageId?: string; channelId?: string }> {
    try {
        const res = await fetch(WORKER_SYNC_URL, {
            method: 'POST',
            headers: await internalHeaders(),
            body: JSON.stringify({ request: req })
        });

        if (res.ok) {
            const data = await res.json() as { messageId?: string; channelId?: string };
            return data;
        } else {
            console.error('Failed to sync order via worker:', await res.text());
        }
    } catch (e) {
        console.error('Discord order sync exception:', e);
    }

    return {};
}

export async function deleteDiscordChannel(channelId: string): Promise<boolean> {
    if (!channelId) return false;
    try {
        const res = await fetch(WORKER_DELETE_CHANNEL_URL, {
            method: 'POST',
            headers: await internalHeaders(),
            body: JSON.stringify({ channelId })
        });
        return res.ok;
    } catch (e) {
        console.error('Discord channel deletion exception:', e);
        return false;
    }
}
