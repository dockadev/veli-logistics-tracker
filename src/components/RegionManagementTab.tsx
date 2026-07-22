import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, MapPin, Key, CheckCircle, AlertCircle, Trash2, User, ChevronDown, ChevronUp, Edit2, Eye, EyeOff, XCircle, Check, X } from 'lucide-react';
import type { Depot, UserRole } from '../types';
import subregionsData from '../utils/foxholeSubregions.json';

interface RegionSubregionSelectProps {
  regionName?: string;
  value: string;
  onChange: (value: string) => void;
}

const RegionSubregionSelect: React.FC<RegionSubregionSelectProps> = ({ regionName, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 170)
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => {
      if (isOpen) updateCoords();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll, true);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  // Match region flexibly (ignoring optional 'The ' prefix)
  const normalizeRegion = (str: string) => str.toLowerCase().replace(/^the\s+/, '').trim();
  const regionKey = regionName 
    ? Object.keys(subregionsData.regions).find(r => normalizeRegion(r) === normalizeRegion(regionName))
    : null;
  const subregionList = (regionKey && (subregionsData.regions as Record<string, string[]>)[regionKey])
    ? (subregionsData.regions as Record<string, string[]>)[regionKey]
    : subregionsData.allSubregionsList;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '170px' }}>
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          width: '100%',
          background: 'rgba(0, 0, 0, 0.35)',
          border: isOpen ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
          borderRadius: '5px',
          padding: '0.35rem 0.6rem',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Select Subregion...'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '4px' }} />
      </button>

      {isOpen && coords && createPortal(
        <div 
          ref={portalRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999999,
            background: '#0e1711',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '6px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.95)',
            padding: '0.35rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {subregionList.length === 0 ? (
            <div style={{ padding: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No subregions
            </div>
          ) : (
            subregionList.map(item => (
              <div
                key={item}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(item);
                  setIsOpen(false);
                }}
                style={{
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.73rem',
                  borderRadius: '4px',
                  color: item === value ? '#10B981' : 'var(--text-primary)',
                  background: item === value ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  cursor: 'pointer',
                  fontWeight: item === value ? 700 : 500
                }}
                onMouseEnter={(e) => { if (item !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { if (item !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                {item}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

interface RegionManagementTabProps {
  depots: Record<string, Depot>;
  userRole: UserRole | null;
  onIntegrateDepot: (depotKey: string, subregion: string, accessCode: string) => void;
  onDeleteDepot: (depotKey: string) => void;
}

export const RegionManagementTab: React.FC<RegionManagementTabProps> = ({
  depots,
  userRole,
  onIntegrateDepot,
  onDeleteDepot
}) => {
  const [subregionInputs, setSubregionInputs] = useState<Record<string, string>>({});
  const [passcodeInputs, setPasscodeInputs] = useState<Record<string, string>>({});
  const [formErrorMap, setFormErrorMap] = useState<Record<string, string>>({});

  // Accordion open/close states
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isIntegratedOpen, setIsIntegratedOpen] = useState(true);

  // Passcode reveal toggles for integrated table
  const [revealedIntegratedCodes, setRevealedIntegratedCodes] = useState<Record<string, boolean>>({});

  // Inline Subregion & Passcode Editing for Integrated Depots
  const [editingDepotKey, setEditingDepotKey] = useState<string | null>(null);
  const [editPasscodeVal, setEditPasscodeVal] = useState('');
  const [editSubregionVal, setEditSubregionVal] = useState('');

  const canManage = userRole === 'developer' || userRole === 'logistics_lead' || userRole === 'officer';

  if (!canManage) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
        <AlertCircle size={36} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Access Restricted</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Only Officers, Logistics Leads, and Developers can access the Storage Management Portal.
        </p>
      </div>
    );
  }

  // Separate depots into Pending Integration and Integrated
  const allDepotsList = Object.entries(depots);
  const pendingDepots = allDepotsList.filter(([, dep]) => !dep.isIntegrated);
  const integratedDepots = allDepotsList.filter(([, dep]) => dep.isIntegrated);

  // Group Integrated Depots by Region, then Subregion/Town, then sort alphabetically by tag
  const groupedIntegratedByRegion = integratedDepots.reduce((acc, [key, dep]) => {
    const parts = dep.name.split(' - ').map(s => s.trim()).filter(Boolean);
    const rawRegion = parts[0] || 'Unknown Region';
    const regionName = (rawRegion === 'The Blemish' || rawRegion === 'The Blemsh') ? 'Blemish' : rawRegion;
    const rawSub = dep.subregion || dep.townName || parts[1] || 'Unassigned Subregion';
    const subregionName = (rawSub === 'The Blemish' || rawSub === 'The Blemsh') ? 'Blemish' : rawSub;

    if (!acc[regionName]) acc[regionName] = {};
    if (!acc[regionName][subregionName]) acc[regionName][subregionName] = [];
    acc[regionName][subregionName].push([key, dep]);
    return acc;
  }, {} as Record<string, Record<string, typeof integratedDepots>>);

  const handlePasscodeChange = (depotKey: string, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '').slice(0, 6);
    setPasscodeInputs(prev => ({ ...prev, [depotKey]: digitsOnly }));
    setFormErrorMap(prev => ({ ...prev, [depotKey]: '' }));
  };

  const handleIntegrate = (depotKey: string) => {
    const dep = depots[depotKey];
    const currentSub = subregionInputs[depotKey] || dep?.subregion || '';
    const currentCode = passcodeInputs[depotKey] || (dep?.accessCode ? dep.accessCode.replace(/\D/g, '').slice(0, 6) : '');

    if (!currentSub.trim()) {
      setFormErrorMap(prev => ({ ...prev, [depotKey]: 'Subregion selection is mandatory before approving!' }));
      return;
    }

    if (!/^\d{6}$/.test(currentCode)) {
      setFormErrorMap(prev => ({ ...prev, [depotKey]: 'Passcode must be exactly 6 numeric digits!' }));
      return;
    }

    setFormErrorMap(prev => ({ ...prev, [depotKey]: '' }));
    onIntegrateDepot(depotKey, currentSub.trim(), currentCode);
  };

  const handleSaveEditInline = (depotKey: string) => {
    const digitsOnly = editPasscodeVal.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(digitsOnly)) {
      setFormErrorMap(prev => ({ ...prev, [depotKey]: 'Passcode must be exactly 6 numeric digits!' }));
      return;
    }
    const selectedSub = editSubregionVal.trim();
    if (!selectedSub) {
      setFormErrorMap(prev => ({ ...prev, [depotKey]: 'Subregion selection is mandatory!' }));
      return;
    }
    setFormErrorMap(prev => ({ ...prev, [depotKey]: '' }));
    onIntegrateDepot(depotKey, selectedSub, digitsOnly);
    setEditingDepotKey(null);
  };

  const formatCleanDepotName = (rawName: string, subregion?: string | null) => {
    const parts = rawName.split(' - ').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) return rawName;

    const region = parts[0];
    let structureType = 'Storage Depot';
    for (const p of parts) {
      const l = p.toLowerCase();
      if (l.includes('seaport') || l.includes('depot') || l.includes('port')) {
        structureType = p;
        break;
      }
    }

    let tag = '';
    const lastPart = parts[parts.length - 1];
    const subLower = (subregion || '').toLowerCase();
    if (lastPart && 
        lastPart.toLowerCase() !== structureType.toLowerCase() && 
        lastPart.toLowerCase() !== region.toLowerCase() && 
        (!subLower || lastPart.toLowerCase() !== subLower)) {
      tag = lastPart;
    }

    return tag ? `${region} - ${structureType} - ${tag}` : `${region} - ${structureType}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Header Bar */}
      <div style={{
        background: 'rgba(28, 38, 28, 0.4)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldCheck size={20} style={{ color: 'var(--accent-color)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            Storage Management
          </h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {pendingDepots.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <AlertCircle size={14} /> Pending Depots Need Onboarding! ({pendingDepots.length})
            </div>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {integratedDepots.length} Integrated Depots
          </span>
        </div>
      </div>

      {/* Stacked Section 1: Pending Integration Queue (Collapsible Accordion) */}
      <div style={{
        background: 'rgba(20, 28, 20, 0.3)',
        border: pendingDepots.length > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'visible',
        position: 'relative'
      }}>
        {/* Accordion Header */}
        <div 
          onClick={() => setIsPendingOpen(!isPendingOpen)}
          style={{
            padding: '0.85rem 1.25rem',
            background: pendingDepots.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(18, 26, 18, 0.5)',
            borderTopLeftRadius: '7px',
            borderTopRightRadius: '7px',
            borderBottomLeftRadius: isPendingOpen ? 0 : '7px',
            borderBottomRightRadius: isPendingOpen ? 0 : '7px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {pendingDepots.length > 0 ? (
              <AlertCircle size={17} style={{ color: '#ef4444' }} />
            ) : (
              <CheckCircle size={17} style={{ color: '#10B981' }} />
            )}
            <h3 style={{ margin: 0, fontSize: '0.92rem', color: pendingDepots.length > 0 ? '#ef4444' : 'var(--text-primary)', fontWeight: 700 }}>
              Pending Integration Queue ({pendingDepots.length})
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isPendingOpen ? 'Click to collapse' : 'Click to expand'}
            </span>
            {isPendingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Accordion Body */}
        {isPendingOpen && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingDepots.length === 0 ? (
              <div style={{
                padding: '1.25rem',
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.15)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle size={18} style={{ color: '#10B981' }} />
                All scanned stockpiles are integrated and approved!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {pendingDepots.map(([depotKey, dep], index) => {
                  const currentSub = subregionInputs[depotKey] || '';
                  const currentCode = passcodeInputs[depotKey] || (dep.accessCode ? dep.accessCode.replace(/\D/g, '').slice(0, 6) : '');
                  const isValidCode = /^\d{6}$/.test(currentCode);
                  const hexRegionName = dep.name.split(' - ')[0] || '';
                  const hasErr = formErrorMap[depotKey];

                  return (
                    <div
                      key={depotKey}
                      style={{
                        position: 'relative',
                        zIndex: pendingDepots.length - index,
                        background: 'rgba(18, 26, 18, 0.6)',
                        border: hasErr ? '1px solid #ef4444' : '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}
                    >
                      {hasErr && (
                        <div style={{ fontSize: '0.73rem', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <XCircle size={14} /> {hasErr}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {/* Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {dep.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: 'var(--accent-color)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <User size={11} /> Scanned by: {dep.lastUpdatedBy || 'Developer'}
                            </span>
                            <span>Items: {Object.keys(dep.current || {}).length}</span>
                            <span>Updated: {new Date(dep.lastUpdated).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        {/* Form inputs */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          {/* Region-Specific Subregion Dropdown */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Subregion:
                            </span>
                            <RegionSubregionSelect
                              regionName={hexRegionName}
                              value={currentSub}
                              onChange={(val) => {
                                setSubregionInputs(prev => ({ ...prev, [depotKey]: val }));
                                setFormErrorMap(prev => ({ ...prev, [depotKey]: '' }));
                              }}
                            />
                          </div>

                          {/* Strict 6-Digit Numeric Passcode Input */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Passcode:
                            </span>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                              <Key size={13} style={{ position: 'absolute', left: '0.5rem', color: isValidCode ? '#10B981' : 'var(--text-muted)' }} />
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="123456"
                                value={currentCode}
                                onChange={(e) => handlePasscodeChange(depotKey, e.target.value)}
                                style={{
                                  background: 'rgba(0, 0, 0, 0.3)',
                                  border: `1px solid ${currentCode && !isValidCode ? '#ef4444' : isValidCode ? '#10B981' : 'var(--border-color)'}`,
                                  borderRadius: '5px',
                                  padding: '0.35rem 0.5rem 0.35rem 1.8rem',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  letterSpacing: '0.1em',
                                  width: '90px',
                                  outline: 'none'
                                }}
                              />
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => handleIntegrate(depotKey)}
                              className="btn btn-primary"
                              style={{
                                padding: '0.4rem 0.85rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDepot(depotKey)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '5px',
                                padding: '0.4rem 0.6rem',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stacked Section 2: Integrated Depots Catalog (Collapsible Accordion Grouped by Region) */}
      <div style={{
        background: 'rgba(20, 28, 20, 0.3)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'visible',
        position: 'relative'
      }}>
        {/* Accordion Header */}
        <div 
          onClick={() => setIsIntegratedOpen(!isIntegratedOpen)}
          style={{
            padding: '0.85rem 1.25rem',
            background: 'rgba(18, 26, 18, 0.5)',
            borderTopLeftRadius: '7px',
            borderTopRightRadius: '7px',
            borderBottomLeftRadius: isIntegratedOpen ? 0 : '7px',
            borderBottomRightRadius: isIntegratedOpen ? 0 : '7px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={17} style={{ color: '#10B981' }} />
            <h3 style={{ margin: 0, fontSize: '0.92rem', color: '#10B981', fontWeight: 700 }}>
              Integrated Depots Catalog ({integratedDepots.length})
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isIntegratedOpen ? 'Click to collapse' : 'Click to expand'}
            </span>
            {isIntegratedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Accordion Body */}
        {isIntegratedOpen && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.keys(groupedIntegratedByRegion).length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No integrated depots found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {Object.entries(groupedIntegratedByRegion).map(([regionName, subregionsMap]) => (
                  /* Region Card separated by prominent WHITE BORDER */
                  <div
                    key={regionName}
                    style={{
                      background: 'rgba(18, 26, 18, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}
                  >
                    {/* Region Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
                      <MapPin size={16} style={{ color: 'var(--accent-color)' }} />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {regionName}
                      </h4>
                    </div>

                    {/* Grouped by Subregion & Sorted Alphabetically */}
                    {Object.entries(subregionsMap).map(([subName, items]) => {
                      const sortedItems = items.slice().sort(([, aDep], [, bDep]) => {
                        const aLabel = aDep.customName || aDep.name;
                        const bLabel = bDep.customName || bDep.name;
                        return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: 'base' });
                      });

                      return (
                        <div key={subName} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: '0.5rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>↳ {subName}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>({sortedItems.length})</span>
                          </div>

                          <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', tableLayout: 'fixed' }}>
                              <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.25)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '0.4rem 0.6rem' }}>Depot Name / Tag</th>
                                  <th style={{ padding: '0.4rem 0.6rem', width: '180px' }}>Subregion</th>
                                  <th style={{ padding: '0.4rem 0.6rem', width: '170px' }}>Passcode</th>
                                  <th style={{ padding: '0.4rem 0.6rem', width: '130px' }}>Last Sync</th>
                                  <th style={{ padding: '0.4rem 0.6rem', width: '130px', textAlign: 'right' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedItems.map(([depotKey, dep]) => {
                                  const isRevealed = !!revealedIntegratedCodes[depotKey];
                                  const isEditing = editingDepotKey === depotKey;

                                  return (
                                    <tr key={depotKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {dep.customName || formatCleanDepotName(dep.name, dep.subregion)}
                                      </td>

                                      {/* Subregion Column */}
                                      <td style={{ padding: '0.4rem 0.6rem', width: '180px' }}>
                                        {isEditing ? (
                                          <RegionSubregionSelect
                                            regionName={dep.name.split(' - ')[0]}
                                            value={editSubregionVal}
                                            onChange={(val) => setEditSubregionVal(val)}
                                          />
                                        ) : (
                                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {dep.subregion || dep.townName || subName || 'Unassigned'}
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Blurred Passcode Column */}
                                      <td style={{ padding: '0.4rem 0.6rem', width: '170px' }}>
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            maxLength={6}
                                            value={editPasscodeVal}
                                            onChange={(e) => setEditPasscodeVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            style={{
                                              background: 'rgba(0,0,0,0.5)',
                                              border: '1px solid #10B981',
                                              borderRadius: '4px',
                                              padding: '0.25rem 0.45rem',
                                              color: '#10B981',
                                              fontFamily: 'monospace',
                                              fontWeight: 800,
                                              width: '75px',
                                              fontSize: '0.78rem',
                                              outline: 'none'
                                            }}
                                          />
                                        ) : (
                                          <span 
                                            onClick={() => setRevealedIntegratedCodes(prev => ({ ...prev, [depotKey]: !prev[depotKey] }))}
                                            style={{ 
                                              fontFamily: 'monospace', 
                                              letterSpacing: '0.12em', 
                                              color: '#10B981', 
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.35rem',
                                              background: 'rgba(0,0,0,0.2)',
                                              padding: '0.2rem 0.5rem',
                                              borderRadius: '4px'
                                            }}
                                          >
                                            {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                            {isRevealed ? (dep.accessCode || '—') : '••••••'}
                                          </span>
                                        )}
                                      </td>

                                      <td style={{ padding: '0.4rem 0.6rem', width: '130px', color: 'var(--text-muted)' }}>
                                        {new Date(dep.lastUpdated).toLocaleTimeString()}
                                      </td>

                                      {/* Action Buttons */}
                                      <td style={{ padding: '0.4rem 0.6rem', width: '130px', textAlign: 'right' }}>
                                        {isEditing ? (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleSaveEditInline(depotKey)}
                                              style={{
                                                background: '#10B981',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '0.3rem 0.55rem',
                                                color: '#08120a',
                                                fontWeight: 800,
                                                fontSize: '0.72rem',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                                              }}
                                            >
                                              <Check size={13} /> Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingDepotKey(null)}
                                              style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '4px',
                                                padding: '0.3rem 0.45rem',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.2rem'
                                              }}
                                            >
                                              <X size={13} />
                                            </button>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingDepotKey(depotKey);
                                                setEditPasscodeVal(dep.accessCode ? dep.accessCode.replace(/\D/g, '') : '');
                                                setEditSubregionVal(dep.subregion || dep.townName || subName || '');
                                              }}
                                              style={{
                                                background: 'rgba(249, 115, 22, 0.1)',
                                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                                borderRadius: '4px',
                                                padding: '0.2rem 0.45rem',
                                                color: 'var(--accent-color)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.2rem',
                                                fontSize: '0.7rem'
                                              }}
                                            >
                                              <Edit2 size={12} /> Edit
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => onDeleteDepot(depotKey)}
                                              style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                borderRadius: '4px',
                                                padding: '0.2rem 0.45rem',
                                                color: '#ef4444',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default RegionManagementTab;
