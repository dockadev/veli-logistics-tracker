import React from 'react';
import { Database, Megaphone, Lock, FileText, ClipboardList, Truck, ArrowLeftRight, BarChart3, Trophy, Lightbulb, ShieldCheck, Sliders, ShieldAlert, MessageSquare, Palette } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { Depot, UserRole } from '../types';

const IS_TAURI = typeof window !== 'undefined' && !!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

const openExternalUrl = async (url: string) => {
    if (IS_TAURI) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch (err) {
            console.error('Failed to open URL via Tauri:', err);
            window.open(url, '_blank');
        }
    } else {
        window.open(url, '_blank');
    }
};

export type AppTabName = 'inventory' | 'passcodes' | 'requests' | 'announcements' | 'dev-portal' | 'analytics' | 'feedback' | 'leaderboard' | 'templates' | 'transfer-calculator' | 'demand' | 'direct-sync' | 'region-management';

interface AppSidebarProps {
    activeTab: AppTabName;
    handleTabChange: (tab: AppTabName) => void;
    userRole: UserRole | null;
    depots: Record<string, Depot>;
    unreadFeedbackCount: number;
    isChatOpen: boolean;
    setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setChatUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    chatUnreadCount: number;
    isPersonalizeOpen: boolean;
    setIsPersonalizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
    userClan: string | null;
}

export const AppSidebar: React.FC<AppSidebarProps> = React.memo(({
    activeTab,
    handleTabChange,
    userRole,
    depots,
    unreadFeedbackCount,
    isChatOpen,
    setIsChatOpen,
    setChatUnreadCount,
    chatUnreadCount,
    isPersonalizeOpen,
    setIsPersonalizeOpen,
    userClan
}) => {
    const { t, language } = useLanguage();

    return (
        <div className="vertical-navigation-sidebar">
                <div className="sidebar-scrollable-content">
                    {IS_TAURI && (
                        <button
                            className={`vertical-nav-btn ${activeTab === 'direct-sync' ? 'active' : ''}`}
                            onClick={() => handleTabChange('direct-sync')}
                            data-tooltip="Direct SAV Sync (New Import Method)"
                            type="button"
                        >
                            <Database size={18} />
                            <span style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                Direct Sync
                                <span style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 800,
                                    background: 'var(--accent-color)',
                                    color: '#000000',
                                    padding: '0.12rem 0.35rem',
                                    borderRadius: '4px',
                                    letterSpacing: '0.04em',
                                    lineHeight: 1,
                                    textTransform: 'uppercase'
                                }}>
                                    NEW
                                </span>
                            </span>
                        </button>
                    )}

                    <div className="sidebar-divider" />

                    {/* 1. Announcements */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'announcements' ? 'active' : ''}`}
                        onClick={() => handleTabChange('announcements')}
                        data-tooltip={t('announcements')}
                    >
                        <Megaphone size={18} />
                        <span>{t('announcements')}</span>
                    </button>

                    {/* 2. Passcodes */}
                    {userRole !== 'recruit' && (
                        <button
                            className={`vertical-nav-btn ${activeTab === 'passcodes' ? 'active' : ''}`}
                            onClick={() => handleTabChange('passcodes')}
                            data-tooltip={t('tab_passcodes')}
                        >
                            <Lock size={18} />
                            <span>{t('tab_passcodes')}</span>
                        </button>
                    )}

                    {/* 3. Inventory */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => handleTabChange('inventory')}
                        data-tooltip={t('tab_inventory')}
                    >
                        <FileText size={18} />
                        <span>{t('tab_inventory')}</span>
                    </button>

                    {/* 4. Demand */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'demand' ? 'active' : ''}`}
                        onClick={() => handleTabChange('demand')}
                        data-tooltip={t('tab_demand')}
                    >
                        <ClipboardList size={18} />
                        <span>{t('tab_demand')}</span>
                    </button>

                    {/* 5. Supply Requests */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => handleTabChange('requests')}
                        data-tooltip={t('tab_supply_requests')}
                    >
                        <Truck size={18} />
                        <span>{t('tab_supply_requests')}</span>
                    </button>

                    {/* 6. Transfer Calculator */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'transfer-calculator' ? 'active' : ''}`}
                        onClick={() => handleTabChange('transfer-calculator')}
                        data-tooltip={t('tab_transfer_calculator')}
                    >
                        <ArrowLeftRight size={18} />
                        <span>{t('tab_transfer_calculator')}</span>
                    </button>

                    {/* 7. Analytics */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => handleTabChange('analytics')}
                        data-tooltip="Analytics"
                    >
                        <BarChart3 size={18} />
                        <span>Analytics</span>
                    </button>

                    {/* 8. Leaderboard */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                        onClick={() => handleTabChange('leaderboard')}
                        data-tooltip={language === 'tr' ? 'Liderlik Tablosu' : 'Leaderboard'}
                    >
                        <Trophy size={18} />
                        <span>{language === 'tr' ? 'Liderlik Tablosu' : 'Leaderboard'}</span>
                    </button>

                    {/* 9. Feedback */}
                    <button
                        className={`vertical-nav-btn ${activeTab === 'feedback' ? 'active' : ''}`}
                        onClick={() => handleTabChange('feedback')}
                        data-tooltip={language === 'tr' ? 'Geri Bildirim' : 'Feedback'}
                    >
                        <Lightbulb size={18} />
                        <span>{language === 'tr' ? 'Geri Bildirim' : 'Feedback'}</span>
                    </button>

                    {/* Management Divider */}
                    <div className="sidebar-divider" />

                    {/* 10. Stockpile Management */}
                    {(userRole === 'developer' || userRole === 'logistics_lead' || userRole === 'officer') && (
                        <button
                            className={`vertical-nav-btn ${activeTab === 'region-management' ? 'active' : ''}`}
                            onClick={() => handleTabChange('region-management')}
                            data-tooltip={t('stockpile_management')}
                        >
                            <ShieldCheck size={18} />
                            <span>{t('stockpile_management')}</span>
                            {Object.values(depots).some(d => !d.isIntegrated) && (
                                <span style={{
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    borderRadius: '10px',
                                    padding: '0.1rem 0.45rem',
                                    marginLeft: 'auto'
                                }}>
                                    {Object.values(depots).filter(d => !d.isIntegrated).length}
                                </span>
                            )}
                        </button>
                    )}

                    {/* 11. Template Management */}
                    {(userRole === 'developer' || userRole === 'logistics_lead') && (
                        <button
                            className={`vertical-nav-btn ${activeTab === 'templates' ? 'active' : ''}`}
                            onClick={() => handleTabChange('templates')}
                            data-tooltip={t('template_management')}
                        >
                            <Sliders size={18} />
                            <span>{t('template_management')}</span>
                        </button>
                    )}

                    {/* 12. Officer+ Menu */}
                    {userRole !== 'member' && (
                        <button
                            className={`vertical-nav-btn dev-portal-nav-btn ${activeTab === 'dev-portal' ? 'active' : ''}`}
                            onClick={() => handleTabChange('dev-portal')}
                            data-tooltip={
                                unreadFeedbackCount > 0
                                    ? (language === 'tr' ? `${unreadFeedbackCount} yeni bildirim` : `${unreadFeedbackCount} new notifications`)
                                    : t('officer_menu')
                            }
                        >
                            <ShieldAlert size={18} />
                            <span>{t('officer_menu')}</span>
                            {unreadFeedbackCount > 0 && (
                                <span className="nav-badge">{unreadFeedbackCount}</span>
                            )}
                        </button>
                    )}

                    <div className="sidebar-divider" />

                    <button
                        className={`vertical-nav-btn ${isChatOpen ? 'active' : ''}`}
                        onClick={() => {
                            const nextState = !isChatOpen;
                            setIsChatOpen(nextState);
                            if (nextState) {
                                setChatUnreadCount(0);
                            }
                            setIsPersonalizeOpen(false);
                        }}
                        data-tooltip={
                            chatUnreadCount > 0
                                ? (chatUnreadCount > 10
                                    ? (language === 'tr' ? '10+ yeni mesaj' : '10+ new messages')
                                    : (language === 'tr' ? `${chatUnreadCount} yeni mesaj` : `${chatUnreadCount} new messages`))
                                : (language === 'tr' ? 'Sohbet' : 'Chat')
                        }
                    >
                        <MessageSquare size={18} />
                        <span>{language === 'tr' ? 'Sohbet' : 'Chat'}</span>
                        {chatUnreadCount > 0 && (
                            <span className="nav-badge">
                                {chatUnreadCount > 10 ? '10+' : chatUnreadCount}
                            </span>
                        )}
                    </button>

                    <button
                        className={`vertical-nav-btn ${isPersonalizeOpen ? 'active' : ''}`}
                        onClick={() => {
                            setIsPersonalizeOpen(!isPersonalizeOpen);
                            setIsChatOpen(false);
                        }}
                        data-tooltip={language === 'tr' ? 'KiÅŸiselleÅŸtir' : 'Personalize'}
                    >
                        <Palette size={18} />
                        <span>{language === 'tr' ? 'KiÅŸiselleÅŸtir' : 'Personalize'}</span>
                        <span className="nav-meta-chip">
                            {language.toUpperCase()}{userClan ? ` Â· ${userClan.toUpperCase()}` : ''}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => openExternalUrl('https://discord.gg/F63C7cqNdF')}
                        className="vertical-nav-btn discord-nav-btn"
                        data-tooltip="VELI"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 127.14 96.36"
                            fill="currentColor"
                            style={{ flexShrink: 0 }}
                        >
                            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.4-5c.87-.64,1.72-1.31,2.53-2a75.76,75.76,0,0,0,72.71,0c.81.7,1.66,1.37,2.53,2a68.43,68.43,0,0,1-10.4,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129,54.65,122.64,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
                        </svg>
                        <span>VELI</span>
                    </button>
                </div>
            </div>
    );
});

AppSidebar.displayName = 'AppSidebar';
