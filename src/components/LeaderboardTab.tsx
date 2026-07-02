import React, { useMemo } from 'react';
import { Trophy, Award, Info, Medal, Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { PortalUser } from '../types';

interface LeaderboardTabProps {
    portalUsers?: PortalUser[];
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = React.memo(({
    portalUsers = []
}) => {
    const { language } = useLanguage();

    // Multi-language local translations
    const translations: Record<string, Record<string, string>> = {
        tr: {
            leaderboard_title: 'KATKI LİDERLİK TABLOSU',
            leaderboard_subtitle: 'Mevcut savaş boyunca en aktif üyelerin sıralamaları',
            importers: 'En Çok CSV Aktaranlar',
            creators: 'En Çok Talep Açanlar',
            deliverers: 'En Çok Teslimat Yapanlar',
            no_rankings: 'Henüz bu kategoride katkı puanı olan üye bulunmuyor.'
        },
        en: {
            leaderboard_title: 'CONTRIBUTION LEADERBOARD',
            leaderboard_subtitle: 'Rankings of the most active members during the current war',
            importers: 'Top CSV Importers',
            creators: 'Top Request Creators',
            deliverers: 'Top Deliverers',
            no_rankings: 'No members with contribution points in this category yet.'
        },
        pt: {
            leaderboard_title: 'CLASSIFICAÇÃO DE CONTRIBUIÇÃO',
            leaderboard_subtitle: 'Rankings dos membros mais ativos durante a guerra atual',
            importers: 'Principais Importadores de CSV',
            creators: 'Principais Criadores de Pedidos',
            deliverers: 'Principais Entregadores',
            no_rankings: 'Nenhum membro com pontos de contribuição nesta categoria ainda.'
        },
        ru: {
            leaderboard_title: 'ТАБЛИЦА ЛИДЕРОВ ВКЛАДА',
            leaderboard_subtitle: 'Рейтинги наиболее активных участников в текущей войне',
            importers: 'Лучшие импортеры CSV',
            creators: 'Лучшие создатели запросов',
            deliverers: 'Лучшие доставщики',
            no_rankings: 'В этой категории пока нет участников с очками вклада.'
        },
        de: {
            leaderboard_title: 'BEITRAGS-RANGLISTE',
            leaderboard_subtitle: 'Ranglisten der aktivsten Mitglieder im aktuellen Krieg',
            importers: 'Top-CSV-Importeure',
            creators: 'Top-Ersteller von Anfragen',
            deliverers: 'Top-Lieferanten',
            no_rankings: 'Noch keine Mitglieder mit Beitragspunkten in dieser Kategorie.'
        }
    };

    const t = (key: string): string => {
        const lang = translations[language] ? language : 'en';
        return translations[lang][key] || translations['en'][key] || key;
    };

    // Calculate Leaderboards (show approved members with points > 0, sorted by stats)
    const importers = useMemo(() => {
        return [...portalUsers]
            .filter(u => u.status === 'approved' && (u.import_count || 0) > 0)
            .sort((a, b) => (b.import_count || 0) - (a.import_count || 0))
            .slice(0, 10);
    }, [portalUsers]);

    const creators = useMemo(() => {
        return [...portalUsers]
            .filter(u => u.status === 'approved' && (u.request_count || 0) > 0)
            .sort((a, b) => (b.request_count || 0) - (a.request_count || 0))
            .slice(0, 10);
    }, [portalUsers]);

    const deliverers = useMemo(() => {
        return [...portalUsers]
            .filter(u => u.status === 'approved' && (u.delivery_count || 0) > 0)
            .sort((a, b) => (b.delivery_count || 0) - (a.delivery_count || 0))
            .slice(0, 10);
    }, [portalUsers]);

    const renderRankingTable = (title: string, data: PortalUser[], metricKey: 'import_count' | 'request_count' | 'delivery_count') => {
        return (
            <div className="panel-card leaderboard-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem', flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                    <Award size={16} style={{ color: 'var(--accent-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                        {title}
                    </h3>
                </div>

                {data.length === 0 ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)', minHeight: '150px' }}>
                        {t('no_rankings')}
                    </div>
                ) : (
                    <div className="leaderboard-list">
                        {data.map((user, index) => {
                            const score = user[metricKey] || 0;
                            const isTopThree = index < 3;
                            const rankColors = ['#f59e0b', '#94a3b8', '#b45309']; // gold, silver, bronze

                            return (
                                <div 
                                    key={user.id || user.username} 
                                    className={`leaderboard-item ${isTopThree ? `leaderboard-rank-${index + 1}` : ''}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.55rem 0.85rem',
                                        borderRadius: '8px',
                                        background: isTopThree 
                                            ? `rgba(255, 255, 255, ${0.035 - (index * 0.008)})` 
                                            : 'rgba(255, 255, 255, 0.01)',
                                        border: '1px solid rgba(255, 255, 255, 0.02)',
                                        transition: 'transform 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {index === 0 ? (
                                            <Trophy size={16} style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.4))' }} />
                                        ) : index === 1 ? (
                                            <Medal size={16} style={{ color: '#94a3b8', filter: 'drop-shadow(0 0 4px rgba(148,163,184,0.4))' }} />
                                        ) : index === 2 ? (
                                            <Medal size={16} style={{ color: '#b45309', filter: 'drop-shadow(0 0 4px rgba(180,83,9,0.4))' }} />
                                        ) : (
                                            <div 
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    color: 'var(--text-secondary)'
                                                }}
                                            >
                                                {index + 1}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '0.78rem', fontWeight: isTopThree ? 700 : 600, color: isTopThree ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {user.username}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        {isTopThree && <Star size={10} style={{ color: rankColors[index], fill: rankColors[index], opacity: 0.8 }} />}
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isTopThree ? rankColors[index] : 'var(--text-secondary)' }}>
                                            {score.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="leaderboard-tab anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
            
            {/* Header section with Trophy icon & title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm, 6px)' }}>
                        <Trophy size={22} style={{ color: '#f59e0b' }} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                            {t('leaderboard_title')}
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {t('leaderboard_subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Top 3 Rankings Columns */}
            <div className="leaderboard-grid" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', width: '100%' }}>
                {renderRankingTable(t('importers'), importers, 'import_count')}
                {renderRankingTable(t('creators'), creators, 'request_count')}
                {renderRankingTable(t('deliverers'), deliverers, 'delivery_count')}
            </div>

            {/* Informational helper note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.02)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <Info size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <span>
                    {language === 'tr' 
                        ? 'İstatistikler, envanter yükleme (CSV aktarımı), lojistik talep oluşturma ve teslim edilen malzemelerin sisteme girilmesiyle gerçek zamanlı olarak güncellenir.'
                        : 'Statistics are updated in real-time when uploading inventories (CSV import), creating logistics requests, or delivering items to depots.'}
                </span>
            </div>

        </div>
    );
});

LeaderboardTab.displayName = 'LeaderboardTab';
