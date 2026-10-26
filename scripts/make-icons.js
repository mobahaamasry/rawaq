// Render the PWA icons (PNG) from icon.svg and icons/icon-maskable.svg with headless Edge or Chrome.
// No dependencies. Usage: node scripts/make-icons.js
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const browser = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
const jobs = [
  { src: 'icon.svg', out: 'icons/icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icons/icon-512.png', size: 512 },
  { src: 'icons/icon-maskable.svg', out: 'icons/maskable-192.png', size: 192 },
  { src: 'icons/icon-maskable.svg', out: 'icons/maskable-512.png', size: 512 },
  { src: 'icons/icon-maskable.svg', out: 'icons/apple-touch-icon.png', size: 180 },
  { src: 'icons/shortcut-capture.svg', out: 'icons/shortcut-capture.png', size: 96 },
  { src: 'icons/shortcut-focus.svg', out: 'icons/shortcut-focus.png', size: 96 },
  { src: 'icons/shortcut-breathe.svg', out: 'icons/shortcut-breathe.png', size: 96 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!browser) throw new Error('No Edge or Chrome found');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'rawaq-icons-'));
  const port = 9341;
  const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + prof, '--remote-debugging-port=' + port, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find((t) => t.type === 'page'); } catch (e) { /* starting */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = {};
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } });
  const send = (method, params) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Page.enable');
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const j of jobs) {
    const svg = fs.readFileSync(path.join(root, j.src), 'utf8');
    const html = '<!doctype html><html><head><style>html,body{margin:0;background:transparent}img{display:block}</style></head><body>' +
      '<img width="' + j.size + '" height="' + j.size + '" src="data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') + '"></body></html>';
    await send('Emulation.setDeviceMetricsOverride', { width: j.size, height: j.size, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: j.size, height: j.size, scale: 1 } });
    fs.mkdirSync(path.dirname(path.join(root, j.out)), { recursive: true });
    fs.writeFileSync(path.join(root, j.out), Buffer.from(shot.result.data, 'base64'));
    console.log('wrote ' + j.out + ' (' + j.size + 'px)');
  }
  ws.close();
  proc.kill();
  await sleep(400);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* locked */ }
  process.exit(0);
})().catch((e) => { console.error('icon error: ' + e.message); process.exit(1); });
