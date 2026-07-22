import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Search, Sliders, CheckCircle2, ChevronDown, ChevronUp, Info, Trash2, Copy, ClipboardPaste, Eye, EyeOff, Star, Download, Upload } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../context/LanguageContext';
import type { StockpileTemplates, UserRole, Depot, RegionSettings } from '../types';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory, type OfficialCategory } from '../utils/itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { CustomSelect } from './CustomSelect';
import { getDefaultRuleForCategory, getDefaultTemplates, DEFAULT_TEMPLATE_COLORS, PRESET_COLORS } from '../utils/defaultTemplates';
import { getItemIconUrl, getCategoryIconUrl } from '../utils/itemIcons';
import { dbService } from '../utils/dbService';
import { ConfirmModal } from './ConfirmModal';

interface StockpileTemplatesTabProps {
    templates: StockpileTemplates;
    onSaveTemplates: (templates: StockpileTemplates) => Promise<void>;
    userRole: UserRole;
    regionSettings: RegionSettings;
    onSaveRegionSettings: (settings: RegionSettings) => Promise<void>;
    depots: Record<string, Depot>;
}

export const StockpileTemplatesTab: React.FC<StockpileTemplatesTabProps> = React.memo(({
    templates,
    onSaveTemplates,
    userRole,
    regionSettings = {},
    onSaveRegionSettings,
    depots = {}
}) => {
    const { t, language } = useLanguage();
    const [activeRole, setActiveRole] = useState<string>('frontline');
    const [localTemplates, setLocalTemplates] = useState<StockpileTemplates>(templates);
    const [showRegionSettingsInfo, setShowRegionSettingsInfo] = useState(false);
    const [showMinMaxTemplatesInfo, setShowMinMaxTemplatesInfo] = useState(false);
    const [search, setSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    
    const OFFICIAL_CATEGORIES: OfficialCategory[] = [
        'small_arms',
        'heavy_arms',
        'heavy_ammunition',
        'utility',
        'medical',
        'materials',
        'uniforms',
        'aircraft_parts',
        'vehicles',
        'shippables',
        'vehicle_crates',
        'shippable_crates'
    ];

    const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
    const [showOnlyPriority, setShowOnlyPriority] = useState(false);

    const toggleCategory = (cat: string) => {
        setDisabledCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) {
                next.delete(cat);
            } else {
                next.add(cat);
            }
            return next;
        });
    };

    const toggleAllCategories = () => {
        setDisabledCategories(prev => {
            if (prev.size === 0) {
                return new Set(OFFICIAL_CATEGORIES);
            } else {
                return new Set();
            }
        });
    };

    // Custom templates states
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedNewColor, setSelectedNewColor] = useState<string>('#10b981');
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
    const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

    const [templateColors, setTemplateColors] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('foxhole_template_colors');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return DEFAULT_TEMPLATE_COLORS;
    });

    useEffect(() => {
        dbService.loadTemplateColors().then(colors => {
            if (colors && Object.keys(colors).length > 0) {
                setTemplateColors(colors);
            }
        });
    }, []);

    const [localRegionSettings, setLocalRegionSettings] = useState<RegionSettings>(regionSettings);
    const [isSavingRegions, setIsSavingRegions] = useState(false);
    const [savedRegionsSuccess, setSavedRegionsSuccess] = useState(false);
    const [isRegionPanelCollapsed, setIsRegionPanelCollapsed] = useState(true);

    const [copiedBuffer, setCopiedBuffer] = useState<Record<string, any> | null>(null);
    const [copiedName, setCopiedName] = useState<string | null>(null);
    const [copyToast, setCopyToast] = useState<string | null>(null);
    const [backupToast, setBackupToast] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleExportBackup = async () => {
        try {
            const defaults = getDefaultTemplates();
            const safeTemplatesToExport: StockpileTemplates = {
                frontline: localTemplates.frontline || defaults.frontline,
                backline: localTemplates.backline || defaults.backline,
                aircraft: localTemplates.aircraft || defaults.aircraft,
                ...localTemplates
            };

            const exportData = {
                _app: "Veli Logistics Tracker",
                _version: "0.1.64",
                _exportedAt: new Date().toISOString(),
                _activeRole: activeRole,
                templateColors,
                templates: safeTemplatesToExport
            };

            const jsonStr = JSON.stringify(exportData, null, 2);
            const dateStr = new Date().toISOString().split('T')[0];
            const safeRoleName = activeRole.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const defaultFilename = `foxhole_template_${safeRoleName}_${dateStr}.json`;

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: defaultFilename,
                        types: [{
                            description: 'JSON Files (*.json)',
                            accept: { 'application/json': ['.json'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(jsonStr);
                    await writable.close();

                    setBackupToast(language === 'tr' ? 'Şablon yedeği seçtiğiniz konuma kaydedildi!' : 'Template backup saved to selected location!');
                    setTimeout(() => setBackupToast(null), 3500);
                    return;
                } catch (err: any) {
                    if (err.name === 'AbortError') {
                        return; // User canceled save dialog
                    }
                    console.warn('showSaveFilePicker error, falling back to download:', err);
                }
            }

            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setBackupToast(language === 'tr' ? 'Şablon yedeği İndirilenler klasörünüze kaydedildi.' : 'Template backup saved to Downloads folder.');
            setTimeout(() => setBackupToast(null), 3500);
        } catch (err) {
            console.error('Failed to export backup:', err);
        }
    };

    const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = JSON.parse(content);
                
                const importedTemplates = parsed.templates || (parsed.frontline ? parsed : null);
                if (!importedTemplates || typeof importedTemplates !== 'object') {
                    alert(language === 'tr' ? 'Geçersiz şablon dosyası formatı!' : 'Invalid template file format!');
                    return;
                }

                const defaults = getDefaultTemplates();
                const mergedTemplates: StockpileTemplates = {
                    frontline: importedTemplates.frontline || defaults.frontline,
                    backline: importedTemplates.backline || defaults.backline,
                    aircraft: importedTemplates.aircraft || defaults.aircraft,
                    ...importedTemplates
                };

                setLocalTemplates(mergedTemplates);
                await dbService.saveTemplates(mergedTemplates);
                await onSaveTemplates(mergedTemplates);

                if (parsed.templateColors && typeof parsed.templateColors === 'object') {
                    setTemplateColors(prev => ({ ...prev, ...parsed.templateColors }));
                    await dbService.saveTemplateColors({ ...templateColors, ...parsed.templateColors });
                }

                setBackupToast(language === 'tr' ? 'Şablon yedeği başarıyla içe aktarıldı!' : 'Template backup imported successfully!');
                setTimeout(() => setBackupToast(null), 3500);
            } catch (err) {
                console.error('Failed to import template backup:', err);
                alert(language === 'tr' ? 'Şablon dosyası okunamadı. Geçerli bir JSON dosyası seçin.' : 'Failed to parse template file. Select a valid JSON file.');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        setLocalRegionSettings(regionSettings);
    }, [regionSettings]);

    useEffect(() => {
        const defaults = getDefaultTemplates();
        const safe: StockpileTemplates = {
            frontline: templates?.frontline || defaults.frontline,
            backline: templates?.backline || defaults.backline,
            aircraft: templates?.aircraft || defaults.aircraft,
            ...(templates || {})
        };
        setLocalTemplates(safe);
    }, [templates]);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowRegionSettingsInfo(false);
                setShowMinMaxTemplatesInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    const getDepotRegion = (depName: string): string => {
        const parts = depName.split(' - ').map(s => s.trim()).filter(Boolean);
        return parts[0] || 'Unknown Region';
    };

    const getDepotTown = (depName: string, depotTownField?: string | null): string | null => {
        let town = depotTownField || null;
        if (!town) {
            const parts = depName.split(' - ').map(s => s.trim()).filter(Boolean);
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

    const uniqueSubregionsGrouped = useMemo(() => {
        const groups: Record<string, string[]> = {};
        Object.values(depots).forEach(d => {
            if (d.name) {
                const region = getDepotRegion(d.name);
                const town = getDepotTown(d.name, d.townName);
                const subregionKey = town ? `${region} - ${town}` : region;
                if (!groups[region]) {
                    groups[region] = [];
                }
                if (!groups[region].includes(subregionKey)) {
                    groups[region].push(subregionKey);
                }
            }
        });
        
        Object.keys(groups).forEach(reg => {
            groups[reg].sort();
        });
        
        return groups;
    }, [depots]);

    const handleRegionSettingChange = (region: string, field: 'templateType' | 'demandPercentage', val: any) => {
        setLocalRegionSettings(prev => {
            const current = prev[region] || { regionName: region, templateType: 'unassigned', demandPercentage: 100 };
            return {
                ...prev,
                [region]: {
                    ...current,
                    [field]: val
                }
            };
        });
    };

    const handleSaveRegions = async () => {
        setIsSavingRegions(true);
        try {
            await onSaveRegionSettings(localRegionSettings);
            setSavedRegionsSuccess(true);
            setTimeout(() => setSavedRegionsSuccess(false), 3000);
        } catch (e) {
            console.error('Failed to save region settings:', e);
        } finally {
            setIsSavingRegions(false);
        }
    };

    const handleRuleChange = (itemName: string, field: 'min' | 'max' | 'isPriority', val: any) => {
        setLocalTemplates(prev => {
            const currentRoleTemplates = { ...(prev[activeRole] || {}) };
            const cat = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);
            const currentRule = currentRoleTemplates[itemName] || getDefaultRuleForCategory(cat, activeRole);
            
            let updatedRule;
            if (field === 'isPriority') {
                updatedRule = {
                    ...currentRule,
                    isPriority: !!val
                };
            } else {
                const num = Math.max(0, isNaN(val) ? 0 : val);
                updatedRule = {
                    ...currentRule,
                    [field]: num
                };
            }

            const crateKey = itemName.endsWith(' (Crate)') ? itemName : `${itemName} (Crate)`;
            const baseKey = itemName.endsWith(' (Crate)') ? itemName.replace(' (Crate)', '') : itemName;

            currentRoleTemplates[itemName] = updatedRule;
            currentRoleTemplates[crateKey] = updatedRule;
            currentRoleTemplates[baseKey] = updatedRule;

            return {
                ...prev,
                [activeRole]: currentRoleTemplates
            };
        });
    };



    const handleSave = async () => {
        setIsSaving(true);
        try {
            const defaults = getDefaultTemplates();
            const safeTemplatesToSave: StockpileTemplates = {
                frontline: localTemplates.frontline || defaults.frontline,
                backline: localTemplates.backline || defaults.backline,
                aircraft: localTemplates.aircraft || defaults.aircraft,
                ...localTemplates
            };

            await dbService.saveTemplateColors(templateColors);
            await onSaveTemplates(safeTemplatesToSave);
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (e) {
            console.error('Failed to save templates:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const allItems = useMemo(() => {
        const itemsMap = new Map<string, string>();
        COLONIAL_NEUTRAL_ITEMS.forEach(rawName => {
            const cat = ITEM_CATEGORY_MAP[rawName] || getItemOfficialCategory(rawName);
            
            if (cat === 'vehicles' || cat === 'shippables' || cat === 'aircraft_parts') {
                // Vehicles, Shippables, Aircraft/Planes can be single units AND Crates
                itemsMap.set(rawName, cat);
                const crateCat = cat === 'vehicles' ? 'vehicle_crates' : cat === 'shippables' ? 'shippable_crates' : 'aircraft_parts';
                itemsMap.set(`${rawName} (Crate)`, crateCat);
            } else {
                // All regular items in stockpiles exist ONLY as Crates
                const crateName = rawName.endsWith('(Crate)') ? rawName : `${rawName} (Crate)`;
                itemsMap.set(crateName, cat);
            }
        });
        return Array.from(itemsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, []);

    const activeRules = localTemplates[activeRole] || {};

    const filteredItems = allItems.filter(([itemName, cat]) => {
        const isCategoryEnabled = !disabledCategories.has(cat);
        const matchesSearch = search.trim() === '' || itemName.toLowerCase().includes(search.toLowerCase());
        
        if (showOnlyPriority) {
            const rule = activeRules[itemName];
            if (!rule || !rule.isPriority) {
                return false;
            }
        }

        return isCategoryEnabled && matchesSearch;
    });

    const templateStats = useMemo(() => {
        const rules = localTemplates[activeRole] || {};
        let activeCount = 0;
        let ignoredCount = 0;
        let totalMin = 0;
        let totalMax = 0;

        allItems.forEach(([itemName, cat]) => {
            const rule = rules[itemName] || getDefaultRuleForCategory(cat, activeRole);
            if (rule.min === 0 && rule.max === 0) {
                ignoredCount++;
            } else {
                activeCount++;
                totalMin += rule.min;
                totalMax += rule.max;
            }
        });

        return {
            total: allItems.length,
            activeCount,
            ignoredCount,
            totalMin,
            totalMax
        };
    }, [allItems, localTemplates, activeRole]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Region Template Settings Panel */}
            <div className="card-container" style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isRegionPanelCollapsed ? 'none' : '1px solid var(--border-color)', paddingBottom: isRegionPanelCollapsed ? '0' : '0.5rem', marginBottom: isRegionPanelCollapsed ? '0' : '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div 
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '36px',
                                height: '36px',
                                background: 'rgba(var(--accent-color-rgb), 0.12)',
                                border: '1px solid rgba(var(--accent-color-rgb), 0.25)',
                                borderRadius: '8px',
                                color: 'var(--accent-color)',
                                cursor: 'pointer'
                            }} 
                            onClick={() => setIsRegionPanelCollapsed(!isRegionPanelCollapsed)}
                            title={isRegionPanelCollapsed ? (language === 'tr' ? 'Genişlet' : 'Expand') : (language === 'tr' ? 'Daralt' : 'Collapse')}
                        >
                            <Sliders size={18} />
                        </div>
                        <div style={{ cursor: 'pointer' }} onClick={() => setIsRegionPanelCollapsed(!isRegionPanelCollapsed)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {language === 'tr' ? 'Bölge Şablon Ayarları' : 'Region Template Settings'}
                                    {isRegionPanelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </h2>
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="popover-trigger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRegionSettingsInfo(!showRegionSettingsInfo);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: showRegionSettingsInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.15s'
                                        }}
                                    >
                                        <Info size={14} />
                                    </button>
                                    {showRegionSettingsInfo && (
                                        <div className="popover-card" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            zIndex: 99999,
                                            width: '320px',
                                            background: 'rgba(20, 20, 23, 0.96)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '0.85rem',
                                            marginTop: '0.35rem',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: '1.45',
                                            boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                            textTransform: 'none',
                                            fontWeight: 'normal',
                                            letterSpacing: 'normal',
                                            textAlign: 'left'
                                        }}>
                                            <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                                {t('info_region_settings_title')}
                                            </strong>
                                            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <li>{t('info_region_settings_bullet1')}</li>
                                                <li>{t('info_region_settings_bullet2')}</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                                {language === 'tr' ? 'Bölgelere şablon rolü ve yüzdelik talep çarpanı atayın.' : 'Assign template roles and demand percentage multipliers to regions.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveRegions}
                        disabled={isSavingRegions}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.72rem', fontWeight: 800 }}
                    >
                        {savedRegionsSuccess ? <CheckCircle2 size={14} style={{ color: '#10b981' }} /> : <Save size={14} />}
                        <span>{savedRegionsSuccess ? t('templates_saved_success') : (isSavingRegions ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : t('save_changes'))}</span>
                    </button>
                </div>

                {!isRegionPanelCollapsed && (
                    <>
                        {Object.keys(uniqueSubregionsGrouped).length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '1rem 0' }}>
                                {language === 'tr' ? 'Henüz hiçbir depo içe aktarılmadı. Şablon ataması yapabilmek için önce CSV yükleyin.' : 'No depots imported yet. Import CSV files first to assign templates.'}
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {Object.entries(uniqueSubregionsGrouped).map(([region, subregions]) => {
                                    return (
                                        <div key={region} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-color)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.15rem', paddingLeft: '0.25rem' }}>
                                                {region}
                                            </div>
                                            {subregions.map(subregion => {
                                                const setting = localRegionSettings[subregion] || { regionName: subregion, templateType: 'unassigned', demandPercentage: 100 };
                                                const isUnassigned = !setting.templateType || setting.templateType === 'unassigned';

                                                return (
                                                    <div
                                                        key={subregion}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            flexWrap: 'wrap',
                                                            gap: '0.75rem',
                                                            padding: '0.45rem 0.65rem',
                                                            background: isUnassigned ? 'rgba(239, 68, 68, 0.05)' : 'rgba(0, 0, 0, 0.25)',
                                                            border: isUnassigned ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                                                            borderRadius: '6px',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                {subregion.includes(' - ') ? subregion.split(' - ')[1] : subregion}
                                                            </span>
                                                            {isUnassigned && (
                                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' }}>
                                                                    {language === 'tr' ? 'ATANMADI' : 'UNASSIGNED'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                                                            {/* Template Selector */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                                    {language === 'tr' ? 'Şablon:' : 'Template:'}
                                                                </span>
                                                                <div style={{ width: '185px' }}>
                                                                    <CustomSelect
                                                                        options={[
                                                                            { value: 'unassigned', label: language === 'tr' ? 'Şablon Seçin...' : 'Select Template...' },
                                                                            ...Object.keys(localTemplates).map(tKey => ({
                                                                                value: tKey,
                                                                                label: tKey === 'frontline' ? t('frontline') : tKey === 'backline' ? t('backline') : tKey === 'aircraft' ? 'Aircraft' : tKey
                                                                            }))
                                                                        ]}
                                                                        value={setting.templateType || 'unassigned'}
                                                                        onChange={(val) => handleRegionSettingChange(subregion, 'templateType', val)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Demand Percentage Slider */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '160px' }}>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="200"
                                                                    step="5"
                                                                    value={setting.demandPercentage}
                                                                    onChange={(e) => handleRegionSettingChange(subregion, 'demandPercentage', parseInt(e.target.value, 10))}
                                                                    style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer', height: '4px', background: 'rgba(255,255,255,0.1)' }}
                                                                />
                                                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-color)', width: '35px', textAlign: 'right', fontFamily: 'var(--font-heading)' }}>
                                                                    %{setting.demandPercentage}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {(userRole === 'developer' || userRole === 'logistics_lead') && (
                <>
                    {/* Header Card */}
                    <div className="card-container" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '42px',
                            height: '42px',
                            background: 'rgba(var(--accent-color-rgb), 0.12)',
                            border: '1px solid rgba(var(--accent-color-rgb), 0.25)',
                            borderRadius: '10px',
                            color: 'var(--accent-color)'
                        }}>
                            <Sliders size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {t('stockpile_templates_title')}
                                </h2>
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="popover-trigger"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMinMaxTemplatesInfo(!showMinMaxTemplatesInfo);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: showMinMaxTemplatesInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'color 0.15s'
                                        }}
                                    >
                                        <Info size={14} />
                                    </button>
                                    {showMinMaxTemplatesInfo && (
                                        <div className="popover-card" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            zIndex: 99999,
                                            width: '320px',
                                            background: 'rgba(20, 20, 23, 0.96)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            padding: '0.85rem',
                                            marginTop: '0.35rem',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: '1.45',
                                            boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
                                            textTransform: 'none',
                                            fontWeight: 'normal',
                                            letterSpacing: 'normal',
                                            textAlign: 'left'
                                        }}>
                                            <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                                {t('info_minmax_templates_title')}
                                            </strong>
                                            <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <li>{t('info_minmax_templates_bullet1')}</li>
                                                <li>{t('info_minmax_templates_bullet2')}</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem', maxWidth: '650px' }}>
                                {t('stockpile_templates_desc')}
                            </p>
                            {backupToast && (
                                <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 700, padding: '0.25rem 0.65rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', display: 'inline-block' }}>
                                    {backupToast}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleExportBackup}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: 700 }}
                            title={language === 'tr' ? 'Tüm şablonları JSON dosyası olarak bilgisayara indir' : 'Download all templates as JSON'}
                        >
                            <Download size={15} />
                            <span>{language === 'tr' ? 'Yedek İndir (JSON)' : 'Export Backup (JSON)'}</span>
                        </button>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept=".json" 
                            style={{ display: 'none' }} 
                            onChange={handleImportBackup} 
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: 700 }}
                            title={language === 'tr' ? 'JSON yedek dosyasını yükle' : 'Upload JSON backup file'}
                        >
                            <Upload size={15} />
                            <span>{language === 'tr' ? 'Yedek Yükle' : 'Import Backup'}</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '0.4rem', 
                                padding: '0.55rem 1rem', 
                                fontSize: '0.75rem', 
                                fontWeight: 800, 
                                minWidth: '170px', 
                                height: '36px' 
                            }}
                        >
                            {savedSuccess ? <CheckCircle2 size={16} style={{ color: '#10b981' }} /> : <Save size={16} />}
                            <span>{savedSuccess ? (language === 'tr' ? 'Kaydedildi' : 'Saved') : (isSaving ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : t('save_templates'))}</span>
                        </button>
                    </div>
                </div>

                {/* Role Switcher Tabs & Active Template Color Picker */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {Object.keys(localTemplates).map(tKey => {
                            const isActive = activeRole === tKey;
                            const isSystem = tKey === 'frontline' || tKey === 'backline' || tKey === 'aircraft';
                            
                            const assignedColor = templateColors[tKey] || (tKey === 'frontline' ? '#ef4444' : tKey === 'backline' ? '#ffffff' : tKey === 'aircraft' ? '#06b6d4' : '#10b981');
                            
                            return (
                                <div key={tKey} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveRole(tKey)}
                                        style={{
                                            padding: !isSystem ? '0.45rem 2.2rem 0.45rem 1rem' : '0.45rem 1.25rem',
                                            borderRadius: '6px',
                                            border: isActive ? `2px solid ${assignedColor}` : `1px solid ${assignedColor}60`,
                                            background: isActive ? `${assignedColor}25` : `${assignedColor}08`,
                                            color: assignedColor,
                                            boxShadow: isActive ? `0 0 10px ${assignedColor}35` : 'none',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            fontFamily: 'var(--font-heading)',
                                            textTransform: 'uppercase',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            lineHeight: 1,
                                            minHeight: '34px'
                                        }}
                                    >
                                        {tKey === 'frontline' ? t('frontline') : tKey === 'backline' ? t('backline') : tKey === 'aircraft' ? 'Aircraft' : tKey}
                                    </button>
                                    
                                    {/* Delete button for custom templates */}
                                    {!isSystem && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTemplateToDelete(tKey);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                right: '6px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'rgba(239, 68, 68, 0.18)',
                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                borderRadius: '4px',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s ease',
                                                width: '20px',
                                                height: '20px'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.45)';
                                                e.currentTarget.style.borderColor = '#ef4444';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                            }}
                                            title={language === 'tr' ? 'Şablonu Sil' : 'Delete Template'}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Active Template Controls: Color Picker + Copy & Paste Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        {/* Copy / Paste Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const rules = localTemplates[activeRole] || {};
                                    setCopiedBuffer(JSON.parse(JSON.stringify(rules)));
                                    const dispName = activeRole === 'frontline' ? t('frontline') : activeRole === 'backline' ? t('backline') : activeRole === 'aircraft' ? 'Aircraft' : activeRole;
                                    setCopiedName(dispName);
                                    setCopyToast(language === 'tr' ? `"${dispName}" kopyalandı` : `Copied "${dispName}"`);
                                    setTimeout(() => setCopyToast(null), 2500);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                title={language === 'tr' ? 'Bu şablon kurallarını kopyala' : 'Copy template rules'}
                            >
                                <Copy size={12} />
                                <span>{language === 'tr' ? 'Kopyala' : 'Copy'}</span>
                            </button>

                            <button
                                type="button"
                                disabled={!copiedBuffer}
                                onClick={() => {
                                    if (!copiedBuffer) return;
                                    setLocalTemplates(prev => ({
                                        ...prev,
                                        [activeRole]: JSON.parse(JSON.stringify(copiedBuffer))
                                    }));
                                    const dispName = activeRole === 'frontline' ? t('frontline') : activeRole === 'backline' ? t('backline') : activeRole === 'aircraft' ? 'Aircraft' : activeRole;
                                    setCopyToast(language === 'tr' ? `"${copiedName}" kuralları "${dispName}" şablonuna yapıştırıldı` : `Pasted into "${dispName}"`);
                                    setTimeout(() => setCopyToast(null), 2500);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '5px',
                                    border: copiedBuffer ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                                    background: copiedBuffer ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                                    color: copiedBuffer ? '#60a5fa' : 'var(--text-muted)',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: copiedBuffer ? 'pointer' : 'not-allowed',
                                    opacity: copiedBuffer ? 1 : 0.45,
                                    transition: 'all 0.15s ease'
                                }}
                                title={copiedBuffer ? (language === 'tr' ? `Kopyalanan (${copiedName}) kurallarını bu şablona yapıştır` : `Paste rules from ${copiedName}`) : (language === 'tr' ? 'Önce bir şablon kopyalayın' : 'Copy a template first')}
                            >
                                <ClipboardPaste size={12} />
                                <span>{language === 'tr' ? 'Yapıştır' : 'Paste'}</span>
                                {copiedName && <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>({copiedName})</span>}
                            </button>

                            {copyToast && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', paddingLeft: '0.3rem' }}>
                                    {copyToast}
                                </span>
                            )}
                        </div>

                        {/* Active Template Color Switcher Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.25)', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: templateColors[activeRole] || '#ef4444', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                                {activeRole} {language === 'tr' ? 'Rengi:' : 'Color:'}
                            </span>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                {PRESET_COLORS.map(c => {
                                    const activeColorVal = templateColors[activeRole] || (activeRole === 'frontline' ? '#ef4444' : activeRole === 'backline' ? '#ffffff' : activeRole === 'aircraft' ? '#06b6d4' : '#10b981');
                                    const isSelected = activeColorVal === c;
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={async () => {
                                                const updated = { ...templateColors, [activeRole]: c };
                                                setTemplateColors(updated);
                                                localStorage.setItem('foxhole_template_colors', JSON.stringify(updated));
                                                await dbService.saveTemplateColors(updated);
                                                await onSaveTemplates(localTemplates);
                                            }}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                background: c,
                                                border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)',
                                                cursor: 'pointer',
                                                boxShadow: isSelected ? `0 0 8px ${c}` : 'none'
                                            }}
                                            title={c}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Create Custom Template Area */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    flexWrap: 'wrap',
                    marginTop: '1.25rem',
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(var(--accent-color-rgb), 0.02)',
                    border: '1px dashed rgba(var(--accent-color-rgb), 0.25)',
                    borderRadius: '8px'
                }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {language === 'tr' ? 'YENİ ŞABLON OLUŞTUR:' : 'CREATE CUSTOM TEMPLATE:'}
                    </span>
                    <input
                        type="text"
                        placeholder={language === 'tr' ? 'Şablon adı...' : 'Template name...'}
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="form-control"
                        style={{
                            fontSize: '0.72rem',
                            padding: '0.42rem 0.75rem',
                            borderRadius: '5px',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            maxWidth: '180px',
                            height: '32px'
                        }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Renk:' : 'Color:'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        {PRESET_COLORS.map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setSelectedNewColor(c)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: c,
                                    border: selectedNewColor === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    boxShadow: selectedNewColor === c ? `0 0 8px ${c}` : 'none'
                                }}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const trimmed = newTemplateName.trim();
                            if (!trimmed) {
                                setCreateErrorMsg(language === 'tr' ? 'Lütfen bir şablon adı girin.' : 'Please enter a template name.');
                                return;
                            }
                            if (localTemplates[trimmed]) {
                                setCreateErrorMsg(language === 'tr' ? 'Bu isimde bir şablon zaten mevcut.' : 'A template with this name already exists.');
                                return;
                            }
                            setCreateErrorMsg(null);
                            setLocalTemplates(prev => ({
                                ...prev,
                                [trimmed]: {}
                            }));
                            setTemplateColors(prev => ({
                                ...prev,
                                [trimmed]: selectedNewColor
                            }));
                            setActiveRole(trimmed);
                            setNewTemplateName('');
                        }}
                        className="btn btn-primary"
                        style={{
                            fontSize: '0.72rem',
                            padding: '0.45rem 1rem',
                            borderRadius: '5px',
                            fontWeight: 800,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {language === 'tr' ? 'Oluştur' : 'Create'}
                    </button>
                </div>
                {createErrorMsg && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, marginTop: '0.4rem', paddingLeft: '0.2rem' }}>
                        {createErrorMsg}
                    </div>
                )}
            </div>

            {/* Filter & Item List Container */}
            <div className="table-container">
                <div className="table-actions" style={{ gap: '0.75rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1 }}>
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder={t('search_item_placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Category Filter Pills (Inventory Style) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem', marginTop: '0.85rem', marginBottom: '1.25rem' }}>
                    <button
                        type="button"
                        onClick={toggleAllCategories}
                        onMouseEnter={() => setHoveredCategory('all_master')}
                        onMouseLeave={() => setHoveredCategory(null)}
                        style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: hoveredCategory === 'all_master' 
                                ? 'rgba(255, 255, 255, 0.08)' 
                                : (disabledCategories.size === OFFICIAL_CATEGORIES.length ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.05)'),
                            border: hoveredCategory === 'all_master' 
                                ? '1px solid rgba(255, 255, 255, 0.55)' 
                                : (disabledCategories.size === OFFICIAL_CATEGORIES.length ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(255, 255, 255, 0.18)'),
                            color: disabledCategories.size === OFFICIAL_CATEGORIES.length ? 'var(--text-muted)' : 'var(--text-primary)',
                            opacity: disabledCategories.size === OFFICIAL_CATEGORIES.length && hoveredCategory !== 'all_master' ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            marginRight: '0.25rem'
                        }}
                    >
                        {disabledCategories.size === OFFICIAL_CATEGORIES.length ? <EyeOff size={10} /> : <Eye size={10} />}
                        {language === 'tr' ? 'Tümü' : 'All'}
                    </button>

                    {/* Orange Priority Items Filter Button */}
                    <button
                        type="button"
                        onClick={() => setShowOnlyPriority(prev => !prev)}
                        onMouseEnter={() => setHoveredCategory('priority_only')}
                        onMouseLeave={() => setHoveredCategory(null)}
                        style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            background: showOnlyPriority 
                                ? 'rgba(255, 122, 0, 0.28)' 
                                : (hoveredCategory === 'priority_only' ? 'rgba(255, 122, 0, 0.15)' : 'rgba(255, 122, 0, 0.08)'),
                            border: showOnlyPriority 
                                ? '1px solid #ff7a00' 
                                : (hoveredCategory === 'priority_only' ? '1px solid rgba(255, 122, 0, 0.6)' : '1px solid rgba(255, 122, 0, 0.35)'),
                            color: '#ff7a00',
                            boxShadow: showOnlyPriority ? '0 0 10px rgba(255, 122, 0, 0.4)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            marginRight: '0.35rem'
                        }}
                    >
                        <Star size={11} style={{ fill: showOnlyPriority ? '#ff7a00' : 'transparent', color: '#ff7a00' }} />
                        <span>{language === 'tr' ? 'ÖNCELİKLİ (PRIO)' : 'PRIORITY ITEMS'}</span>
                    </button>

                    {OFFICIAL_CATEGORIES.map(cat => {
                        const isDisabled = disabledCategories.has(cat);
                        const isHovered = hoveredCategory === cat;
                        const catIcon = getCategoryIconUrl(cat);
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategory(cat)}
                                onMouseEnter={() => setHoveredCategory(cat)}
                                onMouseLeave={() => setHoveredCategory(null)}
                                style={{
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '4px',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    background: isHovered 
                                        ? 'rgba(255, 255, 255, 0.08)' 
                                        : (isDisabled ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.05)'),
                                    border: isHovered 
                                        ? '1px solid rgba(255, 255, 255, 0.55)' 
                                        : (isDisabled ? '1px solid rgba(255, 255, 255, 0.07)' : '1px solid rgba(255, 255, 255, 0.18)'),
                                    color: isDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
                                    opacity: isDisabled && !isHovered ? 0.45 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none'
                                }}
                            >
                                {catIcon && (
                                    <img 
                                        src={catIcon} 
                                        alt={cat} 
                                        style={{ 
                                            width: '12px', 
                                            height: '12px', 
                                            objectFit: 'contain',
                                            filter: isDisabled ? 'grayscale(100%) opacity(0.5)' : 'none'
                                        }} 
                                    />
                                )}
                                <span>{t(`cat_${cat}` as TranslationKey)}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Template Stats Summary */}
                <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    padding: '0.6rem 0.85rem', 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-sm)', 
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    fontSize: '0.72rem',
                    alignItems: 'center'
                }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Toplam Malzeme:' : 'Total Items:'}{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>{templateStats.total}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border-color)', height: '12px' }} />
                    <div style={{ color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Aktif Malzemeler:' : 'Active Items:'}{' '}
                        <strong style={{ color: '#10b981' }}>{templateStats.activeCount}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border-color)', height: '12px' }} />
                    <div style={{ color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Yoksayılanlar (0-0):' : 'Ignored (0-0):'}{' '}
                        <strong style={{ color: '#ef4444' }}>{templateStats.ignoredCount}</strong>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Toplam Min Hedef:' : 'Total Min Target:'}{' '}
                        <strong style={{ color: '#38bdf8' }}>{templateStats.totalMin.toLocaleString()}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border-color)', height: '12px' }} />
                    <div style={{ color: 'var(--text-secondary)' }}>
                        {language === 'tr' ? 'Toplam Maks Hedef:' : 'Total Max Target:'}{' '}
                        <strong style={{ color: '#a78bfa' }}>{templateStats.totalMax.toLocaleString()}</strong>
                    </div>
                </div>

                <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{language === 'tr' ? 'Malzeme Adı' : 'Item Name'}</th>
                                <th>{language === 'tr' ? 'Kategori' : 'Category'}</th>
                                <th style={{ width: '130px' }}>{t('min_critical_label')}</th>
                                <th style={{ width: '130px' }}>{t('max_surplus_label')}</th>
                                <th style={{ width: '110px', textAlign: 'center' }}>{language === 'tr' ? 'Öncelik' : 'Priority'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(([itemName, category]) => {
                                const rule = activeRules[itemName] || getDefaultRuleForCategory(category, activeRole);
                                return (
                                    <tr key={itemName}>
                                        <td style={{ 
                                            fontWeight: 700, 
                                            color: rule.isPriority ? '#ff7a00' : 'var(--text-primary)',
                                            transition: 'color 0.15s ease'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                                {getItemIconUrl(itemName) && (
                                                    <img 
                                                        src={getItemIconUrl(itemName)!} 
                                                        alt={itemName} 
                                                        style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} 
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                )}
                                                <span>{itemName}</span>
                                                {rule.isPriority && (
                                                    <span style={{
                                                        fontSize: '0.58rem',
                                                        fontWeight: 800,
                                                        background: 'rgba(255, 122, 0, 0.15)',
                                                        color: '#ff7a00',
                                                        padding: '0.05rem 0.35rem',
                                                        borderRadius: '4px',
                                                        textTransform: 'uppercase',
                                                        border: '1px solid rgba(255, 122, 0, 0.25)',
                                                        letterSpacing: '0.03em',
                                                        flexShrink: 0
                                                    }}>
                                                        PRIO ITEM
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-item">
                                                {t(`cat_${category}` as TranslationKey)}
                                            </span>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min={0}
                                                value={rule.min}
                                                onChange={(e) => handleRuleChange(itemName, 'min', parseInt(e.target.value, 10))}
                                                style={{
                                                    width: '100%',
                                                    background: 'var(--input-bg)',
                                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    padding: '0.4rem 0.6rem',
                                                    color: '#ef4444',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    outline: 'none'
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min={0}
                                                value={rule.max}
                                                onChange={(e) => handleRuleChange(itemName, 'max', parseInt(e.target.value, 10))}
                                                style={{
                                                    width: '100%',
                                                    background: 'var(--input-bg)',
                                                    border: '1px solid rgba(var(--accent-color-rgb), 0.4)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    padding: '0.4rem 0.6rem',
                                                    color: 'var(--accent-color)',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    outline: 'none'
                                                }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleRuleChange(itemName, 'isPriority', rule.isPriority ? false : true)}
                                                style={{
                                                    background: rule.isPriority ? 'rgba(255, 122, 0, 0.12)' : 'rgba(255,255,255,0.02)',
                                                    border: rule.isPriority ? '1px solid #ff7a00' : '1px solid var(--border-color)',
                                                    color: rule.isPriority ? '#ff7a00' : 'var(--text-secondary)',
                                                    borderRadius: '6px',
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    width: '95px',
                                                    display: 'inline-block',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                {rule.isPriority 
                                                    ? (language === 'tr' ? 'ÖNCELİKLİ' : 'PRIORITY') 
                                                    : (language === 'tr' ? 'NORMAL' : 'NORMAL')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
                </>
            )}

            {/* Custom Confirm Modal for Template Deletion */}
            <ConfirmModal
                isOpen={!!templateToDelete}
                title={language === 'tr' ? 'Şablonu Sil' : 'Delete Template'}
                message={language === 'tr' ? `"${templateToDelete}" şablonunu silmek istediğinize emin misiniz?` : `Are you sure you want to delete template "${templateToDelete}"?`}
                onConfirm={() => {
                    if (templateToDelete) {
                        const key = templateToDelete;
                        if (key !== 'frontline' && key !== 'backline' && key !== 'aircraft') {
                            setLocalTemplates(prev => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                            });
                        }
                        if (activeRole === key) {
                            setActiveRole('frontline');
                        }
                    }
                    setTemplateToDelete(null);
                }}
                onCancel={() => setTemplateToDelete(null)}
            />
        </div>
    );
});

StockpileTemplatesTab.displayName = 'StockpileTemplatesTab';
