import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

interface WarStatus {
  warNumber: number;
  warDay: number;
  wardenVP: number;
  colonialVP: number;
  requiredVP: number;
  winner: string;
  conquestStartTime: number | null;
  totalCasualties: { warden: number; colonial: number };
  isLive: boolean;
  isMock?: boolean;
  error?: string;
}

interface MapDynamicData {
  mapItems?: Array<{
    flags: number;
    teamId: string;
  }>;
}

interface MapReportData {
  wardenCasualties?: number;
  colonialCasualties?: number;
}

interface WarGeneralData {
  warNumber?: number;
  requiredVictoryTowns?: number;
  winner?: string;
  conquestStartTime?: number | null;
}

let cachedWarStatus: WarStatus | null = null;
let cacheTimestamp = 0;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'war-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/war-status') {
            // Check cache (60 seconds)
            if (cachedWarStatus && (Date.now() - cacheTimestamp < 60000)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(cachedWarStatus));
              return;
            }

            const BASE_URL = 'https://war-service-live.foxholeservices.com/api';

            try {
              // 1. Fetch general war status
              const warRes = await fetch(`${BASE_URL}/worldconquest/war`);
              if (!warRes.ok) {
                throw new Error(`Failed to fetch war status: ${warRes.status}`);
              }
              const warData = await warRes.json() as WarGeneralData;

              // If war hasn't started or is over
              if (!warData.conquestStartTime) {
                const responsePayload = {
                  warNumber: warData.warNumber || 0,
                  warDay: 0,
                  wardenVP: 0,
                  colonialVP: 0,
                  requiredVP: warData.requiredVictoryTowns || 32,
                  winner: warData.winner || 'NONE',
                  conquestStartTime: null,
                  totalCasualties: { warden: 0, colonial: 0 },
                  isLive: false
                };
                cachedWarStatus = responsePayload;
                cacheTimestamp = Date.now();

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify(responsePayload));
                return;
              }

              // 2. Fetch maps list
              const mapsRes = await fetch(`${BASE_URL}/worldconquest/maps`);
              let maps: string[] = [];
              if (mapsRes.ok) {
                maps = await mapsRes.json() as string[];
              }

              // 3. Query maps in parallel to sum VPs and casualties
              let wardenVP = 0;
              let colonialVP = 0;
              let scorchedVP = 0;
              let totalWardenCasualties = 0;
              let totalColonialCasualties = 0;

              // Process map queries in parallel
              const mapPromises = maps.map(async (mapName) => {
                try {
                  const dynamicPromise = fetch(`${BASE_URL}/worldconquest/maps/${mapName}/dynamic/public`)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null) as Promise<MapDynamicData | null>;

                  const reportPromise = fetch(`${BASE_URL}/worldconquest/warReport/${mapName}`)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null) as Promise<MapReportData | null>;

                  const [dynamicData, reportData] = await Promise.all([dynamicPromise, reportPromise]);

                  if (dynamicData && dynamicData.mapItems) {
                    for (const item of dynamicData.mapItems) {
                      const flags = item.flags || 0;
                      const isVictoryBase = (flags & 0x01) !== 0;
                      const isScorched = (flags & 0x10) !== 0;

                      if (isVictoryBase) {
                        if (isScorched) {
                          scorchedVP++;
                        } else {
                          if (item.teamId === 'WARDENS') {
                            wardenVP++;
                          } else if (item.teamId === 'COLONIALS') {
                            colonialVP++;
                          }
                        }
                      }
                    }
                  }

                  if (reportData) {
                    totalWardenCasualties += reportData.wardenCasualties || 0;
                    totalColonialCasualties += reportData.colonialCasualties || 0;
                  }
                } catch {
                  // silent fail for map
                }
              });

              await Promise.all(mapPromises);

              // 4. Calculations
              const elapsedMs = Date.now() - (warData.conquestStartTime || 0);
              const warDay = Math.floor(elapsedMs / (3600 * 1000)) + 1;
              const baseRequired = warData.requiredVictoryTowns || 32;
              const requiredVP = Math.max(1, baseRequired - scorchedVP);

              const responsePayload = {
                warNumber: warData.warNumber || 0,
                warDay,
                wardenVP,
                colonialVP,
                requiredVP,
                winner: warData.winner || 'NONE',
                conquestStartTime: warData.conquestStartTime || null,
                totalCasualties: {
                  warden: totalWardenCasualties,
                  colonial: totalColonialCasualties
                },
                isLive: true
              };

              cachedWarStatus = responsePayload;
              cacheTimestamp = Date.now();

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(responsePayload));
            } catch (error) {
              console.error('[Vite WarAPI Proxy] Error fetching live status:', error);
              const errorMessage = error instanceof Error ? error.message : String(error);
              const fallbackPayload = {
                warNumber: 114,
                warDay: 18,
                wardenVP: 14,
                colonialVP: 12,
                requiredVP: 32,
                winner: 'NONE',
                conquestStartTime: Date.now() - (18 * 60 * 60 * 1000),
                totalCasualties: {
                  warden: 145210,
                  colonial: 153092
                },
                isLive: true,
                isMock: true,
                error: errorMessage
              };
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(fallbackPayload));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
})
