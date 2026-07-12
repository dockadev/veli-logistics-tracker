const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'utils', 'localization.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newKeys = {
    en: {
        copied: "Copied",
        copy: "Copy",
        total_depots: "TOTAL DEPOTS",
        regions_stat: "REGIONS",
        all_regions: "All Regions",
        general_stockpiles: "General Stockpiles",
        unknown_region: "Unknown Region",
        no_passcodes_found: "No active stockpile passcodes match your search query.",
        search_passcodes_placeholder: "Search by region, subregion or depot name..."
    },
    tr: {
        copied: "Kopyalandı",
        copy: "Kopyala",
        total_depots: "TOPLAM DEPO",
        regions_stat: "BÖLGELER",
        all_regions: "Tüm Bölgeler",
        general_stockpiles: "Genel Depolar",
        unknown_region: "Bilinmeyen Bölge",
        no_passcodes_found: "Aramanıza uygun aktif bir depo şifresi bulunamadı.",
        search_passcodes_placeholder: "Bölge, alt bölge veya depo adı ara..."
    },
    'pt-BR': {
        copied: "Copiado",
        copy: "Copiar",
        total_depots: "TOTAL DE DEPÓSITOS",
        regions_stat: "REGIÕES",
        all_regions: "Todas as Regiões",
        general_stockpiles: "Depósitos Gerais",
        unknown_region: "Região Desconhecida",
        no_passcodes_found: "Nenhum código de acesso corresponde à sua pesquisa.",
        search_passcodes_placeholder: "Pesquisar por região, sub-região ou nome do depósito..."
    },
    ru: {
        copied: "Скопировано",
        copy: "Копировать",
        total_depots: "ВСЕГО СКЛАДОВ",
        regions_stat: "РЕГИОНЫ",
        all_regions: "Все регионы",
        general_stockpiles: "Общие склады",
        unknown_region: "Неизвестный регион",
        no_passcodes_found: "Пароли складов по вашему запросу не найдены.",
        search_passcodes_placeholder: "Поиск по региону, подрегиону или названию склада..."
    },
    de: {
        copied: "Kopiert",
        copy: "Kopieren",
        total_depots: "GESAMTLAGER",
        regions_stat: "REGIONEN",
        all_regions: "Alle Regionen",
        general_stockpiles: "Allgemeine Lager",
        unknown_region: "Unbekannte Region",
        no_passcodes_found: "Keine aktiven Lager-Passcodes entsprechen Ihrer Suchanfrage.",
        search_passcodes_placeholder: "Suche nach Region, Subregion oder Lagernamen..."
    }
};

for (const [lang, keys] of Object.entries(newKeys)) {
    const targetStr = `depot_passcodes_desc:`;
    const idx = content.indexOf(targetStr);
    if (idx !== -1) {
        // Find the matching language section by searching backwards or finding block
    }
}

// Better approach: regex replace for depot_passcodes_desc in each block
Object.entries(newKeys).forEach(([lang, keys]) => {
    let keyLines = '';
    for (const [k, v] of Object.entries(keys)) {
        keyLines += `\n        ${k}: ${JSON.stringify(v)},`;
    }

    // Find depot_passcodes_desc and append keyLines after it
    // We can locate the specific lang block
    const langToken = `${lang}: {`;
    const langPos = content.indexOf(langToken);
    if (langPos !== -1) {
        const descPos = content.indexOf(`depot_passcodes_desc:`, langPos);
        if (descPos !== -1) {
            const endLinePos = content.indexOf('\n', descPos);
            content = content.slice(0, endLinePos) + keyLines + content.slice(endLinePos);
        }
    }
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated localization.ts with passcode keys!');
