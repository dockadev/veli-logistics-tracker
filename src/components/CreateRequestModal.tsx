import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Plus, Sparkles } from 'lucide-react';
import type { Depot, RequestItem, StockpileTemplates, DepotHistoryEntry, RegionSettings } from '../types';
import { getCategoryClass, resolveTemplateSetting, normalizeItemKey } from '../utils/helpers';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import { STANDARD_ITEMS } from '../utils/standardItems';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { getItemOfficialCategory } from '../utils/itemCategories';
import { toCanonicalItemName } from '../utils/canonicalResolver';
import { getItemIconUrl } from '../utils/itemIcons';



const getDepotRegion = (dep: Depot): string => {
    if (!dep || typeof dep.name !== 'string') return '';
    return dep.name.split(' - ')[0].trim();
};

const getDepotTown = (dep: Depot): string | null => {
    if (!dep || typeof dep.name !== 'string') return null;
    let town = dep.townName || null;
    if (!town) {
        const parts = dep.name.split(' - ');
        const isDepotType = (str: string) => {
            const l = str.toLowerCase().trim();
            if (l === 'sableport') return false;
            return l.includes('seaport') || l.includes('depot') || (l.includes('port') && !l.includes('sableport'));
        };
        if (parts.length >= 3 && !isDepotType(parts[1])) {
            town = parts[1];
        }
    }
    if (town) {
        const trimmed = town.trim();
        if (trimmed === 'Glimmerhaven') return "Light's End";
        if (trimmed === 'Loftmire' || trimmed === 'The Blemish') return 'Blemish';
        if (trimmed === 'Rising Loom') return 'Therizo';
        return town;
    }
    return null;
};

const getDepotGroup = (dep: Depot): string => {
    if (!dep || typeof dep.name !== 'string') return '';
    const region = getDepotRegion(dep);
    const town = getDepotTown(dep);
    return town ? `${region} - ${town}` : region;
};

const STANDARD_ITEMS_ARRAY = Array.from(STANDARD_ITEMS);

import { getDefaultTemplates } from '../utils/defaultTemplates';

interface CreateRequestModalProps {
    isOpen: boolean;
    depots: Record<string, Depot>;
    activeDepotName: string | null;
    templates: StockpileTemplates;
    regionSettings?: RegionSettings;
    depotsHistory?: DepotHistoryEntry[];
    onSave: (depotName: string, items: RequestItem[]) => void;
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'info' | 'error' | 'warning') => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = React.memo(({
    isOpen,
    depots = {},
    activeDepotName,
    templates = {},
    regionSettings = {},
    depotsHistory = [],
    onSave,
    onClose,
    showToast: _showToast,
}) => {
    const { t, language } = useLanguage();
    const [depotName, setDepotName] = useState('');
    const [itemNameInput, setItemNameInput] = useState('');
    const [quantityRequired, setQuantityRequired] = useState<number>(100);
    const [addedItems, setAddedItems] = useState<Omit<RequestItem, 'quantityDelivered'>[]>([]);
    
    // Recommendations filtering states
    const [recCategory, setRecCategory] = useState<string>('all');
    const [includeVehicles, setIncludeVehicles] = useState<boolean>(false);
    
    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Guarantee non-empty templates using defaults if needed
    const effectiveTemplates = useMemo(() => {
        if (templates && Object.keys(templates).length > 0) return templates;
        return getDefaultTemplates();
    }, [templates]);

    const depotKeys = useMemo(() => Object.keys(depots || {}), [depots]);

    useEffect(() => {
        if (isOpen) {
            const options = Array.from(new Set(Object.values(depots || {}).filter(Boolean).map(getDepotGroup))).filter(Boolean).sort();
            const defaultSel = activeDepotName
                ? (activeDepotName.startsWith('town:')
                    ? activeDepotName.substring(5)
                    : (depots[activeDepotName] ? getDepotGroup(depots[activeDepotName]) : (options[0] || '')))
                : (options[0] || '');
            setDepotName(defaultSel);
            setItemNameInput('');
            setQuantityRequired(100);
            setAddedItems([]);
            setShowSuggestions(false);
            setRecCategory('all');
            setIncludeVehicles(false);
        }
    }, [isOpen, activeDepotName, depots]);

    // Filtered suggestions list from standard game items (limit to 10 for performance)
    const filteredSuggestions = useMemo(() => {
        const query = itemNameInput.trim().toLowerCase();
        if (!query) return [];
        
        const matches: string[] = [];
        for (const itemKey of STANDARD_ITEMS_ARRAY) {
            const cat = getItemOfficialCategory(itemKey);
            const isVehicleOrShippable = cat === 'vehicles' || cat === 'vehicle_crates' || cat === 'shippables' || cat === 'shippable_crates';
            if (!isVehicleOrShippable && !itemKey.toLowerCase().endsWith('(crate)')) {
                continue;
            }
            if (itemKey.toLowerCase().includes(query)) {
                matches.push(itemKey);
                if (matches.length >= 10) break; // Limit suggestions
            }
        }
        return matches;
    }, [itemNameInput]);

    const depotOptions = useMemo(() => {
        const groups = new Set<string>();
        Object.values(depots || {}).forEach(dep => {
            if (dep) {
                const group = getDepotGroup(dep);
                if (group) groups.add(group);
            }
        });
        return Array.from(groups).sort().map(group => ({
            value: group,
            label: group
        }));
    }, [depots]);

    const aiRecommendations = useMemo(() => {
        try {
            const list: {
                name: string;
                category: string;
                currentQty: number;
                urgencyRatio: number;
                isFastDepleting: boolean;
                severity: 'hizli_tukeniyor' | 'kritik' | 'hedef_altinda';
                suggestedQty: number;
                consumed: number;
                isPriorityItem: boolean;
            }[] = [];

            // Sum current quantities globally across ALL depots
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

            // Helper to normalize quote characters and enforce (Crate) suffix for non-vehicle/non-shippables
            const sanitizeItemDisplayName = (rawName: string): string => {
                if (!rawName) return '';
                const cleanName = rawName.replace(/[\u201c\u201d\u201e\u201f\u2033\u2036"]/g, '"').replace(/[\u2018\u2019\u201a\u201b`']/g, "'").trim();
                const cat = getItemOfficialCategory(cleanName);
                const isVehicleOrShippable = cat === 'vehicles' || cat === 'vehicle_crates' || cat === 'shippables' || cat === 'shippable_crates';
                if (!isVehicleOrShippable && !cleanName.toLowerCase().endsWith('(crate)')) {
                    return `${cleanName} (Crate)`;
                }
                return cleanName;
            };

            // Gather unique item names directly defined across configured stockpile templates (deduplicated to (Crate) variants)
            // Only include Colonial/Neutral items — Warden-only items are excluded
            const templateItems = new Set<string>();
            Object.values(effectiveTemplates || {}).forEach(roleTmpl => {
                if (roleTmpl) {
                    Object.keys(roleTmpl).forEach(itName => {
                        const rawName = itName.replace(/ \(Crate\)$/i, '').trim();
                        if (COLONIAL_NEUTRAL_ITEMS.has(rawName)) {
                            const sanitized = sanitizeItemDisplayName(itName);
                            if (sanitized) templateItems.add(sanitized);
                        }
                    });
                }
            });

            // Sum scaled min & max targets globally across active regions
            const totalScaledMin: Record<string, number> = {};
            const totalScaledMax: Record<string, number> = {};
            const isPriorityItemMap: Record<string, boolean> = {};

            const activeRegions = new Set<string>();
            Object.values(depots || {}).forEach(d => {
                if (d) {
                    const reg = getDepotRegion(d);
                    if (reg) activeRegions.add(reg);
                }
            });

            if (activeRegions.size === 0 && regionSettings) {
                Object.keys(regionSettings).forEach(regKey => {
                    const reg = regKey.split(' - ')[0].trim();
                    if (reg) activeRegions.add(reg);
                });
            }

            // Fallback: If no active regions found, add a default region so templates always load
            if (activeRegions.size === 0) {
                activeRegions.add('Default');
            }

            activeRegions.forEach(regionName => {
                const regionSetting = resolveTemplateSetting(regionName, null, null, regionSettings);
                const templateType = (regionSetting && regionSetting.templateType) ? regionSetting.templateType : 'backline';
                if (templateType === 'unassigned') return;
                
                const roleTemplate = (effectiveTemplates && effectiveTemplates[templateType]) || {};
                const demandPct = ((regionSetting && regionSetting.demandPercentage !== undefined) ? regionSetting.demandPercentage : 100) / 100;

                // Map roleTemplate by canonical keys
                const canonicalRoleTemplate: Record<string, any> = {};
                Object.entries(roleTemplate || {}).forEach(([ruleItemName, rule]) => {
                    if (rule) {
                        const canonName = toCanonicalItemName(ruleItemName);
                        canonicalRoleTemplate[canonName] = rule;
                    }
                });

                templateItems.forEach(displayItemName => {
                    const canonName = toCanonicalItemName(displayItemName);
                    const normDisplayKey = normalizeItemKey(displayItemName);

                    const rule = canonicalRoleTemplate[canonName];
                    if (rule) {
                        const scaledMin = Math.round((rule.min || 0) * demandPct);
                        const scaledMax = Math.round((rule.max || 0) * demandPct);
                        totalScaledMin[normDisplayKey] = (totalScaledMin[normDisplayKey] || 0) + scaledMin;
                        totalScaledMax[normDisplayKey] = (totalScaledMax[normDisplayKey] || 0) + scaledMax;
                        if (rule.isPriority) {
                            isPriorityItemMap[normDisplayKey] = true;
                        }
                    }
                });
            });

        // Find closest history entries (around 24h ago) globally across ALL depots
        const currentScanTime = Math.max(...Object.values(depots).map(d => new Date(d.lastUpdated || new Date()).getTime()), Date.now());
        const targetTime = currentScanTime - 24 * 60 * 60 * 1000;

        const validEntriesByDepot: Record<string, DepotHistoryEntry[]> = {};
        (depotsHistory || []).forEach(h => {
            const dep = depots[h.depot_name];
            if (dep) {
                if (!validEntriesByDepot[h.depot_name]) {
                    validEntriesByDepot[h.depot_name] = [];
                }
                const t = new Date(h.imported_at).getTime();
                if (t < currentScanTime - 5 * 60 * 1000) {
                    validEntriesByDepot[h.depot_name].push(h);
                }
            }
        });

        const closestEntries: DepotHistoryEntry[] = [];
        Object.values(validEntriesByDepot).forEach(entries => {
            let closest: DepotHistoryEntry | null = null;
            let minDiff = Infinity;
            entries.forEach(entry => {
                const t = new Date(entry.imported_at).getTime();
                const diff = Math.abs(t - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = entry;
                }
            });
            if (closest) {
                closestEntries.push(closest);
            }
        });

        const getPreviousQty = (displayItemName: string): number => {
            const rawName = displayItemName.replace(' (Crate)', '').replace(' (crate)', '').trim();
            const normDisplayKey = normalizeItemKey(displayItemName);
            const normRawKey = normalizeItemKey(rawName);

            let total = 0;
            if (closestEntries.length > 0) {
                closestEntries.forEach(entry => {
                    Object.entries(entry.items || {}).forEach(([itName, item]) => {
                        const k = normalizeItemKey(itName);
                        if (k === normDisplayKey || k === normRawKey) {
                            total += item.count;
                        }
                    });
                });
                return total;
            }
            Object.values(depots).forEach(dep => {
                if (dep.previous) {
                    Object.entries(dep.previous).forEach(([itName, item]) => {
                        const k = normalizeItemKey(itName);
                        if (k === normDisplayKey || k === normRawKey) {
                            total += item.count;
                        }
                    });
                }
            });
            return total;
        };

        templateItems.forEach((displayItemName) => {
            const rawName = displayItemName.replace(' (Crate)', '').replace(' (crate)', '').trim();
            const normDisplayKey = normalizeItemKey(displayItemName);
            const normRawKey = normalizeItemKey(rawName);
            const cat = getItemOfficialCategory(displayItemName);

            // Vehicles and shippables can be un-crated; all other categories MUST be (Crate)
            const isVehicleOrShippable = cat === 'vehicles' || cat === 'vehicle_crates' || cat === 'shippables' || cat === 'shippable_crates';
            if (!isVehicleOrShippable && !displayItemName.toLowerCase().endsWith('(crate)')) {
                return; // Strictly skip un-crated non-vehicle items
            }

            const currentQty = (currentStockMap[normDisplayKey] || 0) + (normDisplayKey !== normRawKey ? (currentStockMap[normRawKey] || 0) : 0);
            const scaledMin = totalScaledMin[normDisplayKey] || totalScaledMin[normRawKey] || 0;
            const scaledMax = totalScaledMax[normDisplayKey] || totalScaledMax[normRawKey] || 0;
            const isPriority = !!(isPriorityItemMap[normDisplayKey] || isPriorityItemMap[normRawKey]);

            // Skip if template target max is 0
            if (scaledMax <= 0) return;

            // Include in recommendations if current stock is below target max
            if (currentQty < scaledMax) {
                const prevQty = getPreviousQty(displayItemName);
                const consumed = (prevQty > currentQty) ? (prevQty - currentQty) : 0;
                const isFastDepleting = consumed > 0;

                let severity: 'hizli_tukeniyor' | 'kritik' | 'hedef_altinda' = 'hedef_altinda';
                if (currentQty < scaledMin || (isPriority && currentQty < scaledMax)) {
                    severity = 'kritik';
                } else if (isFastDepleting && currentQty < scaledMin * 1.5) {
                    severity = 'hizli_tukeniyor';
                }

                const urgencyRatio = scaledMax > 0 ? currentQty / scaledMax : 1;
                const suggestedQty = scaledMax - currentQty;

                list.push({
                    name: displayItemName,
                    category: cat,
                    currentQty,
                    urgencyRatio,
                    isFastDepleting,
                    severity,
                    suggestedQty,
                    consumed,
                    isPriorityItem: isPriority
                });
            }
        });

        // Filter out items already added to the request
        const addedSet = new Set(
            addedItems.map(i => normalizeItemKey(i.itemName))
        );

        let filteredList = list.filter(item => {
            const normKey = normalizeItemKey(item.name);
            const crateNormKey = normKey.endsWith('(crate)') ? normKey : `${normKey} (crate)`;
            const baseNormKey = normKey.replace(' (crate)', '');
            return !addedSet.has(normKey) && !addedSet.has(crateNormKey) && !addedSet.has(baseNormKey);
        });

        // Filter by category if a specific one is selected
        if (recCategory !== 'all') {
            filteredList = filteredList.filter(item => item.category === recCategory);
        }

        // Include/exclude vehicles & shippables
        if (!includeVehicles) {
            filteredList = filteredList.filter(item => 
                item.category !== 'vehicles' && 
                item.category !== 'vehicle_crates' && 
                item.category !== 'shippables' && 
                item.category !== 'shippable_crates'
            );
        }

        const severityScore = {
            'kritik': 3,
            'hizli_tukeniyor': 2,
            'hedef_altinda': 1
        };

        return filteredList.sort((a, b) => {
            const scoreA = severityScore[a.severity] + (a.isPriorityItem && a.severity === 'kritik' ? 1 : 0);
            const scoreB = severityScore[b.severity] + (b.isPriorityItem && b.severity === 'kritik' ? 1 : 0);
            
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
            if (a.severity === 'kritik') {
                return a.urgencyRatio - b.urgencyRatio;
            } else {
                return b.consumed - a.consumed;
            }
        }).slice(0, 15);
    } catch (err) {
        console.error('aiRecommendations computation error:', err);
        return [];
    }
    }, [depots, templates, depotsHistory, regionSettings, recCategory, includeVehicles, depotName, addedItems]);

    const handleSelectRecommendation = (rec: { name: string; category: any; suggestedQty: number }) => {
        setItemNameInput(rec.name);
        setQuantityRequired(rec.suggestedQty);
    };

    const categoryOptions = useMemo(() => [
        { value: 'small_arms', label: t('cat_small_arms') },
        { value: 'heavy_arms', label: t('cat_heavy_arms') },
        { value: 'heavy_ammunition', label: t('cat_heavy_ammunition') },
        { value: 'utility', label: t('cat_utility') },
        { value: 'medical', label: t('cat_medical') },
        { value: 'materials', label: t('cat_materials') },
        { value: 'uniforms', label: t('cat_uniforms') },
        { value: 'aircraft_parts', label: t('cat_aircraft_parts') },
        { value: 'vehicles', label: t('cat_vehicles') },
        { value: 'shippables', label: t('cat_shippables') },
        { value: 'vehicle_crates', label: t('cat_vehicle_crates') },
        { value: 'shippable_crates', label: t('cat_shippable_crates') }
    ], [t]);

    const groupedAddedItems = useMemo(() => {
        const grouped: Record<string, typeof addedItems> = {};
        addedItems.forEach(item => {
            const catKey = item.itemCategory || getItemOfficialCategory(item.itemName);
            if (!grouped[catKey]) grouped[catKey] = [];
            grouped[catKey].push(item);
        });
        return grouped;
    }, [addedItems]);

    if (!isOpen) return null;

    const handleSelectSuggestion = (name: string) => {
        setItemNameInput(name);
        setShowSuggestions(false);
    };

    const handleAddItem = () => {
        if (!itemNameInput.trim()) return;

        const normalizedInputName = itemNameInput.trim();
        const cat = getItemOfficialCategory(normalizedInputName);

        const newItem: RequestItem = {
            itemName: normalizedInputName,
            itemCategory: cat as any,
            quantityRequired: quantityRequired > 0 ? quantityRequired : 100,
            quantityDelivered: 0
        };

        setAddedItems(prev => {
            const normName = normalizedInputName.toLowerCase().replace(/[\u201c\u201d\u201e\u201f\u2033\u2036"']/g, '').replace(/\s+/g, ' ').trim();
            if (prev.some(it => it.itemName.toLowerCase().replace(/[\u201c\u201d\u201e\u201f\u2033\u2036"']/g, '').replace(/\s+/g, ' ').trim() === normName)) {
                return prev; // Avoid duplicate item in request
            }
            return [...prev, newItem];
        });

        setItemNameInput('');
        setQuantityRequired(100);
        setShowSuggestions(false);
    };

    const handleRemoveItem = (indexToRemove: number) => {
        setAddedItems(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!depotName.trim()) {
            return;
        }

        if (addedItems.length === 0) return;

        const requestItems: RequestItem[] = addedItems.map(item => ({
            ...item,
            quantityDelivered: 0
        }));

        onSave(depotName, requestItems);
    };

    return (
        <>
            <div className="modal-backdrop-blur" onClick={onClose} />
            <div className="modal-wrapper" onClick={onClose}>
                <div 
                    className="modal-container modal-container-2xl"
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '1180px', width: '94vw' }}
                >
                    <div className="modal-header">
                        <h3>{t('open_supply_request')}</h3>
                        <button className="modal-close" onClick={onClose} type="button">
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="modal-body modal-body-spacing" style={{ display: 'grid', gridTemplateColumns: '290px 320px 1fr', gap: '1.25rem', alignItems: 'stretch' }}>
                            
                            {/* COLUMN 1 (LEFT): VELI AI Recommendation Panel */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.85rem', 
                                borderRight: '1px solid rgba(255, 255, 255, 0.1)', 
                                paddingRight: '1.25rem',
                                height: '520px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                                    <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                                    <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {language === 'tr' ? 'VELI AI Önerileri' : 'VELI AI Recommendations'}
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label htmlFor="recCategorySelect" style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                                            {language === 'tr' ? 'Kategori Filtresi' : 'Category Filter'}
                                        </label>
                                        <CustomSelect
                                            id="recCategorySelect"
                                            options={[
                                                { value: 'all', label: language === 'tr' ? 'Tüm Kategoriler' : 'All Categories' },
                                                ...categoryOptions
                                            ]}
                                            value={recCategory}
                                            onChange={(val) => setRecCategory(val)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                        <input
                                            type="checkbox"
                                            id="includeVehiclesShippables"
                                            checked={includeVehicles}
                                            onChange={(e) => setIncludeVehicles(e.target.checked)}
                                            style={{
                                                cursor: 'pointer',
                                                accentColor: 'var(--accent-color)',
                                                width: '13px',
                                                height: '13px',
                                                margin: 0
                                            }}
                                        />
                                        <label 
                                            htmlFor="includeVehiclesShippables" 
                                            style={{ 
                                                fontSize: '0.62rem', 
                                                color: 'var(--text-secondary)', 
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                margin: 0
                                            }}
                                        >
                                            {language === 'tr' ? 'Araç ve Taşınabilirleri Dahil Et' : 'Include Vehicles & Shippables'}
                                        </label>
                                    </div>
                                </div>

                                <div style={{ 
                                    flex: 1, 
                                    overflowY: 'auto', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '0.5rem',
                                    paddingRight: '0.2rem'
                                }}>
                                    {aiRecommendations.length === 0 ? (
                                        <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {language === 'tr' ? 'Öneri bulunmuyor' : 'No recommendations available'}
                                        </div>
                                    ) : (
                                        aiRecommendations.map(rec => {
                                            let borderColor = 'rgba(255, 255, 255, 0.05)';
                                            let bg = 'rgba(255, 255, 255, 0.01)';
                                            let badgeBg = 'rgba(255, 255, 255, 0.08)';
                                            let badgeColor = 'var(--text-secondary)';
                                            let severityLabel = '';

                                            if (rec.severity === 'hizli_tukeniyor') {
                                                borderColor = 'rgba(234, 179, 8, 0.3)';
                                                bg = 'rgba(234, 179, 8, 0.03)';
                                                badgeBg = 'rgba(234, 179, 8, 0.2)';
                                                badgeColor = '#eab308';
                                                
                                                if (language === 'tr') severityLabel = 'Hızlı Tükeniyor';
                                                else severityLabel = 'Fast Depleting';
                                            } else if (rec.severity === 'hedef_altinda') {
                                                borderColor = 'rgba(59, 130, 246, 0.3)';
                                                bg = 'rgba(59, 130, 246, 0.03)';
                                                badgeBg = 'rgba(59, 130, 246, 0.2)';
                                                badgeColor = '#3b82f6';
                                                
                                                if (language === 'tr') severityLabel = 'Hedef Altında';
                                                else severityLabel = 'Below Target';
                                            } else {
                                                borderColor = 'rgba(239, 68, 68, 0.3)';
                                                bg = 'rgba(239, 68, 68, 0.03)';
                                                badgeBg = 'rgba(239, 68, 68, 0.2)';
                                                badgeColor = '#ef4444';
                                                
                                                if (language === 'tr') severityLabel = 'Kritik Seviyede';
                                                else severityLabel = 'Critical Level';
                                            }

                                            return (
                                                <div
                                                    key={rec.name}
                                                    onClick={() => handleSelectRecommendation(rec)}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.3rem',
                                                        padding: '0.55rem 0.65rem',
                                                        background: bg,
                                                        border: `1px solid ${borderColor}`,
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                    className="veli-ai-rec-row"
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                                                            {getItemIconUrl(rec.name) && (
                                                                <img 
                                                                    src={getItemIconUrl(rec.name)!} 
                                                                    alt={rec.name} 
                                                                    style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }} 
                                                                    onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                />
                                                            )}
                                                            <span style={{ 
                                                                fontWeight: rec.isPriorityItem && rec.severity === 'kritik' ? 800 : 600, 
                                                                fontSize: '0.7rem', 
                                                                color: rec.isPriorityItem && rec.severity === 'kritik' ? '#ff7a00' : 'var(--text-primary)', 
                                                                textOverflow: 'ellipsis', 
                                                                overflow: 'hidden', 
                                                                whiteSpace: 'nowrap', 
                                                                maxWidth: '120px' 
                                                            }} title={rec.name}>
                                                                {rec.name} {rec.isPriorityItem && rec.severity === 'kritik' && '(PRIO)'}
                                                            </span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: '0.55rem',
                                                            fontWeight: 800,
                                                            padding: '0.1rem 0.3rem',
                                                            borderRadius: '3px',
                                                            background: badgeBg,
                                                            color: badgeColor
                                                        }}>
                                                            {severityLabel}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                                                        <span>
                                                            {language === 'tr' ? 'Stok: ' : 'Stock: '}<strong>{rec.currentQty.toLocaleString('en-US')}</strong>
                                                        </span>
                                                        <span style={{ color: 'var(--accent-color)', fontWeight: 700 }}>
                                                            {`Need: +${Math.round(rec.suggestedQty).toLocaleString('en-US')}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* COLUMN 2 (MIDDLE): Target Storage Depot & Add Item Form */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1.25rem',
                                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                                paddingRight: '1.25rem',
                                height: '520px'
                            }}>
                                <div className="form-group">
                                    <label htmlFor="requestDepotName" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                                        {language === 'tr' ? 'Target Storage Depot / Seaport (Hedef Depo / Liman)' : 'Target Storage Depot / Seaport'}
                                    </label>
                                    {depotKeys.length > 0 ? (
                                        <CustomSelect
                                            id="requestDepotName"
                                            options={depotOptions}
                                            value={depotName}
                                            onChange={(val) => {
                                                setDepotName(val);
                                                setAddedItems([]);
                                                setItemNameInput('');
                                            }}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            id="requestDepotName"
                                            placeholder={t('enter_target_depot_name')}
                                            value={depotName}
                                            onChange={(e) => setDepotName(e.target.value)}
                                            className="input-standard"
                                            required
                                        />
                                    )}
                                </div>

                                <div className="modal-divider" />

                                <div className="added-items-section">
                                    <h4 className="modal-section-title" style={{ fontSize: '0.78rem' }}>
                                        {t('add_items_request')}
                                    </h4>

                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label htmlFor="requestItemName" style={{ fontSize: '0.62rem' }}>{t('item_name_csv_match')}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                id="requestItemName"
                                                placeholder=""
                                                value={itemNameInput}
                                                onChange={(e) => {
                                                    setItemNameInput(e.target.value);
                                                    setShowSuggestions(true);
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => {
                                                    setTimeout(() => setShowSuggestions(false), 200);
                                                }}
                                                autoComplete="off"
                                                className="input-standard"
                                                style={{ width: '100%' }}
                                            />

                                            {showSuggestions && filteredSuggestions.length > 0 && (
                                                <div className="suggestions-dropdown" style={{ width: '100%' }}>
                                                    {filteredSuggestions.map(suggestion => (
                                                        <div
                                                            key={suggestion}
                                                            onClick={() => handleSelectSuggestion(suggestion)}
                                                            className="suggestion-item-option"
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                        >
                                                            {getItemIconUrl(suggestion) && (
                                                                <img 
                                                                    src={getItemIconUrl(suggestion)!} 
                                                                    alt={suggestion} 
                                                                    style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }} 
                                                                    onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                />
                                                            )}
                                                            <span>{suggestion}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', width: '100%' }}>
                                        <div className="form-group" style={{ flex: '1', margin: 0 }}>
                                            <label htmlFor="requestQuantity" style={{ fontSize: '0.62rem' }}>{t('required')}</label>
                                            <input
                                                type="number"
                                                id="requestQuantity"
                                                min="1"
                                                value={quantityRequired}
                                                onChange={(e) => setQuantityRequired(parseInt(e.target.value) || 0)}
                                                className="input-standard"
                                                style={{ width: '100%', height: '38px', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div style={{ height: '38px', display: 'flex', alignItems: 'flex-end' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-add-action"
                                                onClick={handleAddItem}
                                                style={{ height: '38px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                            >
                                                <Plus size={14} />
                                                <span>{t('add')}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMN 3 (RIGHT): Added Items List (Category-Grouped Vertical Stack) */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.85rem', 
                                height: '520px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t('added_items_count')} ({addedItems.length})
                                    </h4>
                                </div>

                                {addedItems.length === 0 ? (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
                                        {t('no_items_added')}
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.25rem' }}>
                                        {Object.entries(groupedAddedItems).map(([catKey, catItems]) => (
                                            <div key={catKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                                    <span className={`badge ${getCategoryClass(catKey)}`} style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem' }}>
                                                        {t(`cat_${catKey}` as TranslationKey) || catKey}
                                                    </span>
                                                    <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                        ({catItems.length})
                                                    </span>
                                                </div>

                                                {catItems.map(item => {
                                                    const originalIndex = addedItems.indexOf(item);
                                                    return (
                                                        <div 
                                                            key={originalIndex} 
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '0.35rem 0.6rem',
                                                                background: 'rgba(255, 255, 255, 0.02)',
                                                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                                 {getItemIconUrl(item.itemName) && (
                                                                     <img 
                                                                         src={getItemIconUrl(item.itemName)!} 
                                                                         alt={item.itemName} 
                                                                         style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }} 
                                                                         onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                                     />
                                                                 )}
                                                                 <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={item.itemName}>
                                                                     {item.itemName}
                                                                 </span>
                                                             </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                                    Req: <strong style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{item.quantityRequired}</strong>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveItem(originalIndex)}
                                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem', display: 'flex', alignItems: 'center' }}
                                                                    title={t('remove')}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                {t('cancel')}
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                                disabled={addedItems.length === 0}
                                style={addedItems.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                {t('open_request')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
});

CreateRequestModal.displayName = 'CreateRequestModal';

