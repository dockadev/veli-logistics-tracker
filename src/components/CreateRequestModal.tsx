import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Plus, Sparkles } from 'lucide-react';
import type { Depot, RequestItem, StockpileTemplates, DepotHistoryEntry, RegionSettings } from '../types';
import { getCategoryClass } from '../utils/helpers';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import { STANDARD_ITEMS } from '../utils/standardItems';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';



const getDepotRegion = (dep: Depot): string => {
    return dep.name.split(' - ')[0].trim();
};

const getDepotTown = (dep: Depot): string | null => {
    let town = dep.townName || null;
    if (!town) {
        const parts = dep.name.split(' - ');
        const isDepotType = (str: string) => {
            const l = str.toLowerCase();
            return l.includes('seaport') || l.includes('depot') || l.includes('port');
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
    const region = getDepotRegion(dep);
    const town = getDepotTown(dep);
    return town ? `${region} - ${town}` : region;
};

const STANDARD_ITEMS_ARRAY = Array.from(STANDARD_ITEMS);

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
    depots,
    activeDepotName,
    templates,
    regionSettings = {},
    depotsHistory = [],
    onSave,
    onClose,
    showToast,
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

    const depotKeys = useMemo(() => Object.keys(depots), [depots]);

    useEffect(() => {
        if (isOpen) {
            const options = Array.from(new Set(Object.values(depots).map(getDepotGroup))).sort();
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
            if (itemKey.toLowerCase().includes(query)) {
                matches.push(itemKey);
                if (matches.length >= 10) break; // Limit suggestions
            }
        }
        return matches;
    }, [itemNameInput]);



    const depotOptions = useMemo(() => {
        const groups = new Set<string>();
        Object.values(depots).forEach(dep => {
            const group = getDepotGroup(dep);
            if (group) groups.add(group);
        });
        return Array.from(groups).sort().map(group => ({
            value: group,
            label: group
        }));
    }, [depots]);

    const aiRecommendations = useMemo(() => {
        if (!depotName) return [];

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
        const current: Record<string, number> = {};
        Object.values(depots).forEach(dep => {
            if (dep.current) {
                Object.entries(dep.current).forEach(([itemName, itemInfo]) => {
                    current[itemName] = (current[itemName] || 0) + itemInfo.count;
                });
            }
        });

        // Sum scaled min & max targets globally across active regions (matching InventoryTab logic)
        const totalScaledMin: Record<string, number> = {};
        const totalScaledMax: Record<string, number> = {};
        const isPriorityItemMap: Record<string, boolean> = {};

        const activeRegions = new Set<string>();
        Object.values(depots).forEach(d => {
            const reg = d.name.split(' - ')[0].trim();
            if (reg) activeRegions.add(reg);
        });

        activeRegions.forEach(regionName => {
            const regionSetting = (regionSettings || {})[regionName] || { 
                regionName, 
                templateType: 'backline', 
                demandPercentage: 100 
            };
            const roleTemplate = templates[regionSetting.templateType] || {};

            COLONIAL_NEUTRAL_ITEMS.forEach((itemName) => {
                let rule = roleTemplate[itemName];
                if (!rule) {
                    return;
                }
                const scaledMin = Math.round(rule.min * (regionSetting.demandPercentage / 100));
                const scaledMax = Math.round(rule.max * (regionSetting.demandPercentage / 100));
                totalScaledMin[itemName] = (totalScaledMin[itemName] || 0) + scaledMin;
                totalScaledMax[itemName] = (totalScaledMax[itemName] || 0) + scaledMax;
                if (rule.isPriority) {
                    isPriorityItemMap[itemName] = true;
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

        const getPreviousQty = (itemName: string): number => {
            let total = 0;
            if (closestEntries.length > 0) {
                closestEntries.forEach(entry => {
                    const item = entry.items[itemName];
                    if (item) total += item.count;
                });
                return total;
            }
            Object.values(depots).forEach(dep => {
                if (dep.previous && dep.previous[itemName]) {
                    total += dep.previous[itemName].count;
                }
            });
            return total;
        };

        COLONIAL_NEUTRAL_ITEMS.forEach((itemName) => {
            const currentQty = current[itemName] || 0;
            const scaledMin = totalScaledMin[itemName] || 0;
            const scaledMax = totalScaledMax[itemName] || 0;

            // Skip if template max is 0
            if (scaledMax <= 0) return;

            // Skip if we have met or exceeded the global target (surplus)
            if (currentQty >= scaledMax) return;

            // Calculate consumption/depletion in the last 1 day
            const prevQty = getPreviousQty(itemName);
            const consumed = (prevQty > currentQty) ? (prevQty - currentQty) : 0;
            const isFastDepleting = consumed > 0;

            let severity: 'hizli_tukeniyor' | 'kritik' | 'hedef_altinda' | null = null;
            const isPriority = !!isPriorityItemMap[itemName];

            if (currentQty < scaledMin || (isPriority && currentQty < scaledMax)) {
                severity = 'kritik';
            } else if (isFastDepleting && currentQty < scaledMin * 1.5) {
                severity = 'hizli_tukeniyor';
            } else {
                severity = 'hedef_altinda';
            }

            if (severity) {
                const urgencyRatio = scaledMax > 0 ? currentQty / scaledMax : 1;
                const suggestedQty = scaledMax - currentQty; // Exact global shortage amount

                list.push({
                    name: itemName,
                    category: getItemOfficialCategory(itemName),
                    currentQty,
                    urgencyRatio,
                    isFastDepleting,
                    severity,
                    suggestedQty,
                    consumed,
                    isPriorityItem: !!isPriorityItemMap[itemName]
                });
            }
        });

        // Filter by category if a specific one is selected
        let filteredList = list;
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

        // Sort:
        // 'kritik' first, then 'hizli_tukeniyor', then 'hedef_altinda'.
        // Also priority critical items come before regular critical items.
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
        }).slice(0, 12);
    }, [depots, templates, depotsHistory, regionSettings, recCategory, includeVehicles, depotName]);

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

    if (!isOpen) return null;

    const handleSelectSuggestion = (name: string) => {
        setItemNameInput(name);
        setShowSuggestions(false);
    };

    const handleAddItem = () => {
        const trimmedName = itemNameInput.trim();
        if (!trimmedName) return;

        // Enforce matching with global standard items list
        if (!STANDARD_ITEMS.has(trimmedName)) {
            showToast(t('item_must_match'), 'error');
            return;
        }

        // Check if item is already added to the request list
        const alreadyExists = addedItems.some(i => i.itemName.toLowerCase() === trimmedName.toLowerCase());
        if (alreadyExists) {
            showToast(t('item_already_added'), 'error');
            return;
        }

        if (quantityRequired <= 0) {
            showToast(t('qty_must_greater_zero'), 'error');
            return;
        }

        setAddedItems(prev => [
            ...prev,
            {
                itemName: trimmedName,
                itemCategory: getItemOfficialCategory(trimmedName) as OfficialCategory,
                quantityRequired
            }
        ]);

        setItemNameInput('');
        setQuantityRequired(100);
        setShowSuggestions(false);
    };

    const handleRemoveItem = (index: number) => {
        setAddedItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!depotName) return;
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
                    className="modal-container modal-container-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <h3>{t('open_supply_request')}</h3>
                        <button className="modal-close" onClick={onClose} type="button">
                            <X size={16} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="modal-body modal-body-spacing" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
                            {/* Left Column: Form Content */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label htmlFor="requestDepotName">{t('target_depot_port')}</label>
                                {depotKeys.length > 0 ? (
                                    <CustomSelect
                                        id="requestDepotName"
                                        options={depotOptions}
                                        value={depotName}
                                        onChange={(val) => {
                                            setDepotName(val);
                                            setAddedItems([]); // Clear items if depot changes to prevent mismatch
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

                            {/* Divider */}
                            <div className="modal-divider" />

                            {/* Section: Add Item Form */}
                            <div className="added-items-section">
                                <h4 className="modal-section-title">
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
                                                // Small timeout to allow suggestion click
                                                setTimeout(() => setShowSuggestions(false), 200);
                                            }}
                                            autoComplete="off"
                                            className="input-standard"
                                            style={{ width: '100%' }}
                                        />

                                        {/* Suggestions Dropdown */}
                                        {showSuggestions && filteredSuggestions.length > 0 && (
                                            <div className="suggestions-dropdown" style={{ width: '100%' }}>
                                                {filteredSuggestions.map(suggestion => (
                                                    <div
                                                        key={suggestion}
                                                        onClick={() => handleSelectSuggestion(suggestion)}
                                                        className="suggestion-item-option"
                                                    >
                                                        {suggestion}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', width: '100%' }}>
                                {/* Required Quantity */}
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

                                {/* Add Button */}
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

                            {/* Section: Selected Items List */}
                            <div className="added-items-section">
                                <div className="added-items-header">
                                    <h4 className="modal-section-title">
                                        {t('added_items_count')} ({addedItems.length})
                                    </h4>
                                </div>

                                {addedItems.length === 0 ? (
                                    <div className="added-items-empty">
                                        {t('no_items_added')}
                                    </div>
                                ) : (
                                    <div className="added-items-scroll-box">
                                        {addedItems.map((item, index) => (
                                            <div 
                                                key={index} 
                                                className="added-item-row"
                                            >
                                                <div className="added-item-meta">
                                                    <span className={`badge ${getCategoryClass(item.itemCategory)} added-item-badge-category`}>
                                                        {t(`cat_${item.itemCategory}` as TranslationKey)}
                                                    </span>
                                                    <span className="added-item-name">
                                                        {item.itemName}
                                                    </span>
                                                </div>
                                                <div className="added-item-qty-actions">
                                                    <span className="added-item-req-qty">
                                                        Req: <strong className="added-item-req-qty-strong">{item.quantityRequired}</strong>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="delete-item-btn"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div> {/* End added-items-section */}
                        </div> {/* End Left Column */}

                        {/* Right Column: VELI AI Recommendation Panel */}
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.85rem', 
                            background: 'rgba(255, 255, 255, 0.01)', 
                            borderLeft: '1px solid var(--border-color)', 
                            paddingLeft: '1.5rem',
                            maxHeight: '480px'
                        }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                                <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                                <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {language === 'tr' ? 'VELI AI Önerileri' : 'VELI AI Recommendations'}
                                </h4>
                            </div>

                            {/* Filters Panel */}
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

                            {/* Recommendation List Container (Scrollable) */}
                            <div style={{ 
                                flex: 1, 
                                overflowY: 'auto', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.6rem',
                                paddingRight: '0.25rem'
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
                                            borderColor = 'rgba(249, 115, 22, 0.3)';
                                            bg = 'rgba(249, 115, 22, 0.03)';
                                            badgeBg = 'rgba(249, 115, 22, 0.2)';
                                            badgeColor = 'var(--accent-color)';
                                            
                                            if (language === 'tr') severityLabel = 'Son 1 gün içinde hızla tükeniyor';
                                            else if (language === 'pt-BR') severityLabel = 'Esgotando rápido no último 1 dia';
                                            else if (language === 'ru') severityLabel = 'Быстро истощается за последние сутки';
                                            else if (language === 'de') severityLabel = 'Schnell verbraucht am letzten 1 Tag';
                                            else severityLabel = 'Rapidly depleting in the last 1 day';
                                        } else if (rec.isPriorityItem && rec.severity === 'kritik') {
                                            borderColor = 'rgba(255, 122, 0, 0.4)';
                                            bg = 'rgba(255, 122, 0, 0.04)';
                                            badgeBg = 'rgba(255, 122, 0, 0.2)';
                                            badgeColor = '#ff7a00';
                                            
                                            if (language === 'tr') severityLabel = 'Öncelikli';
                                            else if (language === 'pt-BR') severityLabel = 'Prioridade';
                                            else if (language === 'ru') severityLabel = 'Приоритет';
                                            else if (language === 'de') severityLabel = 'Priorität';
                                            else severityLabel = 'Priority';
                                        } else if (rec.severity === 'hedef_altinda') {
                                            borderColor = 'rgba(59, 130, 246, 0.3)';
                                            bg = 'rgba(59, 130, 246, 0.03)';
                                            badgeBg = 'rgba(59, 130, 246, 0.2)';
                                            badgeColor = '#3b82f6';
                                            
                                            if (language === 'tr') severityLabel = 'Hedef Altında';
                                            else if (language === 'pt-BR') severityLabel = 'Abaixo da Meta';
                                            else if (language === 'ru') severityLabel = 'Ниже цели';
                                            else if (language === 'de') severityLabel = 'Unter Zielwert';
                                            else severityLabel = 'Below Target';
                                        } else {
                                            borderColor = 'rgba(239, 68, 68, 0.3)';
                                            bg = 'rgba(239, 68, 68, 0.03)';
                                            badgeBg = 'rgba(239, 68, 68, 0.2)';
                                            badgeColor = '#ef4444';
                                            
                                            if (language === 'tr') severityLabel = 'Kritik Seviyede';
                                            else if (language === 'pt-BR') severityLabel = 'Nível Crítico';
                                            else if (language === 'ru') severityLabel = 'Критический уровень';
                                            else if (language === 'de') severityLabel = 'Kritischer Stand';
                                            else severityLabel = 'Critical Level';
                                        }

                                        return (
                                            <div
                                                key={rec.name}
                                                onClick={() => handleSelectRecommendation(rec)}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.35rem',
                                                    padding: '0.6rem 0.75rem',
                                                    background: bg,
                                                    border: `1px solid ${borderColor}`,
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                }}
                                                className="veli-ai-rec-row"
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ 
                                                        fontWeight: rec.isPriorityItem && rec.severity === 'kritik' ? 800 : 600, 
                                                        fontSize: '0.72rem', 
                                                        color: rec.isPriorityItem && rec.severity === 'kritik' ? '#ff7a00' : 'var(--text-primary)', 
                                                        textOverflow: 'ellipsis', 
                                                        overflow: 'hidden', 
                                                        whiteSpace: 'nowrap', 
                                                        maxWidth: '140px' 
                                                    }} title={rec.name}>
                                                        {rec.name} {rec.isPriorityItem && rec.severity === 'kritik' && '(PRIO)'}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.58rem',
                                                        fontWeight: 800,
                                                        padding: '0.1rem 0.35rem',
                                                        borderRadius: '3px',
                                                        background: badgeBg,
                                                        color: badgeColor
                                                    }}>
                                                        {severityLabel}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                                                    <span>
                                                        {language === 'tr' ? 'Stok: ' : 'Stock: '}<strong>{rec.currentQty}</strong>
                                                    </span>
                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                                                        {language === 'tr' ? `Toplam İhtiyaç: +${rec.suggestedQty}` : `Total Need: +${rec.suggestedQty}`}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        </div> {/* Close modal-body */}
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

