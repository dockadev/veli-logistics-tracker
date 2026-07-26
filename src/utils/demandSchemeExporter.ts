import { toBlob } from 'html-to-image';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function exportDemandOverviewPNG(elementId: string = 'demand-overview-all-cities'): Promise<string | null> {
    try {
        const node = document.getElementById(elementId);
        if (!node) {
            console.warn('[DemandSchemeExporter] DOM element not found:', elementId);
            return null;
        }

        const blob = await toBlob(node, {
            quality: 0.95,
            cacheBust: true,
            backgroundColor: '#16161a'
        });

        if (!blob) {
            console.error('[DemandSchemeExporter] Failed to render Blob from DOM element.');
            return null;
        }

        if (isSupabaseConfigured && supabase) {
            const fileName = 'demand_overview.png';
            const { data, error } = await supabase.storage
                .from('public-assets')
                .upload(fileName, blob, {
                    contentType: 'image/png',
                    cacheControl: '60',
                    upsert: true
                });

            if (error) {
                console.error('[DemandSchemeExporter] Supabase storage upload error:', error);
                return null;
            }

            const { data: publicUrlData } = supabase.storage
                .from('public-assets')
                .getPublicUrl(fileName);

            return publicUrlData.publicUrl;
        }
    } catch (err) {
        console.error('[DemandSchemeExporter] Exception during export:', err);
    }
    return null;
}
