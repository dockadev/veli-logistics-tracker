import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Copy, Package, ArrowRight, CheckCircle2, Info, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot, StockpileTemplates, VehicleType, PackedContainer, PackedContainerItem, TransferPlan, RegionSettings, UserRole } from '../types';
import { getDepotDisplayName } from '../utils/helpers';
import { getDefaultTemplates } from '../utils/defaultTemplates';
import { ITEM_CATEGORY_MAP, getItemOfficialCategory } from '../utils/itemCategories';
import { COLONIAL_NEUTRAL_ITEMS } from '../utils/colonialItems';
import { CustomSelect } from './CustomSelect';

interface TransferCalculatorTabProps {
    depots?: Record<string, Depot>;
    templates?: StockpileTemplates;
    regionSettings?: RegionSettings;
    userRole?: UserRole;
    onCopyToast?: () => void;
}

export const TransferCalculatorTab: React.FC<TransferCalculatorTabProps> = React.memo(({
    depots = {},
    templates = getDefaultTemplates(),
    regionSettings = {},
    userRole: _userRole,
    onCopyToast
}) => {
    const { t, language } = useLanguage();

    // Helper functions for region/town parsing matching main app logic
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

    // Group depots by Town Groups ("Region - Town")
    const townGroups = useMemo(() => {
        const groups: Record<string, { region: string; town: string; depots: Depot[] }> = {};
        Object.values(depots).forEach(dep => {
            const region = getDepotRegion(dep.name);
            const town = getDepotTown(dep.name, dep.townName) || 'General';
            const groupKey = `${region} - ${town}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = { region, town, depots: [] };
            }
            groups[groupKey].depots.push(dep);
        });
        return groups;
    }, [depots]);


    
    const [sourceRegion, setSourceRegion] = useState<string>('');
    const [targetRegion, setTargetRegion] = useState<string>('');
    const [vehicleType, setVehicleType] = useState<VehicleType>('flatbed');
    const [trainCars, setTrainCars] = useState<number>(10);
    const [copiedManifest, setCopiedManifest] = useState<boolean>(false);
    const [showTransferInfo, setShowTransferInfo] = useState<boolean>(false);
    const [showComparisonInfo, setShowComparisonInfo] = useState<boolean>(false);
    const [containers, setContainers] = useState<PackedContainer[]>([]);
    const [searchQuery, setSearchQuery] = useState<Record<number, string>>({});
    const [showAddMenu, setShowAddMenu] = useState<Record<number, boolean>>({});

    const [logiSearch, setLogiSearch] = useState('');
    const [logiPage, setLogiPage] = useState(1);
    const [logiItemsPerPage, setLogiItemsPerPage] = useState(15);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [sourceSortField, setSourceSortField] = useState<'name' | 'sourceAvail' | 'sourceTarget' | 'sourceDiff'>('name');
    const [sourceSortDirection, setSourceSortDirection] = useState<'none' | 'asc' | 'desc'>('none');
    
    const [targetSortField, setTargetSortField] = useState<'name' | 'targetAvail' | 'targetTarget' | 'targetDiff'>('name');
    const [targetSortDirection, setTargetSortDirection] = useState<'none' | 'asc' | 'desc'>('none');

    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 960);

    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth > 960);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setLogiPage(1);
    }, [logiSearch]);

    const handleSourceSort = (field: typeof sourceSortField) => {
        if (sourceSortField !== field) {
            setSourceSortField(field);
            setSourceSortDirection('asc');
        } else {
            if (sourceSortDirection === 'asc') {
                setSourceSortDirection('desc');
            } else if (sourceSortDirection === 'desc') {
                setSourceSortField('name');
                setSourceSortDirection('none');
            } else {
                setSourceSortDirection('asc');
            }
        }
        setLogiPage(1);
    };

    const handleTargetSort = (field: typeof targetSortField) => {
        if (targetSortField !== field) {
            setTargetSortField(field);
            setTargetSortDirection('asc');
        } else {
            if (targetSortDirection === 'asc') {
                setTargetSortDirection('desc');
            } else if (targetSortDirection === 'desc') {
                setTargetSortField('name');
                setTargetSortDirection('none');
            } else {
                setTargetSortDirection('asc');
            }
        }
        setLogiPage(1);
    };

    const renderSourceSortIcon = (field: typeof sourceSortField) => {
        if (sourceSortField !== field || sourceSortDirection === 'none') {
            return <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'middle' }} />;
        }
        return sourceSortDirection === 'asc' 
            ? <ArrowUp size={12} style={{ marginLeft: '4px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />
            : <ArrowDown size={12} style={{ marginLeft: '4px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />;
    };

    const renderTargetSortIcon = (field: typeof targetSortField) => {
        if (targetSortField !== field || targetSortDirection === 'none') {
            return <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: 0.5, verticalAlign: 'middle' }} />;
        }
        return targetSortDirection === 'asc' 
            ? <ArrowUp size={12} style={{ marginLeft: '4px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />
            : <ArrowDown size={12} style={{ marginLeft: '4px', color: 'var(--accent-color)', verticalAlign: 'middle' }} />;
    };



    const handleUpdateCrateCount = (containerIndex: number, itemName: string, newCount: number) => {
        setContainers(prev => prev.map(c => {
            if (c.containerIndex !== containerIndex) return c;
            const updatedItems = c.items.map(it => {
                if (it.itemName !== itemName) return it;
                return { ...it, count: Math.max(0, newCount) };
            }).filter(it => it.count > 0);
            
            const total = updatedItems.reduce((acc, it) => acc + it.count, 0);
            return {
                ...c,
                items: updatedItems,
                totalCrates: total
            };
        }));
    };

    const handleRemoveItem = (containerIndex: number, itemName: string) => {
        setContainers(prev => prev.map(c => {
            if (c.containerIndex !== containerIndex) return c;
            const updatedItems = c.items.filter(it => it.itemName !== itemName);
            const total = updatedItems.reduce((acc, it) => acc + it.count, 0);
            return {
                ...c,
                items: updatedItems,
                totalCrates: total
            };
        }));
    };

    const handleAddItem = (containerIndex: number, itemName: string) => {
        const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);
        setContainers(prev => prev.map(c => {
            if (c.containerIndex !== containerIndex) return c;
            const exists = c.items.some(it => it.itemName === itemName);
            if (exists) return c;
            
            const updatedItems = [
                ...c.items,
                {
                    itemName,
                    category: category as any,
                    count: 5,
                    isCriticalNeed: false
                }
            ];
            const total = updatedItems.reduce((acc, it) => acc + it.count, 0);
            return {
                ...c,
                items: updatedItems,
                totalCrates: total
            };
        }));
    };

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.popover-trigger') && !target.closest('.popover-card')) {
                setShowTransferInfo(false);
                setShowComparisonInfo(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    // Unique regions extracted from depots list
    const uniqueTownGroups = useMemo(() => {
        return Object.keys(townGroups).sort();
    }, [townGroups]);

    const regionOptions = useMemo(() => {
        return uniqueTownGroups.map(tg => ({
            value: tg,
            label: tg
        }));
    }, [uniqueTownGroups]);

    // Memos for contributing depots
    const sourceContributingDepots = useMemo(() => {
        if (!sourceRegion) return [];
        return townGroups[sourceRegion]?.depots || [];
    }, [townGroups, sourceRegion]);

    const targetContributingDepots = useMemo(() => {
        if (!targetRegion) return [];
        return townGroups[targetRegion]?.depots || [];
    }, [townGroups, targetRegion]);

    const logiItemsWithMetrics = useMemo(() => {
        return Array.from(COLONIAL_NEUTRAL_ITEMS).map(itemName => {
            
            // Source Metrics
            const sourceSetting = regionSettings[sourceRegion] || { regionName: sourceRegion, templateType: 'backline', demandPercentage: 100 };
            const sourceTemplate = templates[sourceSetting.templateType] || {};
            let sourceRule = sourceTemplate[itemName];
            if (!sourceRule) {
                sourceRule = { min: 0, max: 0 };
            }
            const sourceAvail = sourceContributingDepots.reduce((acc, d) => acc + (d.current?.[itemName]?.count || 0), 0);
            const sourceTarget = Math.round(sourceRule.min * (sourceSetting.demandPercentage / 100));
            const sourceDiff = sourceAvail - sourceTarget;

            // Target Metrics
            const targetSetting = regionSettings[targetRegion] || { regionName: targetRegion, templateType: 'backline', demandPercentage: 100 };
            const targetTemplate = templates[targetSetting.templateType] || {};
            let targetRule = targetTemplate[itemName];
            if (!targetRule) {
                targetRule = { min: 0, max: 0 };
            }
            const targetAvail = targetContributingDepots.reduce((acc, d) => acc + (d.current?.[itemName]?.count || 0), 0);
            const targetTarget = Math.round(targetRule.min * (targetSetting.demandPercentage / 100));
            const targetDiff = targetAvail - targetTarget;

            return {
                name: itemName,
                sourceAvail,
                sourceTarget,
                sourceDiff,
                targetAvail,
                targetTarget,
                targetDiff
            };
        });
    }, [regionSettings, sourceRegion, targetRegion, templates, sourceContributingDepots, targetContributingDepots]);

    const filteredSourceLogiItems = useMemo(() => {
        const q = logiSearch.trim().toLowerCase();
        let result = logiItemsWithMetrics;
        if (q) {
            result = result.filter(item => item.name.toLowerCase().includes(q));
        }

        // Apply Sorting
        if (sourceSortField && sourceSortDirection !== 'none') {
            const isAsc = sourceSortDirection === 'asc';
            result = [...result].sort((a, b) => {
                const aVal = a[sourceSortField];
                const bVal = b[sourceSortField];

                if (typeof aVal === 'string') {
                    return isAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
                }
                return isAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
            });
        } else {
            // Default sort: alphabetical by name
            result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    }, [logiItemsWithMetrics, logiSearch, sourceSortField, sourceSortDirection]);

    const filteredTargetLogiItems = useMemo(() => {
        const q = logiSearch.trim().toLowerCase();
        let result = logiItemsWithMetrics;
        if (q) {
            result = result.filter(item => item.name.toLowerCase().includes(q));
        }

        // Apply Sorting
        if (targetSortField && targetSortDirection !== 'none') {
            const isAsc = targetSortDirection === 'asc';
            result = [...result].sort((a, b) => {
                const aVal = a[targetSortField];
                const bVal = b[targetSortField];

                if (typeof aVal === 'string') {
                    return isAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
                }
                return isAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
            });
        } else {
            // Default sort: alphabetical by name
            result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        }

        return result;
    }, [logiItemsWithMetrics, logiSearch, targetSortField, targetSortDirection]);

    const paginatedSourceLogiItems = useMemo(() => {
        const startIdx = (logiPage - 1) * logiItemsPerPage;
        return filteredSourceLogiItems.slice(startIdx, startIdx + logiItemsPerPage);
    }, [filteredSourceLogiItems, logiPage, logiItemsPerPage]);

    const paginatedTargetLogiItems = useMemo(() => {
        const startIdx = (logiPage - 1) * logiItemsPerPage;
        return filteredTargetLogiItems.slice(startIdx, startIdx + logiItemsPerPage);
    }, [filteredTargetLogiItems, logiPage, logiItemsPerPage]);

    const totalLogiPages = useMemo(() => {
        return Math.ceil(filteredSourceLogiItems.length / logiItemsPerPage);
    }, [filteredSourceLogiItems, logiItemsPerPage]);
    // Calculate maximum containers supported by chosen vehicle
    const maxContainers = useMemo(() => {
        if (vehicleType === 'flatbed') return 1;
        if (vehicleType === 'barge') return 5;
        if (vehicleType === 'train') return trainCars;
        return 1;
    }, [vehicleType, trainCars]);

    // Algorithmic Transfer Calculation
    const transferPlan: TransferPlan | null = useMemo(() => {
        if (!sourceRegion || !targetRegion || sourceRegion === targetRegion) {
            return null;
        }

        if (sourceContributingDepots.length === 0 || targetContributingDepots.length === 0) {
            return null;
        }

        // Region settings
        const sourceSetting = regionSettings[sourceRegion] || { regionName: sourceRegion, templateType: 'backline', demandPercentage: 100 };
        const targetSetting = regionSettings[targetRegion] || { regionName: targetRegion, templateType: 'backline', demandPercentage: 100 };

        const sourceTemplate = templates[sourceSetting.templateType] || {};
        const targetTemplate = templates[targetSetting.templateType] || {};

        // Find items that have surplus in source region AND deficit in target region
        interface TransferCandidate {
            itemName: string;
            category: string;
            surplusCrates: number;
            targetDeficit: number;
            criticalUrgencyRatio: number;
            isPriorityItem: boolean;
        }

        const candidates: TransferCandidate[] = [];

        // Iterate all Colonial / Neutral items
        const allItemsList = Array.from(COLONIAL_NEUTRAL_ITEMS);

        allItemsList.forEach(itemName => {
            const category = ITEM_CATEGORY_MAP[itemName] || getItemOfficialCategory(itemName);

            // Sum sourceQty across contributing depots
            const sourceQty = sourceContributingDepots.reduce((acc, d) => acc + (d.current[itemName]?.count || 0), 0);

            let sourceBaseRule = sourceTemplate[itemName];
            if (!sourceBaseRule) {
                sourceBaseRule = { min: 0, max: 0 };
            }

            let targetBaseRule = targetTemplate[itemName];
            if (!targetBaseRule) {
                targetBaseRule = { min: 0, max: 0 };
            }

            // Scale min/max by the region demand percentages and town group count
            const sourceMin = Math.round(sourceBaseRule.min * (sourceSetting.demandPercentage / 100));
            const targetMin = Math.round(targetBaseRule.min * (targetSetting.demandPercentage / 100));
            const targetMax = Math.round(targetBaseRule.max * (targetSetting.demandPercentage / 100));

            // Available surplus from source region
            const availableSurplus = sourceQty > sourceMin ? sourceQty - sourceMin : 0;
            if (availableSurplus <= 0) return;

            // Sum targetQty across contributing depots
            const targetQty = targetContributingDepots.reduce((acc, d) => acc + (d.current[itemName]?.count || 0), 0);

            // Needed in target region up to target max
            const targetDeficit = targetMax > targetQty ? targetMax - targetQty : 0;
            if (targetDeficit <= 0) return;

            const urgencyRatio = targetMin > 0 ? targetQty / targetMin : 1;

            candidates.push({
                itemName,
                category,
                surplusCrates: availableSurplus,
                targetDeficit,
                criticalUrgencyRatio: urgencyRatio,
                isPriorityItem: !!targetBaseRule.isPriority
            });
        });

        // Split candidates into priority items and non-priority items
        const priorityCandidates = candidates.filter(c => c.isPriorityItem);
        const regularCandidates = candidates.filter(c => !c.isPriorityItem);

        // Sort both groups by critical urgency ratio (lowest urgency ratio / most critical first)
        priorityCandidates.sort((a, b) => a.criticalUrgencyRatio - b.criticalUrgencyRatio);
        regularCandidates.sort((a, b) => a.criticalUrgencyRatio - b.criticalUrgencyRatio);

        if (priorityCandidates.length === 0 && regularCandidates.length === 0) {
            return {
                sourceDepotName: sourceRegion,
                targetDepotName: targetRegion,
                vehicleType,
                containers: [],
                totalCrates: 0,
                priorityItemsCount: 0,
                itemsMovedCount: 0
            };
        }

        // Rotate only regular candidates on refresh trigger
        let rotatedRegularCandidates = [...regularCandidates];
        if (refreshTrigger > 0 && rotatedRegularCandidates.length > 0) {
            const shift = (refreshTrigger * 5) % rotatedRegularCandidates.length;
            rotatedRegularCandidates = [
                ...rotatedRegularCandidates.slice(shift),
                ...rotatedRegularCandidates.slice(0, shift)
            ];
        }

        // Merge: Priority items are always at the top and never shuffled
        const finalCandidates = [...priorityCandidates, ...rotatedRegularCandidates];

        // Pack items into 60-crate containers
        const computedContainers: PackedContainer[] = [];
        let currentContainerItems: PackedContainerItem[] = [];
        let currentContainerCrates = 0;
        let containerIndex = 1;
        let totalPackedCrates = 0;
        let priorityItemsCount = 0;
        const packedItemsSet = new Set<string>();

        for (const candidate of finalCandidates) {
            if (computedContainers.length >= maxContainers) break;

            let removableFromSource = candidate.surplusCrates;
            let neededByTarget = candidate.targetDeficit;
            let quantityToPack = Math.min(removableFromSource, neededByTarget);

            if (quantityToPack < 5) continue;

            while (quantityToPack > 0 && computedContainers.length < maxContainers) {
                const spaceInCurrentContainer = 60 - currentContainerCrates;
                let packAmount = Math.min(quantityToPack, spaceInCurrentContainer);

                const isCriticalNeed = candidate.criticalUrgencyRatio < 1;
                if (isCriticalNeed) {
                    priorityItemsCount += packAmount;
                }
                packedItemsSet.add(candidate.itemName);

                const existingItem = currentContainerItems.find(it => it.itemName === candidate.itemName);
                if (existingItem) {
                    existingItem.count += packAmount;
                } else {
                    currentContainerItems.push({
                        itemName: candidate.itemName,
                        category: candidate.category as any,
                        count: packAmount,
                        isCriticalNeed,
                        isPriorityItem: candidate.isPriorityItem
                    });
                }

                currentContainerCrates += packAmount;
                quantityToPack -= packAmount;
                totalPackedCrates += packAmount;

                const getHasCriticalPriority = (items: PackedContainerItem[]) => {
                    return items.some(it => !!it.isPriorityItem);
                };

                if (currentContainerCrates === 60) {
                    computedContainers.push({
                        containerIndex,
                        items: currentContainerItems,
                        totalCrates: 60,
                        hasCriticalPriority: getHasCriticalPriority(currentContainerItems)
                    });
                    containerIndex++;
                    currentContainerItems = [];
                    currentContainerCrates = 0;
                }
            }
        }

        const getHasCriticalPriority = (items: PackedContainerItem[]) => {
            return items.some(it => !!it.isPriorityItem);
        };

        // Add remaining partially filled container if any
        if (currentContainerItems.length > 0 && computedContainers.length < maxContainers) {
            computedContainers.push({
                containerIndex,
                items: currentContainerItems,
                totalCrates: currentContainerCrates,
                hasCriticalPriority: getHasCriticalPriority(currentContainerItems)
            });
        }

        return {
            sourceDepotName: sourceRegion,
            targetDepotName: targetRegion,
            vehicleType,
            containers: computedContainers,
            totalCrates: totalPackedCrates,
            priorityItemsCount,
            itemsMovedCount: packedItemsSet.size
        };
    }, [sourceRegion, targetRegion, depots, templates, regionSettings, vehicleType, trainCars, maxContainers, sourceContributingDepots, targetContributingDepots, refreshTrigger]);

    useEffect(() => {
        if (transferPlan) {
            setContainers(transferPlan.containers.map(c => ({
                ...c,
                items: c.items.map(it => ({ ...it }))
            })));
        } else {
            setContainers([]);
        }
    }, [transferPlan]);

    const handleRefreshPlan = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    // Copy formatted shipping plan to clipboard without emojis
    const handleCopyManifest = () => {
        if (!transferPlan || containers.length === 0) return;

        const isTr = language === 'tr';
        const titleText = isTr ? 'Lojistik Sevkiyat Planı' : 'Logistics Shipping Plan';
        const vehicleLabel = isTr ? 'Araç' : 'Vehicle';
        const totalLabel = isTr ? 'Toplam' : 'Total';
        const cratesLabel = isTr ? 'kasa' : 'crates';
        const containerLabel = isTr ? 'konteyner' : 'container(s)';
        const containerHeader = isTr ? 'Konteyner' : 'Container';

        const totalCrates = containers.reduce((acc, c) => acc + c.totalCrates, 0);

        const lines = [
            `## ${titleText} [${transferPlan.sourceDepotName} -> ${transferPlan.targetDepotName}]`,
            `${vehicleLabel}: ${transferPlan.vehicleType.toUpperCase()} | ${totalLabel}: ${totalCrates} ${cratesLabel} (${containers.length} ${containerLabel})\n`
        ];

        containers.forEach(c => {
            lines.push(`### ${containerHeader} #${c.containerIndex} (${c.totalCrates}/60 ${cratesLabel}):`);
            c.items.forEach(it => {
                const critTag = it.isCriticalNeed ? (isTr ? ' [Kritik]' : ' [Critical]') : '';
                lines.push(`- ${it.count}x ${it.itemName}${critTag}`);
            });
            lines.push('');
        });

        navigator.clipboard.writeText(lines.join('\n').trim());
        setCopiedManifest(true);
        if (onCopyToast) onCopyToast();
        setTimeout(() => setCopiedManifest(false), 2500);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Header Title Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', background: 'rgba(var(--accent-color-rgb), 0.12)', borderRadius: '10px', color: 'var(--accent-color)' }}>
                        <Truck size={22} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                {t('transfer_calculator_title')}
                            </h2>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {t('transfer_calculator_desc')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Selectors Panel */}
            <div className="panel-card" style={{ position: 'relative', padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ position: 'absolute', top: '0.85rem', right: '0.85rem', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <button
                            type="button"
                            className="popover-trigger"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowTransferInfo(!showTransferInfo);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: showTransferInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s'
                            }}
                        >
                            <Info size={16} />
                        </button>
                        {showTransferInfo && (
                            <div className="popover-card" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
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
                                boxShadow: '0 10px 20px rgba(0,0,0,0.6)'
                            }}>
                                <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                    {t('info_transfer_title')}
                                </strong>
                                <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <li>{t('info_transfer_bullet1')}</li>
                                    <li>{t('info_transfer_bullet2')}</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
                {/* Depot Selectors with Arrow */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.5rem',
                    marginBottom: '1.5rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ flex: '1', minWidth: '260px', maxWidth: '400px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block', fontWeight: 600, textAlign: 'center' }}>
                            {language === 'tr' ? 'Başlangıç Bölgesi - Kasaba (Kaynak)' : 'Source Region - Town (Origin)'}
                        </label>
                        <CustomSelect
                            options={regionOptions}
                            value={sourceRegion}
                            onChange={setSourceRegion}
                            placeholder={language === 'tr' ? 'Bölge - Kasaba Seçin' : 'Select Region - Town'}
                        />
                        {sourceRegion && (
                            <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                                {(() => {
                                    const setting = regionSettings[sourceRegion] || { regionName: sourceRegion, templateType: 'backline', demandPercentage: 100 };
                                    const type = setting.templateType;
                                    return (
                                        <span style={{
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            background: type === 'frontline' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                            color: type === 'frontline' ? '#ef4444' : '#a855f7',
                                            border: type === 'frontline' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)'
                                        }}>
                                            {type === 'frontline' 
                                                ? (language === 'tr' ? 'ÖN CEPHE (FRONTLINE)' : 'FRONTLINE') 
                                                : (language === 'tr' ? 'GERİ CEPHE (BACKLINE)' : 'BACKLINE')}
                                        </span>
                                    );
                                })()}
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {sourceContributingDepots.map(d => (
                                        <span key={d.name} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                            {getDepotDisplayName(d)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-color)',
                        paddingTop: '1.25rem',
                        alignSelf: 'center',
                        minWidth: '24px'
                    }}>
                        <ArrowRight size={24} style={{ filter: 'drop-shadow(0 0 8px rgba(var(--accent-color-rgb), 0.5))' }} />
                    </div>

                    <div style={{ flex: '1', minWidth: '260px', maxWidth: '400px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block', fontWeight: 600, textAlign: 'center' }}>
                            {language === 'tr' ? 'Varış Bölgesi - Kasaba (Hedef)' : 'Destination Region - Town (Target)'}
                        </label>
                        <CustomSelect
                            options={regionOptions}
                            value={targetRegion}
                            onChange={setTargetRegion}
                            placeholder={language === 'tr' ? 'Bölge - Kasaba Seçin' : 'Select Region - Town'}
                        />
                        {targetRegion && (
                            <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                                {(() => {
                                    const setting = regionSettings[targetRegion] || { regionName: targetRegion, templateType: 'backline', demandPercentage: 100 };
                                    const type = setting.templateType;
                                    return (
                                        <span style={{
                                            fontSize: '0.62rem',
                                            fontWeight: 800,
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                            background: type === 'frontline' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                            color: type === 'frontline' ? '#ef4444' : '#a855f7',
                                            border: type === 'frontline' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)'
                                        }}>
                                            {type === 'frontline' 
                                                ? (language === 'tr' ? 'ÖN CEPHE (FRONTLINE)' : 'FRONTLINE') 
                                                : (language === 'tr' ? 'GERİ CEPHE (BACKLINE)' : 'BACKLINE')}
                                        </span>
                                    );
                                })()}
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {targetContributingDepots.map(d => (
                                        <span key={d.name} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                            {getDepotDisplayName(d)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vehicle Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block', fontWeight: 700 }}>
                            {language === 'tr' ? 'Taşıma Aracı Seçimi' : 'Vehicle Selection'}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setVehicleType('flatbed')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '0.25rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    border: vehicleType === 'flatbed' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: vehicleType === 'flatbed' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                    color: vehicleType === 'flatbed' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: vehicleType === 'flatbed' ? '0 0 15px rgba(var(--accent-color-rgb), 0.25)' : 'none'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: vehicleType === 'flatbed' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                                    Flatbed
                                </span>
                                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                                    {language === 'tr' ? '1 Konteyner (60 Kutu)' : '1 Container (60 Crates)'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setVehicleType('barge')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '0.25rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    border: vehicleType === 'barge' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: vehicleType === 'barge' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                    color: vehicleType === 'barge' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: vehicleType === 'barge' ? '0 0 15px rgba(var(--accent-color-rgb), 0.25)' : 'none'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: vehicleType === 'barge' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                                    {language === 'tr' ? 'Demir Gemi / Ironship' : 'Freighter / Ironship'}
                                </span>
                                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                                    {language === 'tr' ? '5 Konteyner (300 Kutu)' : '5 Containers (300 Crates)'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setVehicleType('train')}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '0.25rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    border: vehicleType === 'train' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: vehicleType === 'train' ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                    color: vehicleType === 'train' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: vehicleType === 'train' ? '0 0 15px rgba(var(--accent-color-rgb), 0.25)' : 'none'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: vehicleType === 'train' ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                                    {language === 'tr' ? 'Lojistik Treni' : 'Logistics Train'}
                                </span>
                                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                                    {language === 'tr' ? `8 - 14 Vagon (${trainCars * 60} Kutu)` : `8 - 14 Wagons (${trainCars * 60} Crates)`}
                                </span>
                            </button>
                        </div>
                    </div>

                    {vehicleType === 'train' && (
                        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(var(--accent-color-rgb), 0.2)', padding: '1rem', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                                    {language === 'tr' ? 'Vagon Sayısı (8 - 14)' : 'Wagon Count (8 - 14)'}
                                </label>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-heading)' }}>
                                    {language === 'tr' ? `${trainCars} Vagon (${trainCars * 60} Kutu Kapasitesi)` : `${trainCars} Wagons (${trainCars * 60} Crates Capacity)`}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={8}
                                max={14}
                                step={1}
                                value={trainCars}
                                onChange={(e) => setTrainCars(parseInt(e.target.value, 10))}
                                style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer', height: '6px' }}
                            />
                        </div>
                    )}
                </div>

                {/* Calculation Results */}
                {containers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(var(--accent-color-rgb), 0.2)', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'var(--font-heading)' }}>
                                    {t('transfer_manifest_title')}
                                </span>
                                <span style={{ fontSize: '0.68rem', background: 'rgba(var(--accent-color-rgb), 0.15)', color: 'var(--accent-color)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                    {language === 'tr'
                                        ? `${containers.reduce((acc, c) => acc + c.totalCrates, 0)} Kutu (${containers.length} Konteyner)`
                                        : `${containers.reduce((acc, c) => acc + c.totalCrates, 0)} Crates (${containers.length} Containers)`}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleRefreshPlan}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700 }}
                                >
                                    <RotateCcw size={14} />
                                    <span>{language === 'tr' ? 'Planı Yenile' : 'Refresh Plan'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleCopyManifest}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800 }}
                                >
                                    {copiedManifest ? <CheckCircle2 size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                                    <span>{copiedManifest ? t('manifest_copied') : t('copy_manifest')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Container Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.85rem' }}>
                            {containers.map(container => (
                                <div
                                    key={container.containerIndex}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: container.totalCrates > 60 
                                            ? '1px solid #ef4444' 
                                            : container.hasCriticalPriority 
                                                ? '2px solid #ff7a00' 
                                                : '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        position: 'relative',
                                        boxShadow: container.hasCriticalPriority ? '0 0 10px rgba(255, 122, 0, 0.15)' : undefined
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center' }}>
                                            <Package size={14} style={{ display: 'inline', marginRight: '4px', color: container.totalCrates > 60 ? '#ef4444' : container.hasCriticalPriority ? '#ff7a00' : 'var(--accent-color)' }} />
                                            {t('container_header')} #{container.containerIndex}
                                            {container.hasCriticalPriority && (
                                                <span style={{
                                                    fontSize: '0.58rem',
                                                    fontWeight: 800,
                                                    background: 'rgba(255, 122, 0, 0.15)',
                                                    color: '#ff7a00',
                                                    padding: '0.08rem 0.35rem',
                                                    borderRadius: '4px',
                                                    marginLeft: '0.5rem',
                                                    textTransform: 'uppercase',
                                                    border: '1px solid rgba(255, 122, 0, 0.25)',
                                                    letterSpacing: '0.03em'
                                                }}>
                                                    {language === 'tr' ? 'Öncelikli' : 'Priority'}
                                                </span>
                                            )}
                                        </span>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: container.totalCrates > 60 ? '#ef4444' : 'var(--accent-color)' }}>
                                            {container.totalCrates}/60 {language === 'tr' ? 'Kutu' : 'Crates'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                        {container.items.map((it, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
                                                    {it.isCriticalNeed && (
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} title={language === 'tr' ? 'Kritik İhtiyaç' : 'Critical Need'} />
                                                    )}
                                                    <span style={{ 
                                                        color: it.isPriorityItem ? '#ff7a00' : 'var(--text-primary)', 
                                                        fontWeight: it.isPriorityItem ? 800 : 600, 
                                                        overflow: 'hidden', 
                                                        textOverflow: 'ellipsis' 
                                                    }}>
                                                        {it.itemName}
                                                        {it.isPriorityItem && ' (PRIO)'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateCrateCount(container.containerIndex, it.itemName, it.count - 1)}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '3px', fontSize: '0.65rem' }}
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="no-spinner"
                                                        value={it.count}
                                                        onChange={(e) => handleUpdateCrateCount(container.containerIndex, it.itemName, parseInt(e.target.value, 10) || 0)}
                                                        style={{ width: '38px', textAlign: 'center', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.68rem', borderRadius: '3px', padding: '0 1px' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateCrateCount(container.containerIndex, it.itemName, it.count + 1)}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '3px', fontSize: '0.65rem' }}
                                                    >
                                                        +
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(container.containerIndex, it.itemName)}
                                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', marginLeft: '0.15rem' }}
                                                        title={language === 'tr' ? 'Sil' : 'Delete'}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Inline Add Item Form inside Container Card */}
                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.05)', position: 'relative' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                className="input-compact"
                                                placeholder={language === 'tr' ? 'Öğe Ekle...' : 'Add Item...'}
                                                value={searchQuery[container.containerIndex] || ''}
                                                onChange={(e) => setSearchQuery(prev => ({ ...prev, [container.containerIndex]: e.target.value }))}
                                                onFocus={() => setShowAddMenu(prev => ({ ...prev, [container.containerIndex]: true }))}
                                                style={{ flex: 1 }}
                                            />
                                            {(searchQuery[container.containerIndex] || showAddMenu[container.containerIndex]) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchQuery(prev => ({ ...prev, [container.containerIndex]: '' }));
                                                        setShowAddMenu(prev => ({ ...prev, [container.containerIndex]: false }));
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.65rem' }}
                                                >
                                                    {language === 'tr' ? 'Kapat' : 'Close'}
                                                </button>
                                            )}
                                        </div>
                                        {showAddMenu[container.containerIndex] && (searchQuery[container.containerIndex] || '').trim().length >= 1 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '100%',
                                                left: 0,
                                                zIndex: 100,
                                                maxHeight: '150px',
                                                overflowY: 'auto',
                                                background: 'rgba(20, 20, 23, 0.98)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '4px',
                                                width: '100%',
                                                boxShadow: '0 -4px 10px rgba(0,0,0,0.5)',
                                                marginBottom: '4px'
                                            }}>
                                                {Array.from(COLONIAL_NEUTRAL_ITEMS)
                                                    .filter(itemName => {
                                                        const query = (searchQuery[container.containerIndex] || '').toLowerCase();
                                                        const matchesQuery = itemName.toLowerCase().includes(query);
                                                        const alreadyInContainer = container.items.some(it => it.itemName === itemName);
                                                        return matchesQuery && !alreadyInContainer;
                                                    })
                                                    .slice(0, 10)
                                                    .map(itemName => (
                                                        <div
                                                            key={itemName}
                                                            onClick={() => {
                                                                handleAddItem(container.containerIndex, itemName);
                                                                setSearchQuery(prev => ({ ...prev, [container.containerIndex]: '' }));
                                                                setShowAddMenu(prev => ({ ...prev, [container.containerIndex]: false }));
                                                            }}
                                                            style={{ padding: '4px 8px', fontSize: '0.68rem', color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(var(--accent-color-rgb), 0.15)')}
                                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                        >
                                                            {itemName}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : sourceRegion && targetRegion ? (
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        {t('no_surplus_available')}
                    </div>
                ) : (
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        <ArrowRight size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        {t('select_active_depot')}
                    </div>
                )}
            </div>
            {/* Side-by-Side Regional Logi Comparison View */}
            <div className="panel-card" style={{ marginTop: '0', padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Truck size={16} style={{ color: 'var(--accent-color)' }} />
                            <span>{language === 'tr' ? 'Bölgesel Lojistik Stok Karşılaştırması' : 'Regional Logistics Stock Comparison'}</span>
                        </h3>
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="popover-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowComparisonInfo(!showComparisonInfo);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: showComparisonInfo ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s'
                                }}
                            >
                                <Info size={14} />
                            </button>
                            {showComparisonInfo && (
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
                                    fontWeight: 'normal',
                                    textAlign: 'left'
                                }}>
                                    <strong style={{ color: 'var(--accent-color)', display: 'block', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
                                        {t('info_comparison_title')}
                                    </strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <li>{t('info_comparison_bullet1')}</li>
                                        <li>{t('info_comparison_bullet2')}</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    {sourceRegion && targetRegion && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="input-standard"
                                placeholder={language === 'tr' ? 'Malzeme ara...' : 'Search items...'}
                                value={logiSearch}
                                onChange={(e) => setLogiSearch(e.target.value)}
                                style={{
                                    fontSize: '0.72rem',
                                    padding: '0.35rem 0.65rem',
                                    width: '160px'
                                }}
                            />
                            <div style={{ width: '100px' }}>
                                <CustomSelect
                                    value={String(logiItemsPerPage)}
                                    onChange={(val) => {
                                        setLogiItemsPerPage(parseInt(val, 10));
                                        setLogiPage(1);
                                    }}
                                    options={[
                                        { value: '15', label: language === 'tr' ? '15 Satır' : '15 Rows' },
                                        { value: '25', label: language === 'tr' ? '25 Satır' : '25 Rows' },
                                        { value: '50', label: language === 'tr' ? '50 Satır' : '50 Rows' }
                                    ]}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {sourceRegion && targetRegion ? (
                    <>
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                            {/* Source Region Table */}
                            <div style={{ flex: '1 1 380px', background: 'rgba(0, 0, 0, 0.12)', borderRadius: '6px', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {sourceRegion} ({language === 'tr' ? 'Kaynak' : 'Source'})
                                    </span>
                                    {(() => {
                                        const setting = regionSettings[sourceRegion] || { regionName: sourceRegion, templateType: 'backline', demandPercentage: 100 };
                                        const type = setting.templateType;
                                        return (
                                            <span style={{
                                                fontSize: '0.62rem',
                                                fontWeight: 700,
                                                padding: '0.15rem 0.45rem',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                background: type === 'frontline' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                                                color: type === 'frontline' ? '#ef4444' : '#a855f7',
                                                border: type === 'frontline' ? '1px solid rgba(239, 68, 68, 0.22)' : '1px solid rgba(168, 85, 247, 0.22)'
                                            }}>
                                                {type}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div style={{ overflowX: 'auto', flex: 1 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <th 
                                                    style={{ textAlign: 'left', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleSourceSort('name')}
                                                >
                                                    {language === 'tr' ? 'Malzeme Adı' : 'Item Name'}
                                                    {renderSourceSortIcon('name')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '75px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleSourceSort('sourceAvail')}
                                                >
                                                    {language === 'tr' ? 'Mevcut' : 'Available'}
                                                    {renderSourceSortIcon('sourceAvail')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '75px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleSourceSort('sourceTarget')}
                                                >
                                                    {language === 'tr' ? 'Hedef' : 'Target'}
                                                    {renderSourceSortIcon('sourceTarget')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '120px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleSourceSort('sourceDiff')}
                                                >
                                                    {language === 'tr' ? 'Fark / İhtiyaç' : 'Diff / Needed'}
                                                    {renderSourceSortIcon('sourceDiff')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedSourceLogiItems.map(item => {
                                                const needed = item.sourceDiff;

                                                let neededStyle = { color: 'var(--text-secondary)', fontWeight: 600 };
                                                let neededLabel = `0 (${language === 'tr' ? 'Tamam' : 'Optimal'})`;
                                                if (needed > 0) {
                                                    neededStyle = { color: '#10b981', fontWeight: 700 };
                                                    neededLabel = `+${needed} (${language === 'tr' ? 'Fazla' : 'Surplus'})`;
                                                } else if (needed < 0) {
                                                    neededStyle = { color: '#ef4444', fontWeight: 700 };
                                                    neededLabel = `${needed} (${language === 'tr' ? 'Eksik' : 'Shortage'})`;
                                                }

                                                return (
                                                    <tr key={item.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                        <td style={{ padding: '0.35rem 0.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.sourceAvail}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.sourceTarget}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', ...neededStyle }}>{neededLabel}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Divider Line */}
                            {isLargeScreen && (
                                <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch' }} />
                            )}

                            {/* Target Region Table */}
                            <div style={{ flex: '1 1 380px', background: 'rgba(0, 0, 0, 0.12)', borderRadius: '6px', padding: '0.85rem', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {targetRegion} ({language === 'tr' ? 'Hedef' : 'Target'})
                                    </span>
                                    {(() => {
                                        const setting = regionSettings[targetRegion] || { regionName: targetRegion, templateType: 'backline', demandPercentage: 100 };
                                        const type = setting.templateType;
                                        return (
                                            <span style={{
                                                fontSize: '0.62rem',
                                                fontWeight: 700,
                                                padding: '0.15rem 0.45rem',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                                background: type === 'frontline' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                                                color: type === 'frontline' ? '#ef4444' : '#a855f7',
                                                border: type === 'frontline' ? '1px solid rgba(239, 68, 68, 0.22)' : '1px solid rgba(168, 85, 247, 0.22)'
                                            }}>
                                                {type}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div style={{ overflowX: 'auto', flex: 1 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <th 
                                                    style={{ textAlign: 'left', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleTargetSort('name')}
                                                >
                                                    {language === 'tr' ? 'Malzeme Adı' : 'Item Name'}
                                                    {renderTargetSortIcon('name')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '75px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleTargetSort('targetAvail')}
                                                >
                                                    {language === 'tr' ? 'Mevcut' : 'Available'}
                                                    {renderTargetSortIcon('targetAvail')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '75px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleTargetSort('targetTarget')}
                                                >
                                                    {language === 'tr' ? 'Hedef' : 'Target'}
                                                    {renderTargetSortIcon('targetTarget')}
                                                </th>
                                                <th 
                                                    style={{ textAlign: 'right', padding: '0.35rem 0.25rem', color: 'var(--text-secondary)', width: '120px', cursor: 'pointer', userSelect: 'none' }}
                                                    onClick={() => handleTargetSort('targetDiff')}
                                                >
                                                    {language === 'tr' ? 'Fark / İhtiyaç' : 'Diff / Needed'}
                                                    {renderTargetSortIcon('targetDiff')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedTargetLogiItems.map(item => {
                                                const needed = item.targetDiff;

                                                let neededStyle = { color: 'var(--text-secondary)', fontWeight: 600 };
                                                let neededLabel = `0 (${language === 'tr' ? 'Tamam' : 'Optimal'})`;
                                                if (needed > 0) {
                                                    neededStyle = { color: '#10b981', fontWeight: 700 };
                                                    neededLabel = `+${needed} (${language === 'tr' ? 'Fazla' : 'Surplus'})`;
                                                } else if (needed < 0) {
                                                    neededStyle = { color: '#ef4444', fontWeight: 700 };
                                                    neededLabel = `${needed} (${language === 'tr' ? 'Eksik' : 'Shortage'})`;
                                                }

                                                return (
                                                    <tr key={item.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                        <td style={{ padding: '0.35rem 0.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.targetAvail}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.targetTarget}</td>
                                                        <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', ...neededStyle }}>{neededLabel}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {totalLogiPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    disabled={logiPage === 1}
                                    onClick={() => setLogiPage(prev => Math.max(1, prev - 1))}
                                    style={{
                                        fontSize: '0.72rem',
                                        padding: '0.25rem 0.55rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        color: logiPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                                        cursor: logiPage === 1 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {language === 'tr' ? 'Önceki' : 'Prev'}
                                </button>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    {language === 'tr' ? `Sayfa ${logiPage} / ${totalLogiPages}` : `Page ${logiPage} of ${totalLogiPages}`}
                                </span>
                                <button
                                    type="button"
                                    disabled={logiPage === totalLogiPages}
                                    onClick={() => setLogiPage(prev => Math.min(totalLogiPages, prev + 1))}
                                    style={{
                                        fontSize: '0.72rem',
                                        padding: '0.25rem 0.55rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        color: logiPage === totalLogiPages ? 'var(--text-muted)' : 'var(--text-primary)',
                                        cursor: logiPage === totalLogiPages ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {language === 'tr' ? 'Sonraki' : 'Next'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.1)', border: '1px dashed var(--border-color)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {language === 'tr' ? 'Karşılaştırma için lütfen kaynak ve hedef bölgeleri seçin.' : 'Please select source and target regions to see the stock comparison.'}
                    </div>
                )}
            </div>
        </div>
    );
});
