import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, Layers, 
    Package, Truck, Warehouse, Calendar, Info,
    AlertTriangle, CheckCircle2, BarChart3
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot, SupplyRequest, AuditLogEntry, ItemInfo } from '../types';
import { getRelativeTimeString } from '../utils/helpers';

interface AnalyticsTabProps {
    depots?: Record<string, Depot>;
    activeDepotName: string | null;
    theme?: 'dark' | 'light';
    supplyRequests?: SupplyRequest[];
    auditLogs?: AuditLogEntry[];
    timeRange?: '1d' | '7d' | '30d';
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = React.memo(({ 
    depots = {}, 
    activeDepotName,
    supplyRequests = [],
    auditLogs = [],
    timeRange = '7d'
}) => {
    const { language } = useLanguage();

    const depotList = Object.values(depots);

    // Selected Depot and Info State
    const selectedDepotName = activeDepotName || 'all';
    
    const [showVelocityInfo, setShowVelocityInfo] = useState(false);
    const [showRunwayInfo, setShowRunwayInfo] = useState(false);
    const [showCoverageInfo, setShowCoverageInfo] = useState(false);
    const [showHeatmapInfo, setShowHeatmapInfo] = useState(false);
    const [tooltipState, setTooltipState] = useState<{ visible: boolean; content: string; x: number; y: number }>({ visible: false, content: '', x: 0, y: 0 });

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowVelocityInfo(false);
                setShowRunwayInfo(false);
                setShowCoverageInfo(false);
                setShowHeatmapInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => {
            document.removeEventListener('click', handleOutsideClick);
        };
    }, []);

    // Localized dictionary for the header and bottleneck section
    const t = (key: string): string => {
        const translations: Record<string, Record<string, string>> = {
            tr: {
                analytics_title: 'LOJİSTİK ANALİTİK VE TAKTİK RAPORU',
                bottlenecks: 'TAKTİKSEL DARBOĞAZ VE HIZLI SEVKİYAT ALARMLARI',
                no_bottlenecks: 'Aktif bir lojistik darboğazı tespit edilmedi. Harika iş!',
                stock_level: 'Mevcut Stok',
                critical_limit: 'Kritik Eşik',
                active_requests: 'Bekleyen Talep',
                item: 'Eşya',
                crate: 'Kasa',
                vehicle: 'Araç',
                crate_vehicle: 'Kutulu Araç',
                structure: 'Yapı'
            },
            en: {
                analytics_title: 'LOGISTICS ANALYTICS & TACTICAL REPORT',
                bottlenecks: 'TACTICAL BOTTLENECK & URGENT DISPATCH ALERTS',
                no_bottlenecks: 'No active logistical bottlenecks detected. Excellent job!',
                stock_level: 'Stock Level',
                critical_limit: 'Critical Limit',
                active_requests: 'Pending Request',
                item: 'Item',
                crate: 'Crate',
                vehicle: 'Vehicle',
                crate_vehicle: 'Crate Vehicle',
                structure: 'Structure'
            },
            pt: {
                analytics_title: 'RELATÓRIO OPERACIONAL E TÁCTICO',
                bottlenecks: 'ALERTAS TÁCTICOS DE GARGALOS',
                no_bottlenecks: 'Nenhum gargalo logístico ativo detectado. Excelente trabalho!',
                stock_level: 'Nível de Estoque',
                critical_limit: 'Limite Crítico',
                active_requests: 'Pedidos Pendentes',
                item: 'Item',
                crate: 'Caixa',
                vehicle: 'Veículo',
                crate_vehicle: 'Veículo de Caixa',
                structure: 'Estrutura'
            },
            ru: {
                analytics_title: 'ОПЕРАТИВНО-ТАКТИЧЕСКИЙ ОТЧЕТ',
                bottlenecks: 'ТАКТИЧЕСКИЕ ПРЕДУПРЕЖДЕНИЯ О ДЕФИЦИТЕ',
                no_bottlenecks: 'Активных логистических дефицитов не обнаружено. Отличная работа!',
                stock_level: 'Уровень запасов',
                critical_limit: 'Критический лимит',
                active_requests: 'Ожидает доставки',
                item: 'Предмет',
                crate: 'Ящик',
                vehicle: 'Техника',
                crate_vehicle: 'Техника в ящике',
                structure: 'Постройка'
            },
            de: {
                analytics_title: 'LOGISTIK-ANALYSE & TAKTISCHER BERICHT',
                bottlenecks: 'ENGPÄSSE & DRINGLICHE VERSANDALARME',
                no_bottlenecks: 'Keine aktiven Engpässe festgestellt. Gute Arbeit!',
                stock_level: 'Lagerbestand',
                critical_limit: 'Kritische Grenze',
                active_requests: 'Offene Anfragen',
                item: 'Gegenstand',
                crate: 'Kiste',
                vehicle: 'Fahrzeug',
                crate_vehicle: 'Kisten-Fahrzeug',
                structure: 'Struktur'
            }
        };
        const lang = translations[language] ? language : 'en';
        return translations[lang][key] || translations['en'][key] || key;
    };

    if (depotList.length === 0) {
        return (
            <div className="panel-card anim-fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                <Warehouse size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h2 style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    {language === 'tr' ? 'VERİTABANI BOŞ' : 'DATABASE EMPTY'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    {language === 'tr' 
                        ? 'Analitik verilerini görüntülemek için lütfen enaz bir depo envanter CSV verisi içe aktarın.' 
                        : 'Please import at least one depot inventory CSV file to view analytics metrics.'}
                </p>
            </div>
        );
    }

    // Selected Depot (resolved with All Depots aggregation support)
    const targetDepot = React.useMemo<Depot>(() => {
        if (selectedDepotName === 'all') {
            const mergedCurrent: Record<string, ItemInfo> = {};
            const mergedPrevious: Record<string, ItemInfo> = {};
            let latestUpdated = '';

            depotList.forEach(dep => {
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
                customName: language === 'tr' ? 'Tüm Depolar' : 'All Depots',
                lastUpdated: latestUpdated || new Date().toISOString(),
                current: mergedCurrent,
                previous: Object.keys(mergedPrevious).length > 0 ? mergedPrevious : null
            };
        }

        return depots[selectedDepotName] || depotList[0];
    }, [selectedDepotName, depots, depotList, language]);

    // Check if the update falls within the selected time range
    const lastUpdatedDate = new Date(targetDepot.lastUpdated);
    const now = new Date();
    const timeDiffMs = now.getTime() - lastUpdatedDate.getTime();

    let rangeLimitMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
    if (timeRange === '1d') rangeLimitMs = 24 * 60 * 60 * 1000;
    else if (timeRange === '30d') rangeLimitMs = 30 * 24 * 60 * 60 * 1000;

    const isWithinRange = timeDiffMs <= rangeLimitMs;

    // Calculate changes
    const increasedItems: { name: string; diff: number; category: string }[] = [];
    const decreasedItems: { name: string; diff: number; category: string }[] = [];

    let totalAdded = 0;
    let totalConsumed = 0;

    const hasPreviousData = !!targetDepot.previous;

    if (targetDepot && hasPreviousData && isWithinRange) {
        const currentItems = targetDepot.current || {};
        const previousItems = targetDepot.previous || {};
        const allKeys = new Set([...Object.keys(currentItems), ...Object.keys(previousItems)]);

        allKeys.forEach(name => {
            const curVal = currentItems[name]?.count || 0;
            const prevVal = previousItems[name]?.count || 0;
            const diff = curVal - prevVal;

            if (diff > 0) {
                increasedItems.push({ name, diff, category: currentItems[name]?.category || 'item' });
                totalAdded += diff;
            } else if (diff < 0) {
                decreasedItems.push({ name, diff: Math.abs(diff), category: previousItems[name]?.category || 'item' });
                totalConsumed += Math.abs(diff);
            }
        });
    }

    // Sort descending
    increasedItems.sort((a, b) => b.diff - a.diff);
    decreasedItems.sort((a, b) => b.diff - a.diff);

    const topIncreased = increasedItems.slice(0, 5);
    const topDecreased = decreasedItems.slice(0, 5);

    const maxInc = topIncreased.length > 0 ? topIncreased[0].diff : 1;
    const maxDec = topDecreased.length > 0 ? topDecreased[0].diff : 1;

    // Selected Depot Overview details
    let selectedDepotTotalItems = 0;
    const selectedDepotCategoryCounts: Record<string, number> = {
        crate: 0,
        vehicle: 0,
        structure: 0
    };

    Object.values(targetDepot.current || {}).forEach(item => {
        selectedDepotTotalItems += item.count;
        if (item.category === 'crate' || item.category === 'crate_vehicle' || item.category === 'item') {
            selectedDepotCategoryCounts.crate += item.count;
        } else if (item.category === 'vehicle') {
            selectedDepotCategoryCounts.vehicle += item.count;
        } else if (item.category === 'structure') {
            selectedDepotCategoryCounts.structure += item.count;
        }
    });

    const crateVehiclesCount = useMemo(() => {
        return Object.values(targetDepot.current || {}).reduce((acc, item) => {
            return item.category === 'crate_vehicle' ? acc + item.count : acc;
        }, 0);
    }, [targetDepot]);

    const grandTotal = Object.values(selectedDepotCategoryCounts).reduce((acc, c) => acc + c, 0) || 1;

    // 1. Consumption Velocity & Runway Forecasting
    const consumptionData = useMemo(() => {
        if (!targetDepot || !targetDepot.previous || !isWithinRange) return [];

        const current = targetDepot.current || {};
        const previous = targetDepot.previous || {};
        const hours = rangeLimitMs / (60 * 60 * 1000);

        const list: { name: string; category: string; currentQty: number; consumed: number; rate: number; hoursRemaining: number }[] = [];

        Object.entries(previous).forEach(([name, prevInfo]) => {
            const currInfo = current[name];
            const currQty = currInfo ? currInfo.count : 0;
            const consumed = prevInfo.count - currQty;

            if (consumed > 0) {
                const rate = consumed / hours;
                const hoursRemaining = rate > 0 ? currQty / rate : Infinity;
                list.push({
                    name,
                    category: prevInfo.category,
                    currentQty: currQty,
                    consumed,
                    rate,
                    hoursRemaining
                });
            }
        });

        return list.sort((a, b) => {
            if (a.hoursRemaining !== b.hoursRemaining) {
                return a.hoursRemaining - b.hoursRemaining;
            }
            return b.rate - a.rate;
        });
    }, [targetDepot, rangeLimitMs, isWithinRange]);

    // 2. Bottleneck Alerts Calculation
    const bottleneckAlerts = useMemo(() => {
        const alerts: {
            itemName: string;
            category: string;
            stock: number;
            limit: number;
            reasons: string[];
            recommendations: string[];
            depotName: string;
            depotCustomName: string;
        }[] = [];

        const targetDepotList = selectedDepotName === 'all' 
            ? Object.values(depots) 
            : [depots[selectedDepotName]].filter(Boolean) as Depot[];

        const getThreshold = (name: string, cat: string): number => {
            const lower = name.toLowerCase();
            if (cat === 'vehicle' || cat === 'crate_vehicle') return 10;
            if (cat === 'crate') return 30;
            if (lower.includes('material') || lower.includes('alloy') || lower.includes('supply')) return 250;
            return 50;
        };

        targetDepotList.forEach(dep => {
            const currentItems = dep.current || {};
            const previousItems = dep.previous || {};
            const hours = rangeLimitMs / (60 * 60 * 1000);
            
            const depotAlertsMap = new Map<string, {
                itemName: string;
                category: string;
                stock: number;
                limit: number;
                reasons: string[];
                recommendations: string[];
                depotName: string;
                depotCustomName: string;
            }>();

            // A. Runway Depletion Warning for this specific depot
            Object.entries(currentItems).forEach(([itemName, itemInfo]) => {
                const prevInfo = previousItems[itemName];
                if (prevInfo) {
                    const consumed = prevInfo.count - itemInfo.count;
                    if (consumed > 0) {
                        const rate = consumed / hours;
                        if (rate > 0) {
                            const hoursRemaining = itemInfo.count / rate;
                            if (hoursRemaining < 24) {
                                const remHours = Math.round(hoursRemaining % 24);
                                const timeText = language === 'tr'
                                    ? (hoursRemaining === 0 ? 'Tükendi' : `${remHours} saat içinde tükenecek`)
                                    : (hoursRemaining === 0 ? 'Depleted' : `depleting in ${remHours}h`);
                                
                                const alert = depotAlertsMap.get(itemName) || {
                                    itemName,
                                    category: itemInfo.category,
                                    stock: itemInfo.count,
                                    limit: 0,
                                    reasons: [],
                                    recommendations: [],
                                    depotName: dep.name,
                                    depotCustomName: dep.customName || dep.name
                                };
                                alert.reasons.push(language === 'tr' 
                                    ? `Yüksek tüketim hızı (${timeText})` 
                                    : `High consumption rate (${timeText})`);
                                depotAlertsMap.set(itemName, alert);
                            }
                        }
                    }
                }
            });

            // B. Open Orders Deficit & Safety Threshold for this specific depot
            const depotRequests = supplyRequests.filter(req => req.status === 'open' && req.depotName === dep.name);
            
            const requestDeficits: Record<string, { needed: number; category: string }> = {};
            depotRequests.forEach(req => {
                req.items.forEach(item => {
                    const remaining = item.quantityRequired - item.quantityDelivered;
                    if (remaining > 0) {
                        if (!requestDeficits[item.itemName]) {
                            requestDeficits[item.itemName] = { needed: 0, category: item.itemCategory };
                        }
                        requestDeficits[item.itemName].needed += remaining;
                    }
                });
            });

            Object.entries(requestDeficits).forEach(([itemName, reqInfo]) => {
                const itemStock = currentItems[itemName]?.count || 0;
                const limit = getThreshold(itemName, reqInfo.category);
                
                if (itemStock < reqInfo.needed || itemStock < limit) {
                    const alert = depotAlertsMap.get(itemName) || {
                        itemName,
                        category: reqInfo.category,
                        stock: itemStock,
                        limit: limit,
                        reasons: [],
                        recommendations: [],
                        depotName: dep.name,
                        depotCustomName: dep.customName || dep.name
                    };

                    alert.limit = Math.max(alert.limit, limit);

                    if (itemStock < reqInfo.needed) {
                        const diff = reqInfo.needed - itemStock;
                        alert.reasons.push(language === 'tr'
                            ? `Açık talep eksiği var (${diff} adet eksik)`
                            : `Pending request deficit (missing ${diff} units)`);
                    }
                    if (itemStock < limit) {
                        alert.reasons.push(language === 'tr'
                            ? `Güvenlik stoğu altında (Mevcut: ${itemStock} / Eşik: ${limit})`
                            : `Below safety limit (Current: ${itemStock} / Limit: ${limit})`);
                    }

                    depotAlertsMap.set(itemName, alert);
                }
            });

            // C. Generate Transfer Recommendations from other depots
            depotAlertsMap.forEach((alert, itemName) => {
                const sources: { depotCustomName: string; stock: number }[] = [];
                Object.entries(depots).forEach(([otherDepName, otherDep]) => {
                    if (otherDepName !== dep.name && otherDep.current?.[itemName]) {
                        const otherStock = otherDep.current[itemName].count;
                        const otherLimit = getThreshold(itemName, otherDep.current[itemName].category);
                        if (otherStock > otherLimit) {
                            sources.push({
                                depotCustomName: otherDep.customName || otherDepName,
                                stock: otherStock
                            });
                        }
                    }
                });

                if (sources.length > 0) {
                    sources.sort((a, b) => b.stock - a.stock);
                    const bestSource = sources[0];
                    alert.recommendations.push(language === 'tr'
                        ? `${bestSource.depotCustomName} deposundan transfer yapın (${bestSource.stock} adet mevcut)`
                        : `Transfer from ${bestSource.depotCustomName} (${bestSource.stock} units available)`);
                } else {
                    alert.recommendations.push(language === 'tr'
                        ? 'Yeni bir üretim siparişi (Production Order) oluşturun'
                        : 'Create a new production order');
                }
            });

            depotAlertsMap.forEach(alert => alerts.push(alert));
        });

        return alerts;
    }, [depots, supplyRequests, selectedDepotName, rangeLimitMs, language]);

    // 3. Production Requests Coverage
    const orderMatchDetails = useMemo(() => {
        const filtered = supplyRequests.filter(req => req.status === 'open' && (selectedDepotName === 'all' || req.depotName === selectedDepotName));
        
        return filtered.map(req => {
            const depotForStock = depots[req.depotName] || targetDepot;
            const itemsProgress = req.items.map(item => {
                const needed = Math.max(0, item.quantityRequired - item.quantityDelivered);
                const stock = depotForStock.current?.[item.itemName]?.count || 0;
                const targetLevel = stock + needed;
                const matchPct = targetLevel > 0 ? Math.min(100, Math.round((stock / targetLevel) * 100)) : 100;
                return {
                    itemName: item.itemName,
                    needed,
                    stock,
                    targetLevel,
                    matchPct,
                    category: item.itemCategory
                };
            }).filter(item => item.needed > 0);

            let totalTargetLevel = 0;
            let totalStock = 0;
            itemsProgress.forEach(it => {
                totalTargetLevel += it.targetLevel;
                totalStock += it.stock;
            });

            const matchPct = totalTargetLevel > 0 ? Math.round((totalStock / totalTargetLevel) * 100) : 100;

            return {
                id: req.id,
                depotName: req.depotName,
                depotCustomName: depots[req.depotName]?.customName || req.depotName,
                createdTime: req.createdTime,
                items: itemsProgress,
                matchPct
            };
        }).sort((a, b) => b.matchPct - a.matchPct);
    }, [supplyRequests, selectedDepotName, depots, targetDepot]);

    const overallCoverageScore = useMemo(() => {
        let totalTargetLevel = 0;
        let totalStock = 0;
        orderMatchDetails.forEach(order => {
            order.items.forEach(it => {
                totalTargetLevel += it.targetLevel;
                totalStock += it.stock;
            });
        });
        return totalTargetLevel > 0 ? Math.round((totalStock / totalTargetLevel) * 100) : 100;
    }, [orderMatchDetails]);

    // 4. Activity Heatmap
    const heatmapData = useMemo(() => {
        const grid = Array(7).fill(null).map(() => Array(24).fill(0));
        let maxCount = 0;

        auditLogs.forEach(log => {
            if (log.timestamp) {
                try {
                    const date = new Date(log.timestamp);
                    let day = date.getDay();
                    day = day === 0 ? 6 : day - 1;
                    const hour = date.getHours();

                    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
                        grid[day][hour]++;
                        if (grid[day][hour] > maxCount) {
                            maxCount = grid[day][hour];
                        }
                    }
                } catch (e) {
                    // skip
                }
            }
        });

        return { grid, maxCount };
    }, [auditLogs]);

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'vehicle': return '#3b82f6';
            case 'structure': return '#94a3b8';
            case 'crate': return '#f59e0b';
            default: return '#10b981';
        }
    };

    const getCategoryLabel = (cat: string) => {
        if (cat === 'crate') return language === 'tr' ? 'Kutular (Crates)' : 'Crates';
        return t(cat);
    };

    return (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
            
            {/* Header with Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                <BarChart3 size={20} style={{ color: 'var(--accent-color)' }} />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                    {t('analytics_title')}
                </h2>
            </div>

            {/* Tactical Bottlenecks Alarm Panel */}
            {bottleneckAlerts.length === 0 ? (
                <div className="panel-card" style={{ padding: '1.25rem', borderLeft: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                        <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', color: '#10b981' }}>
                            {t('bottlenecks')}
                        </h3>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {t('no_bottlenecks')}
                    </div>
                </div>
            ) : (
                <div className="panel-card" style={{ padding: '1.25rem', borderLeft: '3px solid var(--color-negative, #ef4444)', background: 'rgba(239, 68, 68, 0.01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                        <AlertTriangle size={18} style={{ color: 'var(--color-negative, #ef4444)' }} />
                        <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
                            {t('bottlenecks')}
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
                        {bottleneckAlerts.map(alert => (
                            <div 
                                key={`${alert.depotName}-${alert.itemName}`} 
                                style={{ 
                                    background: 'rgba(239, 68, 68, 0.03)', 
                                    border: '1px solid rgba(239, 68, 68, 0.12)', 
                                    borderRadius: '8px', 
                                    padding: '0.75rem', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.5rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                                        {selectedDepotName === 'all' ? `[${alert.depotCustomName}] ${alert.itemName}` : alert.itemName}
                                    </span>
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {alert.category.toUpperCase()}
                                    </span>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                    {alert.reasons.map((reason, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                                            <span>{reason}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.45rem', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.68rem' }}>
                                    {alert.recommendations.map((rec, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                                            <Info size={12} style={{ flexShrink: 0 }} />
                                            <span>{rec}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* General Metrics Row for Selected Depot */}
            <div className="analytics-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Package size={20} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DEPO TOPLAM STOK' : 'DEPOT TOTAL STOCK'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {selectedDepotTotalItems.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(232, 121, 249, 0.1)', border: '1px solid rgba(232, 121, 249, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={20} style={{ color: '#e879f9' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'KUTU ARAÇLAR' : 'CRATE VEHICLES'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {crateVehiclesCount.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <TrendingUp size={20} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DÖNEM İÇİ ÜRETİM' : 'PRODUCTION IN RANGE'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-heading)' }}>
                            +{totalAdded.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="metric-card" style={{ background: 'var(--bg-card, rgba(255, 255, 255, 0.02))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <TrendingDown size={20} style={{ color: '#ef4444' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'DÖNEM İÇİ TÜKETİM' : 'CONSUMPTION IN RANGE'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-heading)' }}>
                            -{totalConsumed.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Graphs Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                
                {/* Top Increased Items */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <TrendingUp size={16} style={{ color: '#10b981' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'EN ÇOK ARTAN MALZEMELER' : 'TOP INCREASED ITEMS'}
                        </h3>
                    </div>
                    
                    {!hasPreviousData ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Karşılaştırılacak önceki tarama verisi bulunamadı.' : 'No previous scan data found to compare changes.'}
                        </div>
                    ) : !isWithinRange ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Calendar size={18} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', margin: '0 auto' }} />
                            {language === 'tr' 
                                ? `Son güncelleme (${new Date(targetDepot.lastUpdated).toLocaleDateString()}) seçilen zaman aralığının dışında.` 
                                : `Last update (${new Date(targetDepot.lastUpdated).toLocaleDateString()}) is outside the selected range.`}
                        </div>
                    ) : topIncreased.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Bu zaman aralığında artış gösteren malzeme bulunmamaktadır.' : 'No items increased within this range.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {topIncreased.map(item => {
                                const pct = Math.round((item.diff / maxInc) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#10b981', fontWeight: 700 }}>+{item.diff.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Top Decreased Items */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <TrendingDown size={16} style={{ color: '#ef4444' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'EN ÇOK AZALAN MALZEMELER' : 'TOP DECREASED ITEMS'}
                        </h3>
                    </div>

                    {!hasPreviousData ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Karşılaştırılacak önceki tarama verisi bulunamadı.' : 'No previous scan data found to compare changes.'}
                        </div>
                    ) : !isWithinRange ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <Calendar size={18} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block', margin: '0 auto' }} />
                            {language === 'tr' 
                                ? `Son güncelleme (${new Date(targetDepot.lastUpdated).toLocaleDateString()}) seçilen zaman aralığının dışında.` 
                                : `Last update (${new Date(targetDepot.lastUpdated).toLocaleDateString()}) is outside the selected range.`}
                        </div>
                    ) : topDecreased.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {language === 'tr' ? 'Bu zaman aralığında azalış gösteren malzeme bulunmamaktadır.' : 'No items decreased within this range.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {topDecreased.map(item => {
                                const pct = Math.round((item.diff / maxDec) * 100);
                                return (
                                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ color: '#ef4444', fontWeight: 700 }}>-{item.diff.toLocaleString()}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Category Inventory Breakdown for Selected Depot */}
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <Layers size={16} style={{ color: 'var(--accent-color)' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'KATEGORİ DAĞILIMI' : 'CATEGORY DISTRIBUTION'}
                        </h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {Object.entries(selectedDepotCategoryCounts).map(([cat, val]) => {
                            const pct = Math.round((val / grandTotal) * 100);
                            const color = getCategoryColor(cat);
                            return (
                                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{getCategoryLabel(cat)}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{pct}% ({val.toLocaleString()})</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Section: Consumption Rates & Supply Runway */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingDown size={16} style={{ color: 'var(--accent-color)' }} />
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'TÜKETİM HIZI ANALİZİ' : 'CONSUMPTION VELOCITY ANALYSIS'}
                            </h3>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={() => setShowVelocityInfo(!showVelocityInfo)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showVelocityInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                                title={language === 'tr' ? 'Nasıl Hesaplanır?' : 'How is it calculated?'}
                            >
                                <Info size={14} />
                            </button>
                            {showVelocityInfo && (
                                <div className="popover-card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 100,
                                    width: '280px',
                                    background: 'rgba(20, 20, 23, 0.95)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '0.75rem',
                                    marginTop: '0.35rem',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.4',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3)'
                                }}>
                                    {language === 'tr' 
                                        ? 'Önceki tarama verisi ile mevcut stok seviyeleri karşılaştırılarak, tüketilen malzemelerin seçilen zaman dilimine bölünmesiyle saatlik ve günlük tüketim hızları hesaplanır.' 
                                        : 'Calculates hourly and daily consumption rates by comparing current stock levels with previous scan data and dividing the difference by the selected time range.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {consumptionData.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' ? 'Seçilen dönemde tüketilen malzeme bulunmuyor.' : 'No consumed items recorded in this range.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {consumptionData.slice(0, 10).map(item => {
                                const rateString = item.rate >= 1 
                                    ? `${Math.round(item.rate)}/saat` 
                                    : `${(item.rate * 24).toFixed(1)}/gün`;
                                const rateStringEn = item.rate >= 1 
                                    ? `${Math.round(item.rate)}/hr` 
                                    : `${(item.rate * 24).toFixed(1)}/day`;

                                return (
                                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.4rem 0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                {language === 'tr' ? 'Toplam Tüketilen: ' : 'Total Consumed: '}{item.consumed.toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ color: '#ef4444', fontWeight: 700 }}>
                                                {language === 'tr' ? rateString : rateStringEn}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="panel-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} style={{ color: 'var(--accent-color)' }} />
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'STOK DAYANMA SÜRESİ TAHMİNİ' : 'SUPPLY RUNWAY FORECAST'}
                            </h3>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={() => setShowRunwayInfo(!showRunwayInfo)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showRunwayInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                                title={language === 'tr' ? 'Nasıl Hesaplanır?' : 'How is it calculated?'}
                            >
                                <Info size={14} />
                            </button>
                            {showRunwayInfo && (
                                <div className="popover-card" style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    zIndex: 100,
                                    width: '280px',
                                    background: 'rgba(20, 20, 23, 0.95)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '0.75rem',
                                    marginTop: '0.35rem',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: '1.4',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3)'
                                }}>
                                    {language === 'tr' 
                                        ? 'Mevcut stok seviyesinin, hesaplanan tüketim hızına bölünmesiyle stokların tamamen tükenmesine kalan tahmini süre hesaplanır.' 
                                        : 'Forecasts the remaining time until stock depletion by dividing current inventory quantities by their calculated consumption rates.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {consumptionData.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' ? 'Tüketim verisi olmadığı için tahmin oluşturulamadı.' : 'No consumption data to compile forecast.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {consumptionData.slice(0, 10).map(item => {
                                const hours = item.hoursRemaining;
                                let timeText = '';
                                let isCritical = false;

                                if (hours === Infinity || hours > 1000) {
                                    timeText = language === 'tr' ? '30+ Gün' : '30+ Days';
                                } else {
                                    const days = Math.floor(hours / 24);
                                    const remHours = Math.round(hours % 24);
                                    if (days > 0) {
                                        timeText = language === 'tr' 
                                            ? `${days} Gün ${remHours} Saat` 
                                            : `${days}d ${remHours}h`;
                                    } else {
                                        timeText = language === 'tr' 
                                            ? `${remHours} Saat` 
                                            : `${remHours}h`;
                                        isCritical = true;
                                    }
                                }

                                return (
                                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.4rem 0.5rem', background: isCritical ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255,255,255,0.01)', borderRadius: '4px', border: isCritical ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(255, 255, 255, 0.02)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }} title={item.name}>
                                                {item.name}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                {language === 'tr' ? 'Mevcut Stok: ' : 'Current Stock: '}{item.currentQty.toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ color: isCritical ? '#ef4444' : 'var(--text-primary)', fontWeight: 700 }}>
                                                {timeText}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Section: Request Coverage */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                <div className="panel-card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <TrendingUp size={16} style={{ color: 'var(--accent-color)' }} />
                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                                {language === 'tr' ? 'LOJİSTİK İSTEK EŞLEŞME ORANLARI' : 'PRODUCTION REQUESTS COVERAGE'}
                            </h3>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="popover-trigger"
                                    onClick={() => setShowCoverageInfo(!showCoverageInfo)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: showCoverageInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.15s'
                                    }}
                                    title={language === 'tr' ? 'Nasıl Hesaplanır?' : 'How is it calculated?'}
                                >
                                    <Info size={14} />
                                </button>
                                {showCoverageInfo && (
                                    <div className="popover-card" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        zIndex: 100,
                                        width: '280px',
                                        background: 'rgba(20, 20, 23, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '0.75rem',
                                        marginTop: '0.35rem',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.4',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3)'
                                    }}>
                                        {language === 'tr' 
                                            ? 'Bekleyen lojistik taleplerdeki malzeme ihtiyaçları ile depoların mevcut stokları eşleştirilerek, taleplerin depodaki stoklarca karşılanabilme oranları hesaplanır.' 
                                            : 'Compares pending logistic request quantities with current depot stocks to calculate the percentage of demand that can be covered by available inventory.'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            <span>{language === 'tr' ? 'GENEL EŞLEŞME:' : 'OVERALL SATURATION:'}</span>
                            <strong style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>{overallCoverageScore}%</strong>
                        </div>
                    </div>

                    {orderMatchDetails.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' ? 'Bekleyen lojistik istek bulunmuyor.' : 'No pending supply requests found.'}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {orderMatchDetails.map(order => {
                                return (
                                    <div key={order.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.65rem', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {order.depotCustomName}
                                            </span>
                                            <span style={{ color: order.matchPct === 100 ? '#10b981' : 'var(--accent-color)', fontWeight: 700 }}>
                                                {order.matchPct}% {language === 'tr' ? 'Eşleşme' : 'Match'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                            {language === 'tr' ? 'Oluşturulma: ' : 'Created: '}{getRelativeTimeString(order.createdTime, language)}
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '0.45rem' }}>
                                            {order.items.map(item => {
                                                const isFullyMet = item.needed === 0;
                                                return (
                                                    <div key={item.itemName} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                                                            <span style={{ fontWeight: 500, color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }} title={item.itemName}>
                                                                {item.itemName}
                                                            </span>
                                                            <span style={{ color: isFullyMet ? '#10b981' : 'var(--text-primary)', fontWeight: 600 }}>
                                                                {item.stock.toLocaleString()} / {item.targetLevel.toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${item.matchPct}%`, height: '100%', background: isFullyMet ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, var(--accent-color), #ea580c)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                                                            </div>
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '24px', textAlign: 'right' }}>{item.matchPct}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Section: Activity Heatmap */}
            <div className="panel-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={16} style={{ color: 'var(--accent-color)' }} />
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            {language === 'tr' ? 'LOJİSTİK AKTİVİTE ISI HARİTASI' : 'LOGISTICAL ACTIVITY HEATMAP'}
                        </h3>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className="popover-trigger"
                            onClick={() => setShowHeatmapInfo(!showHeatmapInfo)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: showHeatmapInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s'
                            }}
                            title={language === 'tr' ? 'Nasıl Hesaplanır?' : 'How is it calculated?'}
                        >
                            <Info size={14} />
                        </button>
                        {showHeatmapInfo && (
                            <div className="popover-card" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                zIndex: 100,
                                width: '280px',
                                background: 'rgba(20, 20, 23, 0.95)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                marginTop: '0.35rem',
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)',
                                lineHeight: '1.4',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3)'
                            }}>
                                {language === 'tr' 
                                    ? 'Depo envanter güncellemeleri ve lojistik işlemlere ait sistem geçmişi loglarının haftanın günleri ve günün saatlerine göre dağılımı ile lojistik aktivite yoğunluğu görselleştirilir.' 
                                    : 'Visualizes chronological action density across days of the week and hours of the day using system audit trail log timestamps for updates and supply requests.'}
                            </div>
                        )}
                    </div>
                </div>

                {auditLogs.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Aktivite ısı haritası için veri bulunmuyor.' : 'No activity logs available to plot heatmap.'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        <div style={{ minWidth: '680px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {/* Hours Header Row */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '45px', flexShrink: 0 }} />
                                <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                    {Array(24).fill(0).map((_, i) => (
                                        <div key={i} style={{ width: '22px', textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            {i.toString().padStart(2, '0')}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Days Rows */}
                            {(() => {
                                const dayLabels = language === 'tr' 
                                    ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
                                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                                return heatmapData.grid.map((row, dayIdx) => (
                                    <div key={dayIdx} style={{ display: 'flex', alignItems: 'center' }}>
                                        <div style={{ width: '45px', fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, flexShrink: 0 }}>
                                            {dayLabels[dayIdx]}
                                        </div>
                                        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                                            {row.map((count, hourIdx) => {
                                                const alpha = heatmapData.maxCount > 0 ? (count / heatmapData.maxCount) : 0;
                                                const bg = count > 0 
                                                    ? `rgba(249, 115, 22, ${Math.max(0.12, alpha * 0.85)})` 
                                                    : 'rgba(255, 255, 255, 0.01)';
                                                const border = count > 0 
                                                    ? '1px solid rgba(249, 115, 22, 0.3)' 
                                                    : '1px solid rgba(255, 255, 255, 0.02)';
                                                const tooltip = language === 'tr'
                                                    ? `${dayLabels[dayIdx]} Saat ${hourIdx}:00 - ${count} İşlem`
                                                    : `${dayLabels[dayIdx]} at ${hourIdx}:00 - ${count} Actions`;

                                                return (
                                                    <div 
                                                        key={hourIdx} 
                                                        onMouseEnter={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setTooltipState({
                                                                visible: true,
                                                                content: tooltip,
                                                                x: rect.left + rect.width / 2,
                                                                y: rect.top - 8
                                                            });
                                                        }}
                                                        onMouseLeave={() => {
                                                            setTooltipState(prev => ({ ...prev, visible: false }));
                                                        }}
                                                        style={{ 
                                                            width: '22px', 
                                                            height: '22px', 
                                                            background: bg, 
                                                            border: border, 
                                                            borderRadius: '4px',
                                                            transition: 'all 0.15s',
                                                            cursor: count > 0 ? 'pointer' : 'default'
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Custom HTML Tooltip */}
            {tooltipState.visible && (
                <div 
                    style={{
                        position: 'fixed',
                        top: tooltipState.y,
                        left: tooltipState.x,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 99999,
                        background: 'rgba(15, 15, 20, 0.95)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.55rem',
                        fontSize: '0.68rem',
                        color: 'var(--text-primary)',
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                    }}
                >
                    {tooltipState.content}
                </div>
            )}

        </div>
    );
});

AnalyticsTab.displayName = 'AnalyticsTab';
