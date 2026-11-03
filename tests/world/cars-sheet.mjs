// contact sheet + triangle counts: node tests/world/cars-sheet.mjs [pairs] [outfile]
import { playwright, exe, GL } from '../helpers/emu.mjs';
const [mode, file] = [process.argv[2] || 'all', process.argv[3] || '/workspace/cars-sheet.png'];
const b = await playwright().chromium.launch({ executablePath: exe(), args: GL });
const p = await b.newPage({ viewport: { width: mode === 'pairs' ? 1220 : 2130, height: 900 } }); p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:8947/tests/world/cars-sheet.html' + (mode === 'pairs' ? '?pairs=1' : mode === 'all' ? '' : '?ids=' + mode));
await p.waitForFunction(() => window.done, null, { timeout: 600000, polling: 2000 });
console.log(JSON.stringify(await p.evaluate(() => window.sheet))); await p.screenshot({ path: file, fullPage: true }); await b.close();
