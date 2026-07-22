const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const stylesDir = path.join(projectDir, 'src', 'styles');
const srcDir = path.join(projectDir, 'src');

// Helper to recursively walk a directory
function walkDir(dir, extensions) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(filePath, extensions));
        } else {
            const ext = path.extname(file);
            if (extensions.includes(ext)) {
                results.push(filePath);
            }
        }
    });
    return results;
}

// 1. Scan all TSX, TS, HTML files to build a dictionary of used words/classes
const sourceFiles = [
    ...walkDir(srcDir, ['.tsx', '.ts']),
    path.join(projectDir, 'index.html')
].filter(f => fs.existsSync(f));

const usedTokens = new Set();
const securityAlerts = []; // { file, line, type, message, severity }
const codeCleanlinessAlerts = []; // { file, line, type, message, severity }
const performanceAlerts = []; // { file, line, type, message, severity }

// Standard HTML tags and state words safelist
const standardSafelist = new Set([
    'html', 'body', 'root', 'div', 'span', 'p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'button', 'input', 'textarea', 'select', 'option', 'form', 'label', 'svg', 'path',
    'active', 'disabled', 'open', 'close', 'show', 'hide', 'visible', 'hidden'
]);
standardSafelist.forEach(t => usedTokens.add(t));

// 2. Scan TypeScript/JavaScript Source Files for Code & Security Audit
sourceFiles.forEach(file => {
    const relativePath = path.relative(projectDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    // Collect tokens for CSS unused check
    const words = content.match(/[a-zA-Z0-9_\-]+/g);
    if (words) {
        words.forEach(w => usedTokens.add(w));
    }

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();

        if (!trimmed) return;

        // Security Checks in JS/TS
        if (trimmed.includes('dangerouslySetInnerHTML')) {
            securityAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'XSS_RISK_DANGEROUSLY_SET_INNER_HTML',
                message: 'Use of dangerouslySetInnerHTML detected. Potential XSS vector.',
                severity: 'HIGH'
            });
        }

        if (/\beval\s*\(/.test(trimmed) || /new\s+Function\s*\(/.test(trimmed)) {
            securityAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'DYNAMIC_CODE_EXECUTION',
                message: 'eval() or new Function() execution detected. Severe security risk.',
                severity: 'HIGH'
            });
        }

        const secretRegex = /(secret|passwd|api_key|apikey|private_key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i;
        if (secretRegex.test(trimmed)) {
            securityAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'HARDCODED_SECRET',
                message: 'Potential hardcoded secret or API key credential found in source code.',
                severity: 'HIGH'
            });
        }

        // Code Cleanliness & Quality Checks
        if (trimmed.startsWith('console.log(') || trimmed.startsWith('console.debug(')) {
            codeCleanlinessAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'DEBUG_CONSOLE_LOG',
                message: 'console.log leak in production code.',
                severity: 'LOW'
            });
        }
    });
});

// 3. Scan CSS Files
const cssFiles = walkDir(stylesDir, ['.css']).filter(f => !f.endsWith('main.css'));

const allSelectors = {}; // selector -> [{ file, line }]
const hardcodedColorsCount = { total: 0, list: [] };
const unusedSelectors = []; // { file, line, selector }
let importantCount = 0;

cssFiles.forEach(file => {
    const relativePath = path.relative(stylesDir, file);
    if (relativePath.replace(/\\/g, '/').includes('base/_variables.css')) return;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    let currentSelector = null;
    let selectorLine = 0;
    let insideRules = false;
    let insideKeyframes = false;

    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();

        if (!trimmed) return;

        if (trimmed.includes('!important')) {
            importantCount++;
        }

        // Skip comments, check for leaks
        if (trimmed.startsWith('/*') || trimmed.includes('//')) {
            const secretRegex = /(password|passwd|secret|api_key|apikey|token|private_key|privatekey)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{8,}['"]?/i;
            if (secretRegex.test(trimmed)) {
                securityAlerts.push({
                    file: relativePath,
                    line: lineNumber,
                    type: 'POTENTIAL_SECRET_LEAK',
                    message: 'Potential sensitive keyword or token detected in CSS comment.',
                    severity: 'HIGH'
                });
            }
            return;
        }

        // Insecure Connection Check
        if (trimmed.includes('http://')) {
            securityAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'INSECURE_PROTOCOL',
                message: 'Insecure http:// connection detected instead of https://.',
                severity: 'MEDIUM'
            });
        }

        // Legacy IE expression / behavior vulnerabilities
        if (/\bexpression\s*\(/.test(trimmed) || /\bbehavior\s*:/.test(trimmed)) {
            securityAlerts.push({
                file: relativePath,
                line: lineNumber,
                type: 'CSS_EXPRESSION_XSS',
                message: 'Legacy IE CSS expression or behavior detected. XSS risk.',
                severity: 'HIGH'
            });
        }

        // Check keyframe blocks
        if (trimmed.startsWith('@keyframes')) {
            insideKeyframes = true;
            return;
        }

        // Open block detection
        if (trimmed.includes('{')) {
            const selectorPart = trimmed.split('{')[0].trim();
            if (selectorPart) {
                currentSelector = selectorPart;
                selectorLine = lineNumber;
            }
            insideRules = true;

            // Skip checking keyframe step selectors (0%, 50%, 100%, from, to)
            if (insideKeyframes || /^(from|to|\d+%)$/i.test(currentSelector)) {
                return;
            }

            if (currentSelector) {
                const selectors = currentSelector.split(',').map(s => s.trim()).filter(Boolean);
                selectors.forEach(sel => {
                    if (/input\[value[*^$~=]/i.test(sel)) {
                        securityAlerts.push({
                            file: relativePath,
                            line: lineNumber,
                            type: 'CSS_KEYLOGGER_PATTERN',
                            message: `CSS Keylogger pattern target selector "${sel}" detected.`,
                            severity: 'HIGH'
                        });
                    }

                    if (!allSelectors[sel]) {
                        allSelectors[sel] = [];
                    }
                    allSelectors[sel].push({ file: relativePath, line: selectorLine });

                    // check if selector is unused in code
                    const tokens = sel.match(/[.#][a-zA-Z0-9_\-]+/g);
                    if (tokens) {
                        let isUsed = false;
                        for (let t of tokens) {
                            const name = t.substring(1);
                            if (usedTokens.has(name)) {
                                isUsed = true;
                                break;
                            }
                        }
                        if (!isUsed) {
                            unusedSelectors.push({
                                file: relativePath,
                                line: selectorLine,
                                selector: sel
                            });
                        }
                    }
                });
            }
            return;
        }

        // Close block detection
        if (trimmed.includes('}')) {
            insideRules = false;
            currentSelector = null;
            if (insideKeyframes && trimmed === '}') {
                insideKeyframes = false;
            }
            return;
        }

        // Inside rule block: performance & colors & security
        if (insideRules && trimmed.includes(':')) {
            const parts = trimmed.split(':');
            const prop = parts[0].trim().toLowerCase();
            const val = parts[1].split(';')[0].trim();

            const urlMatch = val.match(/url\s*\(([^)]+)\)/i);
            if (urlMatch) {
                const urlContent = urlMatch[1].replace(/['"]/g, '').trim();
                const isRelative = !urlContent.startsWith('http') && !urlContent.startsWith('//');
                const isDataUri = urlContent.startsWith('data:');
                const isSafeDomain = urlContent.includes('fonts.googleapis.com') || urlContent.includes('fonts.gstatic.com');

                if (!isRelative && !isDataUri && !isSafeDomain) {
                    securityAlerts.push({
                        file: relativePath,
                        line: lineNumber,
                        type: 'EXTERNAL_RESOURCE_LOAD',
                        message: `External resource load from "${urlContent}". Leakage risk.`,
                        severity: 'MEDIUM'
                    });
                }
            }

            if (prop === 'animation' || prop === 'transition') {
                const layoutProperties = [
                    'width', 'height', 'margin', 'padding', 'top', 'left', 'right', 'bottom',
                    'border', 'font-size', 'line-height', 'display', 'float', 'position'
                ];
                layoutProperties.forEach(p => {
                    if (val.includes(p)) {
                        performanceAlerts.push({
                            file: relativePath,
                            line: lineNumber,
                            type: 'LAYOUT_THRASHING_ANIMATION',
                            message: `Animating/Transitioning layout property "${p}" triggers expensive CPU repaints. Prefer "transform" or "opacity".`,
                            severity: 'MEDIUM'
                        });
                    }
                });
            }

            const hasHex = /#([0-9a-fA-F]{3,8})\b/.test(val);
            const hasRgb = /\b(rgba?|hsla?)\(/.test(val) && !val.includes('var(');
            if (hasHex || hasRgb) {
                hardcodedColorsCount.total++;
                hardcodedColorsCount.list.push({ file: relativePath, line: lineNumber, selector: currentSelector, property: prop, value: val });
            }
        }
    });
});

// Output Comprehensive Results
console.log('====================================================');
console.log('   VELI LOGISTICS TRACKER - COMPREHENSIVE AUDIT REPORT');
console.log('====================================================');
console.log(`Total Source Files Scanned (TS/TSX/HTML): ${sourceFiles.length}`);
console.log(`Total CSS Files Audited: ${cssFiles.length}`);
console.log(`Total !important Rules Found in CSS: ${importantCount}\n`);

console.log('--- 1. SECURITY & VULNERABILITY AUDIT ---');
console.log(`Total security alerts found: ${securityAlerts.length}`);
if (securityAlerts.length === 0) {
    console.log('✔ No security vulnerabilities detected.');
} else {
    securityAlerts.forEach(alert => {
        console.log(`[${alert.severity}] File: ${alert.file}, Line: ${alert.line} | Type: ${alert.type} | ${alert.message}`);
    });
}
console.log('');

console.log('--- 2. CODE CLEANLINESS & QUALITY ---');
console.log(`Total code cleanliness alerts found: ${codeCleanlinessAlerts.length}`);
if (codeCleanlinessAlerts.length === 0) {
    console.log('✔ Code cleanliness is clean.');
} else {
    codeCleanlinessAlerts.forEach(alert => {
        console.log(`[${alert.severity}] File: ${alert.file}, Line: ${alert.line} | Type: ${alert.type} | ${alert.message}`);
    });
}
console.log('');

console.log('--- 3. PERFORMANCE & REPAINT ALERTS ---');
console.log(`Total performance alerts found: ${performanceAlerts.length}`);
if (performanceAlerts.length === 0) {
    console.log('✔ No performance thrashing issues found.');
} else {
    performanceAlerts.forEach(perf => {
        console.log(`[${perf.severity}] File: ${perf.file}, Line: ${perf.line} | Type: ${perf.type} | ${perf.message}`);
    });
}
console.log('');

console.log('--- 4. DUPLICATE SELECTORS ---');
let duplicateCount = 0;
Object.entries(allSelectors).forEach(([selector, occurrences]) => {
    if (occurrences.length > 1) {
        console.log(`Selector: "${selector}"`);
        occurrences.forEach(occ => {
            console.log(`  - File: ${occ.file}, Line: ${occ.line}`);
        });
        duplicateCount++;
    }
});
if (duplicateCount === 0) {
    console.log('✔ No duplicate CSS selectors found.');
} else {
    console.log(`Total duplicate selectors: ${duplicateCount}`);
}
console.log('');

console.log('--- 5. UNUSED CSS SELECTORS ---');
console.log(`Total unused selectors: ${unusedSelectors.length}`);
if (unusedSelectors.length === 0) {
    console.log('✔ No unused CSS selectors found.');
} else {
    unusedSelectors.forEach(item => {
        console.log(`File: ${item.file}, Line: ${item.line} | Selector: "${item.selector}"`);
    });
}
console.log('');

console.log('====================================================');
console.log('                AUDIT COMPLETE');
console.log('====================================================');
