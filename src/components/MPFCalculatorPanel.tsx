import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Sparkles, Package, ChevronDown, Check, Info } from 'lucide-react';
import type { Depot, StockpileTemplates, RegionSettings } from '../types';
import { getMPFCosts } from '../utils/mpfData';
import { getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { normalizeItemKey, resolveTemplateSetting, getDepotRegion } from '../utils/helpers';
import { getDefaultTemplates } from '../utils/defaultTemplates';
import { getItemIconUrl, getCategoryIconUrl } from '../utils/itemIcons';
import { toCanonicalItemName } from '../utils/canonicalResolver';
import { useLanguage } from '../context/LanguageContext';

interface CompactItemSelectProps {
    candidateItems: {
        itemName: string;
        category: string;
        currentQty: number;
        targetMax: number;
        deficit: number;
        isPriority: boolean;
    }[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    labelText: string;
}

const CompactItemSelect: React.FC<CompactItemSelectProps> = ({ candidateItems, selectedIndex, onSelect, labelText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedItem = candidateItems[selectedIndex] || candidateItems[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!candidateItems || candidateItems.length <= 1) return null;

    const selectedIconUrl = getItemIconUrl(selectedItem.itemName);

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>{labelText}</span>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.18rem 0.5rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background 0.15s ease, transform 0.15s ease',
                    boxShadow: isOpen ? '0 0 10px rgba(16, 185, 129, 0.25)' : 'none'
                }}
            >
                {selectedIconUrl && (
                    <img src={selectedIconUrl} alt="" style={{ width: '15px', height: '15px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                )}
                <span style={{ whiteSpace: 'nowrap', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedItem.itemName}
                </span>
                {selectedItem.isPriority && (
                    <span style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', background: 'rgba(255, 122, 0, 0.2)', border: '1px solid rgba(255, 122, 0, 0.4)', borderRadius: '3px', color: '#ff7a00', fontWeight: 800 }}>
                        PRIO
                    </span>
                )}
                <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 }}>
                    Need: {(selectedItem.targetMax - selectedItem.currentQty).toLocaleString('en-US')}
                </span>
                <ChevronDown size={12} style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.3rem)',
                        right: 0,
                        zIndex: 99999,
                        minWidth: '280px',
                        maxWidth: '360px',
                        maxHeight: '210px',
                        overflowY: 'auto',
                        background: 'var(--bg-card)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.3rem',
                        boxShadow: '0 12px 28px rgba(0,0,0,0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.15rem'
                    }}
                >
                    {candidateItems.map((item, idx) => {
                        const iconUrl = getItemIconUrl(item.itemName);
                        const isSelected = idx === selectedIndex;
                        const needQty = Math.max(0, item.targetMax - item.currentQty);
                        return (
                            <div
                                key={item.itemName}
                                onClick={() => {
                                    onSelect(idx);
                                    setIsOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '5px',
                                    background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                    border: isSelected ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => {
                                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.06)';
                                }}
                                onMouseLeave={e => {
                                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                    {iconUrl && (
                                        <img src={iconUrl} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                                    )}
                                    <span style={{ fontSize: '0.72rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.itemName}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                    {item.isPriority && (
                                        <span style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', background: 'rgba(255, 122, 0, 0.2)', border: '1px solid rgba(255, 122, 0, 0.4)', borderRadius: '3px', color: '#ff7a00', fontWeight: 800 }}>
                                            PRIO
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700 }}>
                                        Need: {needQty.toLocaleString('en-US')}
                                    </span>
                                    {isSelected && <Check size={12} style={{ color: '#10b981' }} />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface MPFCalculatorPanelProps {
    depots: Record<string, Depot>;
    templates?: StockpileTemplates;
    regionSettings?: RegionSettings;
}

// 9-queue progressive MPF discount multipliers
const MPF_SLOT_MULTIPLIERS = [0.90, 0.80, 0.70, 0.60, 0.50, 0.50, 0.50, 0.50, 0.50];

export function getMPFDiscountFactor(queueSlots: number): number {
    const slots = Math.max(0, Math.min(9, queueSlots));
    let factor = 0;
    for (let i = 0; i < slots; i++) {
        factor += MPF_SLOT_MULTIPLIERS[i];
    }
    return factor;
}

interface MPFCategoryDef {
    key: OfficialCategory;
    label: string;
}

// Exclude 'medical' & 'utility' as they cannot be MPF produced in Foxhole
const MPF_CATEGORIES: MPFCategoryDef[] = [
    { key: 'small_arms', label: 'Small Arms' },
    { key: 'heavy_arms', label: 'Heavy Arms' },
    { key: 'heavy_ammunition', label: 'Heavy Ammunition' },
    { key: 'uniforms', label: 'Uniforms' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'shippables', label: 'Shippables' }
];

export const MPFCalculatorPanel: React.FC<MPFCalculatorPanelProps> = React.memo(({
    depots = {},
    templates,
    regionSettings = {}
}) => {
    const { language, t } = useLanguage();
    // Custom Queue counts per category item (item -> number 0..9)
    const [customQueues, setCustomQueues] = useState<Record<string, number>>({});
    // Custom selected item index per category when multiple items have deficits
    const [categorySelectedIndices, setCategorySelectedIndices] = useState<Record<string, number>>({});
    // Disabled (excluded) categories
    const [disabledCategories, setDisabledCategories] = useState<Record<string, boolean>>({});

    const effectiveTemplates = useMemo(() => {
        if (templates && Object.keys(templates).length > 0) return templates;
        return getDefaultTemplates();
    }, [templates]);

    // Calculate recommended MPF items per category
    const { categoryAllocations, totals } = useMemo(() => {
        const currentStockMap: Record<string, number> = {};
        Object.values(depots || {}).forEach(dep => {
            if (dep && dep.current) {
                Object.entries(dep.current).forEach(([itemName, itemInfo]) => {
                    if (itemInfo) {
                        const normKey = normalizeItemKey(itemName);
                        currentStockMap[normKey] = (currentStockMap[normKey] || 0) + (itemInfo.count || 0);
                    }
                });
            }
        });

        const templateItems = new Set<string>();
        Object.values(effectiveTemplates || {}).forEach(roleTmpl => {
            if (roleTmpl) {
                Object.keys(roleTmpl).forEach(itName => {
                    const rawName = itName.replace(/ \(Crate\)$/i, '').trim();
                    if (COLONIAL_NEUTRAL_ITEMS.has(rawName)) {
                        const crateName = itName.endsWith('(Crate)') ? itName : `${itName} (Crate)`;
                        templateItems.add(crateName);
                    }
                });
            }
        });

        const totalScaledMax: Record<string, number> = {};
        const isPriorityMap: Record<string, boolean> = {};

        const activeRegions = new Set<string>();
        Object.values(depots || {}).forEach(d => {
            if (d) {
                const reg = getDepotRegion(d);
                if (reg) activeRegions.add(reg);
            }
        });
        if (activeRegions.size === 0) activeRegions.add('Default');

        activeRegions.forEach(regionName => {
            const regionSetting = resolveTemplateSetting(regionName, null, null, regionSettings);
            const templateType = (regionSetting && regionSetting.templateType) ? regionSetting.templateType : 'backline';
            if (templateType === 'unassigned') return;
            
            const roleTemplate = (effectiveTemplates && effectiveTemplates[templateType]) || {};
            const demandPct = ((regionSetting && regionSetting.demandPercentage !== undefined) ? regionSetting.demandPercentage : 100) / 100;

            const canonicalRoleTemplate: Record<string, any> = {};
            Object.entries(roleTemplate || {}).forEach(([ruleItemName, rule]) => {
                if (rule) canonicalRoleTemplate[toCanonicalItemName(ruleItemName)] = rule;
            });

            templateItems.forEach(displayItemName => {
                const canonName = toCanonicalItemName(displayItemName);
                const normDisplayKey = normalizeItemKey(displayItemName);

                const rule = canonicalRoleTemplate[canonName];
                if (rule) {
                    const scaledMax = Math.round((rule.max || 0) * demandPct);
                    totalScaledMax[normDisplayKey] = (totalScaledMax[normDisplayKey] || 0) + scaledMax;
                    if (rule.isPriority) isPriorityMap[normDisplayKey] = true;
                }
            });
        });

        const recsByCategory: Record<string, {
            itemName: string;
            category: string;
            currentQty: number;
            targetMax: number;
            deficit: number;
            isPriority: boolean;
        }[]> = {};

        templateItems.forEach(displayItemName => {
            const rawName = displayItemName.replace(/ \(Crate\)$/i, '').trim();
            const normDisplayKey = normalizeItemKey(displayItemName);
            const normRawKey = normalizeItemKey(rawName);
            let cat = getItemOfficialCategory(displayItemName);
            if (cat === 'vehicle_crates') cat = 'vehicles';
            if (cat === 'shippable_crates') cat = 'shippables';

            // Skip medical, utility, and non-MPF items (Facility variants, Field structures, Warden bus, etc.)
            const lowerName = displayItemName.toLowerCase();
            if (
                cat === 'medical' ||
                lowerName.includes("auster") || lowerName.includes("lodesman") ||
                lowerName.includes("spatha") || lowerName.includes("ranseur") || lowerName.includes("talos") ||
                lowerName.includes("taurine") || lowerName.includes("stinger") || lowerName.includes("scrap hauler") ||
                lowerName.includes("harvester") || lowerName.includes("auto-crane") || lowerName.includes("tisiphone") ||
                lowerName.includes("alekto") || lowerName.includes("pegasus")
            ) return;

            const currentQty = (currentStockMap[normDisplayKey] || 0) + (normDisplayKey !== normRawKey ? (currentStockMap[normRawKey] || 0) : 0);
            const targetMax = totalScaledMax[normDisplayKey] || totalScaledMax[normRawKey] || 0;
            const isPriority = !!(isPriorityMap[normDisplayKey] || isPriorityMap[normRawKey]);

            if (targetMax <= 0) return;

            if (currentQty < targetMax || (isPriority && currentQty < targetMax * 1.2)) {
                const deficit = Math.max(0, targetMax - currentQty);

                if (!recsByCategory[cat]) recsByCategory[cat] = [];
                recsByCategory[cat].push({
                    itemName: displayItemName,
                    category: cat,
                    currentQty,
                    targetMax,
                    deficit,
                    isPriority
                });
            }
        });

        // Sort items in each category by Priority status then Deficit descending
        Object.keys(recsByCategory).forEach(cKey => {
            recsByCategory[cKey].sort((a, b) => {
                if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
                return b.deficit - a.deficit;
            });
        });

        // Build category allocations
        let totalBmats = 0;
        let totalRmats = 0;
        let totalEmats = 0;
        let totalHemats = 0;

        let totalBmatsCrates = 0;
        let totalRmatsCrates = 0;
        let totalEmatsCrates = 0;
        let totalHematsCrates = 0;

        const allocations = MPF_CATEGORIES.map(catDef => {
            const is5SlotCategory = catDef.key === 'vehicles' || catDef.key === 'shippables';
            const defaultSlots = is5SlotCategory ? 5 : 9;
            const maxSlots = defaultSlots;

            const candidateItems = recsByCategory[catDef.key] || [];
            if (candidateItems.length === 0) {
                return {
                    catDef,
                    candidateItems: [],
                    selectedIndex: 0,
                    topItem: null,
                    queueCount: defaultSlots,
                    maxSlots
                };
            }

            const selIdx = (categorySelectedIndices[catDef.key] || 0) % candidateItems.length;
            const topItem = candidateItems[selIdx];

            // Queue slots default to 5 for vehicles/shippables, 9 for others
            const rawQueueCount = customQueues[topItem.itemName] !== undefined ? customQueues[topItem.itemName] : defaultSlots;
            const queueCount = Math.min(maxSlots, Math.max(0, rawQueueCount));

            const isCategoryDisabled = !!disabledCategories[catDef.key];
            if (queueCount > 0 && !isCategoryDisabled) {
                const mpfInfo = getMPFCosts(topItem.itemName);
                const discountFactor = getMPFDiscountFactor(queueCount);

                const bmatsCost = Math.round(mpfInfo.costs.bmats * discountFactor);
                const rmatsCost = Math.round(mpfInfo.costs.rmats * discountFactor);
                const ematsCost = Math.round(mpfInfo.costs.emats * discountFactor);
                const hematsCost = Math.round(mpfInfo.costs.hemats * discountFactor);

                totalBmats += bmatsCost;
                totalRmats += rmatsCost;
                totalEmats += ematsCost;
                totalHemats += hematsCost;
            }

            return {
                catDef,
                candidateItems,
                selectedIndex: selIdx,
                topItem,
                queueCount,
                maxSlots,
                isDisabled: isCategoryDisabled
            };
        });

        // 100 bmats per crate, 20 rmats per crate, 40 emats per crate, 30 hemats per crate
        totalBmatsCrates = Math.ceil(totalBmats / 100);
        totalRmatsCrates = Math.ceil(totalRmats / 20);
        totalEmatsCrates = Math.ceil(totalEmats / 40);
        totalHematsCrates = Math.ceil(totalHemats / 30);

        return {
            categoryAllocations: allocations,
            totals: {
                bmats: totalBmats,
                rmats: totalRmats,
                emats: totalEmats,
                hemats: totalHemats,
                bmatsCrates: totalBmatsCrates,
                rmatsCrates: totalRmatsCrates,
                ematsCrates: totalEmatsCrates,
                hematsCrates: totalHematsCrates
            }
        };
    }, [depots, effectiveTemplates, regionSettings, customQueues, categorySelectedIndices, disabledCategories]);

    const handleSlotClick = (itemName: string, slotIndex: number, currentQueueCount: number) => {
        let newCount = slotIndex;
        if (currentQueueCount === slotIndex) {
            newCount = slotIndex - 1;
        }
        setCustomQueues(prev => ({
            ...prev,
            [itemName]: newCount
        }));
    };

    const toggleCategoryDisabled = (catKey: string) => {
        setDisabledCategories(prev => ({
            ...prev,
            [catKey]: !prev[catKey]
        }));
    };

    return (
        <div className="panel-card mpf-calculator-panel" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
        }}>
            {/* Header Title Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ padding: '0.45rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                            VELI AI MPF Recommendations
                        </h2>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {language === 'tr' ? '1 Kategori = 1 Önerilen Ürün (Maksimum 9 MPF Kuyruk Slotu)' : '1 Category = 1 Recommended Item (Max 9 MPF Queue Slots)'}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img src="/MapIconMassProductionFactory.png" alt="MPF Factory Icon" style={{ width: '32px', height: '32px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                </div>
            </div>

            {/* MPF Cost Warning Note */}
            <div className="anim-row-in" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.7rem 0.9rem',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
                lineHeight: '1.5'
            }}>
                <Info size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <span>{t('mpf_cost_warning')}</span>
            </div>

            {/* Equal Height/Width Summary Cards: Total Raw Material Costs & Total Crate Amounts */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1rem',
                alignItems: 'stretch'
            }}>
                {/* Card 1: Total Material Costs */}
                <div className="mpf-summary-card" style={{
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                        {language === 'tr' ? 'Toplam Hammadde Maliyeti' : 'Total Material Costs'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
                        {/* Bmats */}
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src={getItemIconUrl('Basic Materials') || undefined} alt="Bmats" style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bmats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fbbf24' }}>{totals.bmats.toLocaleString('en-US')}</span>
                        </div>
                        {/* Rmats */}
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src={getItemIconUrl('Refined Materials') || undefined} alt="Rmats" style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rmats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>{totals.rmats.toLocaleString('en-US')}</span>
                        </div>
                        {/* Emats */}
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src={getItemIconUrl('Explosive Powder') || undefined} alt="Emats" style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Emats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f87171' }}>{totals.emats.toLocaleString('en-US')}</span>
                        </div>
                        {/* Hemats */}
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src={getItemIconUrl('Heavy Explosive Powder') || undefined} alt="Hemats" style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Hemats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#c084fc' }}>{totals.hemats.toLocaleString('en-US')}</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Total Crate Amounts Required */}
                <div className="mpf-summary-card" style={{
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                        {language === 'tr' ? 'Gerekli Kasa Miktarı' : 'Crate Amounts'} ({(totals.bmatsCrates + totals.rmatsCrates + totals.ematsCrates + totals.hematsCrates).toLocaleString('en-US')} {language === 'tr' ? 'Kasa' : 'Crates'})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', flex: 1, alignItems: 'center' }}>
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src="/crate.png" alt="Crate" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bmats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fbbf24' }}>{totals.bmatsCrates.toLocaleString('en-US')} Crates</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>100/crate</span>
                        </div>
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src="/crate.png" alt="Crate" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rmats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8' }}>{totals.rmatsCrates.toLocaleString('en-US')} Crates</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>20/crate</span>
                        </div>
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src="/crate.png" alt="Crate" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Emats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f87171' }}>{totals.ematsCrates.toLocaleString('en-US')} Crates</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>40/crate</span>
                        </div>
                        <div className="mpf-material-tile" style={{ background: 'var(--card-header-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                            <img src="/crate.png" alt="Crate" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Hemats</span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#c084fc' }}>{totals.hematsCrates.toLocaleString('en-US')} Crates</span>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>30/crate</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Manage Crate Orders Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                        Manage Crate Orders
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        9 MPF Queue Slots per Category
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {categoryAllocations.map(alloc => {
                        const { catDef, candidateItems, selectedIndex, topItem, queueCount } = alloc;
                        const categoryIconUrl = getCategoryIconUrl(catDef.key);

                        if (!topItem) {
                            return (
                                <div
                                    key={catDef.key}
                                    className="mpf-item-card"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        background: 'var(--bg-card-hover)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0.75rem 1.25rem',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', width: '22px', height: '22px' }} title={catDef.label}>
                                        {categoryIconUrl ? (
                                            <img src={categoryIconUrl} alt={catDef.label} style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : <Package size={20} />}
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
                                        {language === 'tr' ? 'Eklenen malzeme yok.' : 'No items added.'}
                                    </span>
                                </div>
                            );
                        }

                        const mpfInfo = getMPFCosts(topItem.itemName);
                        const discountFactor = getMPFDiscountFactor(queueCount);
                        const itemBmats = Math.round(mpfInfo.costs.bmats * discountFactor);
                        const itemRmats = Math.round(mpfInfo.costs.rmats * discountFactor);
                        const itemEmats = Math.round(mpfInfo.costs.emats * discountFactor);
                        const itemHemats = Math.round(mpfInfo.costs.hemats * discountFactor);

                        const isCategoryDisabled = !!alloc.isDisabled;
                        return (
                            <div
                                key={catDef.key}
                                className="mpf-item-card"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                    background: 'var(--card-header-bg)',
                                    border: topItem.isPriority ? '1px solid rgba(255, 122, 0, 0.45)' : '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0.75rem 1.25rem',
                                    opacity: isCategoryDisabled ? 0.45 : 1,
                                    transition: 'opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={!isCategoryDisabled}
                                            onChange={() => toggleCategoryDisabled(catDef.key)}
                                            style={{ cursor: 'pointer', accentColor: '#10b981', width: '16px', height: '16px' }}
                                            title={language === 'tr' ? 'Kategoriyi Dahil Et / Çıkar' : 'Include / Exclude Category'}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', width: '22px', height: '22px' }} title={catDef.label}>
                                            {categoryIconUrl ? (
                                                <img src={categoryIconUrl} alt={catDef.label} style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                                            ) : <Package size={20} />}
                                        </div>
                                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isCategoryDisabled ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: isCategoryDisabled ? 'line-through' : 'none' }}>{topItem.itemName}</span>
                                        
                                        {topItem.isPriority && (
                                            <span style={{
                                                padding: '0.1rem 0.4rem',
                                                background: 'rgba(255, 122, 0, 0.15)',
                                                border: '1px solid rgba(255, 122, 0, 0.35)',
                                                borderRadius: '4px',
                                                color: '#ff7a00',
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.03em'
                                            }}>
                                                PRIORITY
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span>Stock: <strong style={{ color: 'var(--text-primary)' }}>{topItem.currentQty.toLocaleString('en-US')}</strong> / {topItem.targetMax.toLocaleString('en-US')}</span>
                                            <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
                                            <span style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                {itemBmats > 0 && <span style={{ color: '#fbbf24', fontWeight: 600 }}>{itemBmats.toLocaleString('en-US')} Bmats</span>}
                                                {itemRmats > 0 && <span style={{ color: '#38bdf8', fontWeight: 600 }}>{itemRmats.toLocaleString('en-US')} Rmats</span>}
                                                {itemEmats > 0 && <span style={{ color: '#f87171', fontWeight: 600 }}>{itemEmats.toLocaleString('en-US')} Emats</span>}
                                                {itemHemats > 0 && <span style={{ color: '#c084fc', fontWeight: 600 }}>{itemHemats.toLocaleString('en-US')} Hemats</span>}
                                            </span>
                                        </div>

                                        {/* Alternative Item Dropdown Select */}
                                        <CompactItemSelect
                                            candidateItems={candidateItems}
                                            selectedIndex={selectedIndex}
                                            onSelect={(idx) => setCategorySelectedIndices(prev => ({
                                                ...prev,
                                                [catDef.key]: idx
                                            }))}
                                            labelText={language === 'tr' ? 'Seçili Ürün:' : 'Selected Item:'}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.66rem', marginTop: '0.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', marginRight: '0.2rem' }} title={catDef.label}>
                                        {categoryIconUrl ? (
                                            <img src={categoryIconUrl} alt={catDef.label} style={{ width: '22px', height: '22px', objectFit: 'contain' }} onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        ) : <Package size={20} style={{ color: '#ffffff' }} />}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        {Array.from({ length: alloc.maxSlots || 9 }, (_, idx) => {
                                            const slotNum = idx + 1;
                                            const isActive = slotNum <= queueCount;

                                            return (
                                                <button
                                                    key={slotNum}
                                                    onClick={() => handleSlotClick(topItem.itemName, slotNum, queueCount)}
                                                    title={`Queue Slot ${slotNum}: ${isActive ? 'Active' : 'Disabled'}`}
                                                    style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        borderRadius: '4px',
                                                        background: isActive ? '#383838' : '#222222',
                                                        border: isActive ? '2px solid #5a5a5a' : '1px solid #333333',
                                                        boxShadow: isActive ? 'inset 0 1px 2px rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.4)' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        opacity: isActive ? 1 : 0.25,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <img
                                                        src={getItemIconUrl(topItem.itemName) || undefined}
                                                        alt={topItem.itemName}
                                                        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                                                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

MPFCalculatorPanel.displayName = 'MPFCalculatorPanel';
