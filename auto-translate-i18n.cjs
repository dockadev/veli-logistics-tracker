const fs = require('fs');
const path = require('path');
const https = require('https');

const i18nDir = path.join(__dirname, 'src', 'i18n');

// Official categories that MUST always stay fixed in English across ALL languages
const ALWAYS_ENGLISH_KEYS = new Set([
    'cat_vehicle_crates',
    'cat_shippable_crates',
    'cat_small_arms',
    'cat_heavy_arms',
    'cat_heavy_ammunition',
    'cat_utility',
    'cat_medical',
    'cat_materials',
    'cat_uniforms',
    'cat_aircraft_parts',
    'cat_vehicles',
    'cat_shippables'
]);

// Parse TS object key-value pairs from file
function parseTsI18nFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {};
    const regex = /^\s*([a-zA-Z0-9_]+)\s*:\s*(["'])([\s\S]*?)\2\s*,?\s*$/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        let val = match[3];
        val = val.replace(/\\"/g, '"').replace(/\\'/g, "'");
        result[key] = val;
    }
    return result;
}

// Free Google Translate API helper
function translateText(text, targetLang) {
    return new Promise((resolve) => {
        if (!text || text.trim() === '') return resolve(text);

        const placeholders = [];
        const protectedText = text.replace(/\{[a-zA-Z0-9_]+\}/g, (m) => {
            placeholders.push(m);
            return `__PH_${placeholders.length - 1}__`;
        });

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(protectedText)}`;

        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let translated = parsed[0].map(x => x[0]).join('');
                    
                    placeholders.forEach((ph, idx) => {
                        translated = translated.replace(new RegExp(`__PH_${idx}__`, 'gi'), ph);
                    });

                    resolve(translated);
                } catch {
                    resolve(text);
                }
            });
        });

        req.on('error', () => resolve(text));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(text);
        });
    });
}

function generateTsContent(langExportName, translationsObj) {
    let out = `import { en } from './en';\n\n`;
    out += `export const ${langExportName}: Partial<Record<keyof typeof en, string>> = {\n`;

    const entries = Object.entries(translationsObj);
    entries.forEach(([key, value], idx) => {
        const isLast = idx === entries.length - 1;
        const escapedValue = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        out += `    ${key}: "${escapedValue}"${isLast ? '' : ','}\n`;
    });

    out += `};\n`;
    return out;
}

async function run() {
    console.log('====================================================');
    console.log('   VELI LOGISTICS TRACKER - i18n AUTO-TRANSLATOR');
    console.log('====================================================\n');

    const enPath = path.join(i18nDir, 'en.ts');
    const enDict = parseTsI18nFile(enPath);
    const enKeys = Object.keys(enDict);

    console.log(`Base English keys count: ${enKeys.length}\n`);

    const targets = [
        { code: 'tr', langExport: 'tr', file: 'tr.ts' },
        { code: 'pt-BR', langExport: 'ptBR', file: 'ptBR.ts' },
        { code: 'ru', langExport: 'ru', file: 'ru.ts' },
        { code: 'de', langExport: 'de', file: 'de.ts' }
    ];

    for (const target of targets) {
        const filePath = path.join(i18nDir, target.file);
        const existingDict = parseTsI18nFile(filePath);

        // Force official category keys to always be English
        ALWAYS_ENGLISH_KEYS.forEach(catKey => {
            if (enDict[catKey]) {
                existingDict[catKey] = enDict[catKey];
            }
        });

        const missingKeys = enKeys.filter(k => !existingDict[k]);

        console.log(`[${target.code.toUpperCase()}] Current keys: ${Object.keys(existingDict).length} | Missing: ${missingKeys.length}`);

        const updatedDict = { ...existingDict };

        // Enforce English on official category keys
        ALWAYS_ENGLISH_KEYS.forEach(catKey => {
            if (enDict[catKey]) {
                updatedDict[catKey] = enDict[catKey];
            }
        });

        if (missingKeys.length > 0) {
            console.log(`Translating ${missingKeys.length} missing keys for ${target.code}...`);

            const chunkSize = 15;
            for (let i = 0; i < missingKeys.length; i += chunkSize) {
                const chunk = missingKeys.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (key) => {
                    if (ALWAYS_ENGLISH_KEYS.has(key)) {
                        updatedDict[key] = enDict[key];
                    } else {
                        const originalEn = enDict[key];
                        const translated = await translateText(originalEn, target.code);
                        updatedDict[key] = translated;
                    }
                }));
            }
        }

        const newContent = generateTsContent(target.langExport, updatedDict);
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✔ Successfully updated ${target.file} (Total keys: ${Object.keys(updatedDict).length})\n`);
    }

    console.log('====================================================');
    console.log('         i18n AUTO-TRANSLATION COMPLETE');
    console.log('====================================================');
}

run();
