import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ReleaseNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    version: string;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
    isOpen,
    onClose,
    version
}) => {
    const { language } = useLanguage();

    if (!isOpen) return null;

    const itemsTr = [
        { title: 'Yenilenen Liderlik Tablosu', desc: 'Katkı sıralamaları altın, gümüş ve bronz görsel detaylarıyla zenginleştirildi, savaş sıfırlama butonu geliştirici portalına taşındı.' },
        { title: 'Gelişmiş Geliştirici Portalı (Dev Portal)', desc: 'Arayüz modern sekmeli kartlara bölünerek tamamen revize edildi. Savaş sıfırlama düğmesi sistem ayarlarına entegre edildi.' },
        { title: 'Depo Bazlı Darboğaz ve Öneri Motoru', desc: 'Darboğazlar depo bazlı analiz edilerek diğer depolardan transfer önerileri eklendi, sıfır darboğaz durumunda şık yeşil panel getirildi.' },
        { title: 'Kategori Dağılımı Revizyonu', desc: 'Tekil parça "item" kategorisi kaldırılarak tüm kutular ve kutulu araçlar "Crates" başlığı altında birleştirildi.' },
        { title: 'Özel Isı Haritası Tooltip’i', desc: 'Lojistik aktivite ısı haritasındaki hücrelerin üzerinde tarayıcı varsayılan başlığı yerine hareketli, şık bir HTML tooltip kutusu getirildi.' },
        { title: 'İstek Panelinde Kategori Kilitleme', desc: 'Talep oluştururken otomatik saptanan malzeme kategorisinin kullanıcı tarafından sonradan elle değiştirilebilmesi kilitlendi.' }
    ];

    const itemsEn = [
        { title: 'Revamped Leaderboard Tab', desc: 'Enhanced visual rankings with gold, silver, and bronze trophies, and migrated war reset to the Developer Portal.' },
        { title: 'Developer Portal Overhaul', desc: 'Clean, tabbed card layout organizing approvals, audit trails, feedbacks, and system war settings.' },
        { title: 'Depot-by-Depot Bottlenecks', desc: 'Alarms are now run depot-by-depot with smart transfer recommendations, featuring a clean green panel for zero-bottleneck states.' },
        { title: 'Category Distribution Updates', desc: 'Removed loose "item" category, merging normal and vehicle crates under the "Crates" label.' },
        { title: 'Custom Heatmap Tooltips', desc: 'Replaced native browser titles on the activity heatmap with floating custom in-app tooltips.' },
        { title: 'Category Selection Lock', desc: 'Disabled changing the item category dropdown once a valid matching item name is matched.' }
    ];

    const items = language === 'tr' ? itemsTr : itemsEn;

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem'
            }}
        >
            <div 
                className="panel-card anim-scale-in"
                style={{
                    maxWidth: '520px',
                    width: '100%',
                    padding: '1.5rem',
                    background: 'rgba(15, 15, 20, 0.98)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem' }}>
                    <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', padding: '0.45rem', borderRadius: '8px' }}>
                        <Sparkles size={20} style={{ color: 'var(--accent-color)', filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.4))' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                            {language === 'tr' ? `YENİLİKLER - SÜRÜM ${version}` : `WHAT'S NEW - VERSION ${version}`}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {language === 'tr' ? 'Son güncelleme ile eklenen özellikler ve iyileştirmeler' : 'New enhancements and features implemented in this build'}
                        </p>
                    </div>
                </div>

                {/* Features List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '50%', padding: '3px', marginTop: '2px', flexShrink: 0 }}>
                                <Check size={10} style={{ color: '#10b981' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {item.title}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                    {item.desc}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onClose}
                        style={{
                            padding: '0.45rem 1.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'var(--accent-color)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {language === 'tr' ? 'Anladım' : 'Got it!'}
                    </button>
                </div>
            </div>
        </div>
    );
};
