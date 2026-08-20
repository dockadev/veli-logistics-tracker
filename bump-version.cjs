/* ============================================================
   VERSION BUMP SCRIPT
   Usage: node bump-version.cjs <x.y.z>
   Syncs the app version across package.json, Tauri, UI fallbacks.
   After running, only set the min required version in the dev
   portal to force all clients to the new version.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Usage: node bump-version.cjs <x.y.z>');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const oldVersion = pkg.version;

if (oldVersion === newVersion) {
  console.log(`Already at version ${newVersion}. Nothing to do.`);
  process.exit(0);
}

const targets = [
  'package.json',
  'package-lock.json',
  'src-tauri/Cargo.toml',
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json',
  'src/App.tsx',
  'src/components/SecureGateOverlay.tsx',
  'src/components/DeveloperPortalModal.tsx',
  'src/components/StockpileTemplatesTab.tsx',
  'src/utils/dbService.ts'
];

let updated = 0;
let missing = 0;

for (const file of targets) {
  const fp = path.join(__dirname, file);
  if (!fs.existsSync(fp)) {
    console.warn(`[skip] missing file: ${file}`);
    missing++;
    continue;
  }
  const content = fs.readFileSync(fp, 'utf8');

  let from = oldVersion;
  if (file === 'package-lock.json') {
    try {
      const lock = JSON.parse(content);
      from = (lock && lock.version) || oldVersion;
    } catch (e) {
      from = oldVersion;
    }
  }

  if (!content.includes(from)) {
    console.warn(`[skip] no "${from}" found in: ${file}`);
    missing++;
    continue;
  }
  fs.writeFileSync(fp, content.split(from).join(newVersion), 'utf8');
  console.log(`[ok] ${file}`);
  updated++;
}

console.log(`\nVersion bumped: ${oldVersion} -> ${newVersion} (${updated} file(s) updated, ${missing} skipped).`);
console.log('Next: build & ship the new release, then set the min required version in the dev portal.');