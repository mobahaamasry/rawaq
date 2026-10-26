// Set sw.js VERSION to a hash of every cached file, so any change ships as a new offline version.
// Usage: node scripts/stamp-sw.js   (tests/audit.test.js fails if this wasn't run after a change)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');

function assetsOf(sw) {
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
function versionFor(assets) {
  const h = crypto.createHash('sha256');
  for (const a of assets) {
    if (a === './') continue;
    h.update(a + '\n');
    h.update(fs.readFileSync(path.join(root, a)));
  }
  return 'rawaq-' + h.digest('hex').slice(0, 12);
}

if (require.main === module) {
  const sw = fs.readFileSync(swPath, 'utf8');
  const version = versionFor(assetsOf(sw));
  fs.writeFileSync(swPath, sw.replace(/const VERSION = '[^']*';/, "const VERSION = '" + version + "';"));
  console.log('sw.js VERSION = ' + version);
}

module.exports = { assetsOf, versionFor };
