import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, TrendingDown, Layers, 
    Package, Truck, Warehouse, Calendar, Info
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot, ItemInfo, SupplyRequest, AuditLogEntry } from '../types';
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

    if (depotList.length === 0) {
        return (
            <div className="panel-card anim-fade-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
                <Warehouse size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h2 style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
                    {language === 'tr' ? 'VERİTABANI BOŞ' : 'DATABASE EMPTY'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    {language === 'tr' 
                        ? 'Analitik verilerini görüntülemek için lütfen en az bir depo envanter CSV verisi içe aktarın.' 
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
    const selectedDepotCategoryCounts = {
        item: 0,
        crate: 0,
        vehicle: 0,
        structure: 0,
        crate_vehicle: 0
    };

    Object.values(targetDepot.current || {}).forEach(item => {
        selectedDepotTotalItems += item.count;
        if (selectedDepotCategoryCounts[item.category] !== undefined) {
            selectedDepotCategoryCounts[item.category] += item.count;
        } else {
            selectedDepotCategoryCounts.item += item.count;
        }
    });

    const grandTotal = Object.values(selectedDepotCategoryCounts).reduce((acc, c) => acc + c, 0) || 1;

    // 1. Consumption Velocity & Runway Forecasting
    const consumptionData = React.useMemo(() => {
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

        // Sort by shortest hoursRemaining first, then by highest consumption rate
        return list.sort((a, b) => {
            if (a.hoursRemaining !== b.hoursRemaining) {
                return a.hoursRemaining - b.hoursRemaining;
            }
            return b.rate - a.rate;
        });
    }, [targetDepot, rangeLimitMs, isWithinRange]);

    // 2. Production Requests Coverage
    const orderMatchDetails = React.useMemo(() => {
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
            }).filter(item => item.needed > 0); // only show pending items

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
        }).sort((a, b) => b.matchPct - a.matchPct); // sort by match percentage or created time
    }, [supplyRequests, selectedDepotName, depots, targetDepot]);

    const overallCoverageScore = React.useMemo(() => {
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

    // 3. Activity Heatmap
    const heatmapData = React.useMemo(() => {
        const grid = Array(7).fill(null).map(() => Array(24).fill(0));
        let maxCount = 0;

        auditLogs.forEach(log => {
            if (log.timestamp) {
                try {
                    const date = new Date(log.timestamp);
                    let day = date.getDay(); // 0 is Sunday, 1 is Monday...
                    day = day === 0 ? 6 : day - 1; // 0 is Monday, 6 is Sunday
                    const hour = date.getHours(); // 0 to 23

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
            case 'crate_vehicle': return '#a855f7'; // Purple
            case 'vehicle': return '#3b82f6'; // Blue
            case 'structure': return '#94a3b8'; // Grey
            case 'crate': return '#f59e0b'; // Amber
            default: return '#10b981'; // Green (item)
        }
    };

    const getCategoryLabel = (cat: string) => {
        if (language === 'tr') {
            switch (cat) {
                case 'crate_vehicle': return 'Kutu Araç';
                case 'vehicle': return 'Araç';
                case 'structure': return 'Yapı';
                case 'crate': return 'Kasa';
                default: return 'Tekil Malzeme';
            }
        } else {
            switch (cat) {
                case 'crate_vehicle': return 'Crate Vehicle';
                case 'vehicle': return 'Vehicle';
                case 'structure': return 'Structure';
                case 'crate': return 'Crate';
                default: return 'Single Item';
            }
        }
    };

    return (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>

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
                    <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                        <Truck size={20} style={{ color: '#a855f7' }} />
                    </div>
                    <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em', display: 'block' }}>
                            {language === 'tr' ? 'KUTU ARAÇLAR' : 'CRATE VEHICLES'}
                        </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                            {selectedDepotCategoryCounts.crate_vehicle.toLocaleString()}
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
                                        width: '450px',
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
                                            ? 'Her aktif lojistik siparişi için hedef stok seviyesi (Mevcut Stok + Kalan İhtiyaç) belirlenir. Eşleşme skoru, mevcut stoğun bu hedef stok seviyesine oranı (Mevcut Stok / Hedef Stok Seviyesi) olarak hesaplanır.' 
                                            : 'For each active production order, a target stock level is determined (Current Stock + Remaining Need). The coverage score represents the ratio of current stock to this target level (Current Stock / Target Stock Level).'}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-color)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                            {language === 'tr' ? 'Genel Eşleşme Skoru: ' : 'Overall Match Score: '}{overallCoverageScore}%
                        </div>
                    </div>

                    {orderMatchDetails.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {language === 'tr' ? 'Aktif lojistik talebi/siparişi bulunmuyor.' : 'No active production orders found.'}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {orderMatchDetails.map(order => {
                                const borderClass = order.matchPct === 100 ? '1px solid rgba(16, 185, 129, 0.25)' : order.matchPct >= 50 ? '1px solid rgba(249, 115, 22, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)';
                                const bgClass = order.matchPct === 100 ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255, 255, 255, 0.01)';
                                return (
                                    <div key={order.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.85rem', background: bgClass, borderRadius: '8px', border: borderClass }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                                                    {language === 'tr' ? 'Talep ID: ' : 'Request ID: '}#{order.id.slice(0, 8)}
                                                </span>
                                                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                                                    {getRelativeTimeString(order.createdTime, language)}
                                                    {selectedDepotName === 'all' && ` - ${order.depotCustomName}`}
                                                </span>
                                            </div>
                                            <span style={{ 
                                                fontSize: '0.68rem', 
                                                fontWeight: 800, 
                                                padding: '0.15rem 0.4rem', 
                                                borderRadius: '4px', 
                                                background: order.matchPct === 100 ? 'rgba(16, 185, 129, 0.15)' : order.matchPct >= 50 ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: order.matchPct === 100 ? '#10b981' : order.matchPct >= 50 ? 'var(--accent-color)' : '#ef4444',
                                                border: order.matchPct === 100 ? '1px solid rgba(16, 185, 129, 0.25)' : order.matchPct >= 50 ? '1px solid rgba(249, 115, 22, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'
                                            }}>
                                                {order.matchPct}% {language === 'tr' ? 'Eşleşme' : 'Match'}
                                            </span>
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
                                                        title={tooltip} 
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

        </div>
    );
});

AnalyticsTab.displayName = 'AnalyticsTab';
