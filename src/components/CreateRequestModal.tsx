import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Plus, Sparkles } from 'lucide-react';
import type { Depot, RequestItem } from '../types';
import { getCategoryClass } from '../utils/helpers';
import { CustomSelect } from './CustomSelect';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import { STANDARD_ITEMS } from '../utils/standardItems';
import { isVehicleName, isStructureName } from '../utils/csvParser';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';

const STANDARD_ITEMS_ARRAY = Array.from(STANDARD_ITEMS);

function getItemCategoryFromName(name: string): 'crate' | 'vehicle' | 'structure' | 'crate_vehicle' {
    const isCrate = name.endsWith('(Crate)');
    if (isVehicleName(name)) {
        return isCrate ? 'crate_vehicle' : 'vehicle';
    }
    if (isStructureName(name)) {
        return 'structure';
    }
    return 'crate';
}

interface CreateRequestModalProps {
    isOpen: boolean;
    depots: Record<string, Depot>;
    activeDepotName: string | null;
    onSave: (depotName: string, items: RequestItem[]) => void;
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'info' | 'error' | 'warning') => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = React.memo(({
    isOpen,
    depots,
    activeDepotName,
    onSave,
    onClose,
    showToast,
}) => {
    const { t, language } = useLanguage();
    const [depotName, setDepotName] = useState('');
    const [itemNameInput, setItemNameInput] = useState('');
    const [itemCategory, setItemCategory] = useState<'crate' | 'vehicle' | 'structure' | 'crate_vehicle'>('crate');
    const [quantityRequired, setQuantityRequired] = useState<number>(100);
    const [addedItems, setAddedItems] = useState<Omit<RequestItem, 'quantityDelivered'>[]>([]);
    
    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false);

    const depotKeys = useMemo(() => Object.keys(depots), [depots]);

    useEffect(() => {
        if (isOpen) {
            setDepotName(activeDepotName || (depotKeys.length > 0 ? depotKeys[0] : ''));
            setItemNameInput('');
            setItemCategory('crate');
            setQuantityRequired(100);
            setAddedItems([]);
            setShowSuggestions(false);
        }
    }, [isOpen, activeDepotName, depotKeys]);

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

    // Automatically resolve category when a valid matching item is typed/selected
    useEffect(() => {
        const name = itemNameInput.trim();
        if (STANDARD_ITEMS.has(name)) {
            setItemCategory(getItemCategoryFromName(name));
        }
    }, [itemNameInput]);

    const depotOptions = useMemo(() => {
        return depotKeys.map(key => ({
            value: key,
            label: depots[key].customName || depots[key].name
        }));
    }, [depotKeys, depots]);

    const aiRecommendations = useMemo(() => {
        const depot = depots[depotName];
        if (!depot) return [];

        const list: { name: string; category: 'item' | 'crate' | 'vehicle' | 'structure' | 'crate_vehicle'; currentQty: number; severity: 'critical' | 'depleting' | 'low'; rate?: number; suggestedQty: number }[] = [];
        const current = depot.current || {};
        const previous = depot.previous;

        if (previous && Object.keys(previous).length > 0) {
            // Compute velocity based on difference
            Object.entries(previous).forEach(([name, prevInfo]) => {
                // Filter only Colonial/Neutral items and only crate categories
                if (!COLONIAL_NEUTRAL_ITEMS.has(name)) return;
                const isCrate = name.endsWith('(Crate)') || prevInfo.category === 'crate' || prevInfo.category === 'crate_vehicle';
                if (!isCrate) return;

                const currInfo = current[name];
                const currQty = currInfo ? currInfo.count : 0;
                const consumed = prevInfo.count - currQty;

                if (consumed > 0) {
                    const hoursRemaining = currQty / (consumed || 1); // rough relative rate
                    let severity: 'critical' | 'depleting' | 'low' = 'low';
                    let suggestedQty = 100;

                    if (currQty <= 5 || hoursRemaining <= 0.5) {
                        severity = 'critical';
                    } else if (currQty <= 20 || hoursRemaining <= 1.5) {
                        severity = 'depleting';
                    } else {
                        severity = 'low';
                    }

                    list.push({
                        name,
                        category: prevInfo.category as any,
                        currentQty: currQty,
                        severity,
                        rate: consumed,
                        suggestedQty
                    });
                }
            });
        }

        // Add absolute low stock items (quantity <= 25) that weren't added already via velocity
        Object.entries(current).forEach(([name, itemInfo]) => {
            // Filter only Colonial/Neutral items and only crate categories
            if (!COLONIAL_NEUTRAL_ITEMS.has(name)) return;
            const isCrate = name.endsWith('(Crate)') || itemInfo.category === 'crate' || itemInfo.category === 'crate_vehicle';
            if (!isCrate) return;

            if (itemInfo.count <= 25) {
                const alreadyAdded = list.some(x => x.name === name);
                if (!alreadyAdded) {
                    let severity: 'critical' | 'depleting' | 'low' = 'low';
                    if (itemInfo.count <= 5) {
                        severity = 'critical';
                    } else if (itemInfo.count <= 15) {
                        severity = 'depleting';
                    }
                    list.push({
                        name,
                        category: itemInfo.category as any,
                        currentQty: itemInfo.count,
                        severity,
                        suggestedQty: 100
                    });
                }
            }
        });

        return list.sort((a, b) => {
            const hasVelA = a.rate !== undefined && a.rate > 0;
            const hasVelB = b.rate !== undefined && b.rate > 0;

            // Prioritize items with active consumption velocity (velocity > 0) first
            if (hasVelA && !hasVelB) return -1;
            if (!hasVelA && hasVelB) return 1;

            // Then sort each group by current quantity ascending (0 stock first)
            return a.currentQty - b.currentQty;
        }).slice(0, 12); // Limit to top 12 recommendations
    }, [depots, depotName]);

    const handleSelectRecommendation = (rec: { name: string; category: any; suggestedQty: number }) => {
        setItemNameInput(rec.name);
        setItemCategory(rec.category === 'item' ? 'crate' : rec.category);
    };

    const isCategoryLocked = useMemo(() => {
        const trimmed = itemNameInput.trim();
        return STANDARD_ITEMS.has(trimmed);
    }, [itemNameInput]);

    const categoryOptions = useMemo(() => [
        { value: 'crate', label: t('cat_crate') },
        { value: 'vehicle', label: t('cat_vehicle') },
        { value: 'crate_vehicle', label: t('cat_crate_vehicle') },
        { value: 'structure', label: t('cat_structure') }
    ], [t]);

    if (!isOpen) return null;

    const handleSelectSuggestion = (name: string) => {
        setItemNameInput(name);
        setItemCategory(getItemCategoryFromName(name));
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
                itemCategory,
                quantityRequired
            }
        ]);

        setItemNameInput('');
        setItemCategory('crate');
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
                                {/* Category Select (Auto-detected if matched) */}
                                <div className="form-group" style={{ flex: '2 1 180px', margin: 0 }}>
                                    <label htmlFor="requestCategory" style={{ fontSize: '0.62rem' }}>
                                        {t('category')} {isCategoryLocked && <span style={{ color: 'var(--accent-color)', fontSize: '0.58rem', marginLeft: '0.2rem' }}>({language === 'tr' ? 'Kilitli' : 'Locked'})</span>}
                                    </label>
                                    <CustomSelect
                                        id="requestCategory"
                                        options={categoryOptions}
                                        value={itemCategory}
                                        onChange={(val) => setItemCategory(val as 'crate' | 'vehicle' | 'structure' | 'crate_vehicle')}
                                        disabled={isCategoryLocked}
                                    />
                                </div>

                                    {/* Required Quantity */}
                                    <div className="form-group" style={{ flex: '1 1 100px', margin: 0 }}>
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

                        {/* Right Column: VELI AI Recommendation List */}
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1rem', 
                                background: 'rgba(255, 255, 255, 0.01)', 
                                borderLeft: '1px solid var(--border-color)', 
                                paddingLeft: '1.5rem',
                                maxHeight: '480px',
                                overflowY: 'auto'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                                    <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                                    <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {language === 'tr' ? 'VELI AI Önerileri' : 'VELI AI Recommendations'}
                                    </h4>
                                </div>

                                {aiRecommendations.length === 0 ? (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {language === 'tr' ? 'Yeterli veri bulunmuyor' : 'Not enough data available'}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {aiRecommendations.map(rec => {
                                            const isCritical = rec.severity === 'critical';
                                            const isDepleting = rec.severity === 'depleting';
                                            const borderColor = isCritical ? 'rgba(239, 68, 68, 0.25)' : isDepleting ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                                            const bg = isCritical ? 'rgba(239, 68, 68, 0.02)' : isDepleting ? 'rgba(249, 115, 22, 0.02)' : 'rgba(255, 255, 255, 0.01)';
                                            const badgeBg = isCritical ? 'rgba(239, 68, 68, 0.15)' : isDepleting ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 255, 255, 0.08)';
                                            const badgeColor = isCritical ? '#ef4444' : isDepleting ? 'var(--accent-color)' : 'var(--text-secondary)';
                                            
                                            const severityLabel = language === 'tr' 
                                                ? (isCritical ? 'Kritik' : isDepleting ? 'Hızlı Tüketim' : 'Düşük Stok')
                                                : (isCritical ? 'Critical' : isDepleting ? 'Depleting' : 'Low Stock');

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
                                                        <span style={{ fontWeight: 600, fontSize: '0.72rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={rec.name}>
                                                            {rec.name}
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
                                                            {language === 'tr' ? 'Mevcut Stok: ' : 'Stock: '}<strong>{rec.currentQty}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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

