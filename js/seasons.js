// Kemy seasons: real-world holidays from the player's LOCAL date, one primary holiday at a time, data-driven decoration
// sets (lights, instanced props, banner text, fireworks / snow) and a door treat. Respectful days (MLK Day, Presidents'
// Day, Memorial Day, Veterans Day) get flags and banners only: no fireworks, no party props. All designs are original.
// Debug: ?season=<id> (or #...?season=<id>) forces a season, e.g. ?season=winter, ?season=july4, ?season=normal.
// Written by Lone Keem.
const D = (y, m, d) => new Date(y, m, d);
const nthDow = (y, m, dow, n) => { const f = D(y, m, 1); return D(y, m, 1 + ((dow - f.getDay() + 7) % 7) + (n - 1) * 7); }; // n-th weekday (0 = Sun)
const lastDow = (y, m, dow) => { const l = D(y, m + 1, 0); return D(y, m, l.getDate() - ((l.getDay() - dow + 7) % 7)); };
export function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return D(y, mo - 1, da); }
// Lunar New Year (first day) and Hanukkah (first candle, evening) lookup tables to 2035
const LNY = { 2024: [1, 10], 2025: [0, 29], 2026: [1, 17], 2027: [1, 6], 2028: [0, 26], 2029: [1, 13], 2030: [1, 3], 2031: [0, 23], 2032: [1, 11], 2033: [0, 31], 2034: [1, 19], 2035: [1, 8] };
const HAN = { 2024: [11, 25], 2025: [11, 14], 2026: [11, 4], 2027: [11, 24], 2028: [11, 12], 2029: [11, 1], 2030: [11, 20], 2031: [11, 9], 2032: [10, 27], 2033: [11, 16], 2034: [11, 6], 2035: [11, 25] };
const add = (d, n) => D(d.getFullYear(), d.getMonth(), d.getDate() + n);

// look: lights = bulb colours, prop = instanced prop kind, pc = prop colours, banner = arch text, fx = 'fireworks' | 'snow' | '',
// night = Kemy Street dusk sky, respectful = flags/banners only. treat = what doors give.
export const SEASONS = {
  normal: { name: 'Kemy Street', lights: ['#fff3c4'], prop: 'flower', pc: ['#ff7ab8', '#ffd447', '#b26bff'], banner: '🏡 KEMY STREET', fx: '', treat: { id: 'star', name: 'Star Cookie', e: '⭐' }, greet: ['Hi neighbor! 👋', 'Have a great day!', 'Here, a little treat!'] },
  newyear: { name: "New Year's Day", lights: ['#ffd447', '#ffffff', '#c0c0ff'], prop: 'star', pc: ['#ffd447', '#e5e7eb'], banner: '🎆 HAPPY NEW YEAR', fx: 'fireworks', treat: { id: 'ny', name: 'Sparkle Cookie', e: '✨' }, greet: ['Happy New Year! 🎆', 'New year, new adventures!'] },
  mlk: { name: 'Martin Luther King Jr. Day', respectful: 1, lights: ['#fff3c4'], prop: 'banner', pc: ['#1e3a8a', '#f8fafc'], banner: '🕊️ DREAM · SERVE · UNITE', fx: '', treat: { id: 'dove', name: 'Dove Cookie', e: '🕊️' }, greet: ['Kindness is a superpower. 🕊️', 'Let’s help each other today.'] },
  lunar: { name: 'Lunar New Year', lights: ['#ef4444', '#facc15'], prop: 'lantern', pc: ['#dc2626', '#f59e0b'], banner: '🏮 HAPPY LUNAR NEW YEAR', fx: 'fireworks', treat: { id: 'orange', name: 'Lucky Orange', e: '🍊' }, greet: ['Happy Lunar New Year! 🏮', 'Wishing you luck and joy!'] },
  valentines: { name: "Valentine's Day", lights: ['#f472b6', '#ef4444', '#ffffff'], prop: 'heart', pc: ['#ef4444', '#f472b6', '#fda4af'], banner: '💖 KEMY STREET 💖', fx: '', treat: { id: 'heart', name: 'Heart Candy', e: '💖' }, greet: ['Happy Valentine’s! 💖', 'You’re a great friend!'] },
  presidents: { name: "Presidents' Day", respectful: 1, lights: ['#fff3c4'], prop: 'flag', pc: ['#ffffff'], banner: '🇺🇸 PRESIDENTS’ DAY', fx: '', treat: { id: 'cherry', name: 'Cherry Tart', e: '🍒' }, greet: ['Happy Presidents’ Day!'] },
  stpatricks: { name: "St. Patrick's Day", lights: ['#22c55e', '#facc15'], prop: 'shamrock', pc: ['#16a34a', '#22c55e'], banner: '🍀 LUCKY KEMY STREET', fx: '', treat: { id: 'clover', name: 'Clover Cookie', e: '🍀' }, greet: ['Happy St. Patrick’s! 🍀', 'Feeling lucky!'] },
  easter: { name: 'Spring Eggs', lights: ['#fde68a', '#a7f3d0', '#c4b5fd', '#fbcfe8'], prop: 'egg', pc: ['#fde68a', '#a7f3d0', '#c4b5fd', '#fbcfe8', '#93c5fd'], banner: '🥚 SPRING ON KEMY STREET', fx: '', treat: { id: 'egg', name: 'Chocolate Egg', e: '🥚' }, greet: ['Happy spring! 🌷', 'Found any eggs yet? 🥚'] },
  earthday: { name: 'Earth Day', lights: ['#86efac', '#7dd3fc'], prop: 'sapling', pc: ['#16a34a', '#65a30d'], banner: '🌍 LOVE OUR PLANET', fx: '', treat: { id: 'seed', name: 'Seed Packet', e: '🌱' }, greet: ['Happy Earth Day! 🌍', 'Let’s plant something!'] },
  mothers: { name: "Mother's Day", lights: ['#f9a8d4', '#fde68a'], prop: 'flower', pc: ['#f472b6', '#fb7185', '#fde68a'], banner: '💐 HAPPY MOTHER’S DAY', fx: '', treat: { id: 'tulip', name: 'Tulip Cookie', e: '🌷' }, greet: ['Happy Mother’s Day! 💐'] },
  memorial: { name: 'Memorial Day', respectful: 1, lights: ['#fff3c4'], prop: 'flag', pc: ['#ffffff'], banner: '🇺🇸 WE REMEMBER', fx: '', treat: { id: 'poppy', name: 'Poppy Cookie', e: '🌺' }, greet: ['Remembering those who served. 🇺🇸'] },
  juneteenth: { name: 'Juneteenth', lights: ['#dc2626', '#facc15', '#16a34a'], prop: 'banner', pc: ['#dc2626', '#16a34a'], banner: '✊🏾 HAPPY JUNETEENTH', fx: '', treat: { id: 'straw', name: 'Strawberry Pop', e: '🍓' }, greet: ['Happy Juneteenth! Freedom Day.'] },
  fathers: { name: "Father's Day", lights: ['#93c5fd', '#fde68a'], prop: 'star', pc: ['#3b82f6', '#60a5fa'], banner: '👔 HAPPY FATHER’S DAY', fx: '', treat: { id: 'bbq', name: 'Grill Cookie', e: '🍪' }, greet: ['Happy Father’s Day! 👔'] },
  july4: { name: 'Fourth of July', lights: ['#ef4444', '#ffffff', '#3b82f6'], prop: 'star', pc: ['#ef4444', '#ffffff', '#3b82f6'], banner: '🎆 HAPPY 4TH OF JULY', fx: 'fireworks', treat: { id: 'pop', name: 'Star Popsicle', e: '🍧' }, greet: ['Happy 4th! 🎆', 'Fireworks tonight!'] },
  labor: { name: 'Labor Day', lights: ['#fde68a'], prop: 'banner', pc: ['#1e3a8a', '#b91c1c'], banner: '🛠️ HAPPY LABOR DAY', fx: '', treat: { id: 'cookie', name: 'Picnic Cookie', e: '🍪' }, greet: ['Happy Labor Day! Enjoy the rest. 🛠️'] },
  halloween: { name: 'Halloween', lights: ['#ff8a1f', '#a855f7', '#4ade80'], prop: 'pumpkin', pc: ['#ff8a1f'], banner: '🎃 KEMY STREET', fx: '', night: 1, treat: null, greet: null },
  veterans: { name: 'Veterans Day', respectful: 1, lights: ['#fff3c4'], prop: 'flag', pc: ['#ffffff'], banner: '🇺🇸 THANK YOU, VETERANS', fx: '', treat: { id: 'star2', name: 'Thank-You Star', e: '⭐' }, greet: ['Thank you to all who served. 🇺🇸'] },
  thanksgiving: { name: 'Thanksgiving · Harvest', lights: ['#f59e0b', '#ea580c', '#facc15'], prop: 'pumpkin', pc: ['#d97706', '#ea580c', '#facc15'], banner: '🍂 HAPPY HARVEST', fx: '', treat: { id: 'pie', name: 'Mini Pie', e: '🥧' }, greet: ['Happy Thanksgiving! 🍂', 'So thankful for neighbors like you!'] },
  hanukkah: { name: 'Hanukkah', lights: ['#60a5fa', '#ffffff', '#facc15'], prop: 'candle', pc: ['#3b82f6', '#ffffff'], banner: '🕎 HAPPY HANUKKAH', fx: 'snow', treat: { id: 'gelt', name: 'Chocolate Coin', e: '🪙' }, greet: ['Happy Hanukkah! 🕎', 'Chag sameach!'] },
  winter: { name: 'Winter Holidays', lights: ['#ef4444', '#22c55e', '#facc15', '#60a5fa'], prop: 'gift', pc: ['#ef4444', '#22c55e', '#3b82f6', '#facc15'], banner: '❄️ HAPPY HOLIDAYS', fx: 'snow', treat: { id: 'cocoa', name: 'Cocoa Cookie', e: '☕' }, greet: ['Happy holidays! ❄️', 'Stay cozy!'] },
  kwanzaa: { name: 'Kwanzaa', lights: ['#dc2626', '#16a34a', '#111827'], prop: 'candle', pc: ['#dc2626', '#16a34a', '#111827'], banner: '🕯️ HAPPY KWANZAA', fx: 'snow', treat: { id: 'corn', name: 'Harvest Corn', e: '🌽' }, greet: ['Happy Kwanzaa! 🕯️'] },
  newyearseve: { name: "New Year's Eve", lights: ['#ffd447', '#ffffff', '#c084fc'], prop: 'star', pc: ['#ffd447', '#c084fc'], banner: '🎉 COUNTDOWN TO MIDNIGHT', fx: 'fireworks', night: 1, treat: { id: 'confetti', name: 'Confetti Cake', e: '🎉' }, greet: ['Almost midnight! 🎉', 'Happy New Year’s Eve!'] },
};
for (const [id, s] of Object.entries(SEASONS)) s.id = id;

// windows for a year: [id, start, end (inclusive), priority]. Higher priority wins when windows overlap.
function windows(y) { const W = []; const w = (id, a, b, p) => W.push([id, a, b, p]);
  w('newyearseve', D(y, 11, 31), D(y, 11, 31), 100); w('newyear', D(y, 0, 1), D(y, 0, 2), 95);
  const mlk = nthDow(y, 0, 1, 3); w('mlk', add(mlk, -2), mlk, 80);
  if (LNY[y]) { const l = D(y, ...LNY[y]); w('lunar', add(l, -3), add(l, 6), 70); }
  w('valentines', D(y, 1, 7), D(y, 1, 14), 75); w('valentines', D(y, 1, 14), D(y, 1, 14), 90); const pr = nthDow(y, 1, 1, 3); w('presidents', add(pr, -2), pr, 80);
  w('stpatricks', D(y, 2, 14), D(y, 2, 17), 75); const e = easter(y); w('easter', add(e, -7), add(e, 1), 70); w('earthday', D(y, 3, 20), D(y, 3, 22), 75);
  const mo = nthDow(y, 4, 0, 2); w('mothers', add(mo, -3), mo, 75); const me = lastDow(y, 4, 1); w('memorial', add(me, -3), me, 85);
  w('juneteenth', D(y, 5, 17), D(y, 5, 19), 80); const fa = nthDow(y, 5, 0, 3); w('fathers', add(fa, -3), fa, 75); w('july4', D(y, 6, 1), D(y, 6, 4), 85);
  const lb = nthDow(y, 8, 1, 1); w('labor', add(lb, -3), lb, 75); w('halloween', D(y, 9, 1), D(y, 9, 31), 60);
  w('veterans', D(y, 10, 9), D(y, 10, 11), 85); const tg = nthDow(y, 10, 4, 4); w('thanksgiving', D(y, 10, 1), D(y, 10, 30), 40); w('thanksgiving', add(tg, -6), add(tg, 1), 76);
  if (HAN[y]) { const h = D(y, ...HAN[y]); w('hanukkah', h, add(h, 7), 72); } w('winter', D(y, 11, 1), D(y, 11, 30), 50); w('winter', D(y, 11, 24), D(y, 11, 25), 90);
  w('kwanzaa', D(y, 11, 26), D(y, 11, 30), 74); w('kwanzaa', D(y, 0, 1), D(y, 0, 1), 10); return W; }
const day0 = (d) => D(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function override() { try { const q = (location.search || '') + '&' + ((location.hash || '').split('?')[1] || ''); const m = /[?&]season=([a-z0-9]+)/i.exec(q); if (m && SEASONS[m[1]]) return m[1]; } catch { /* */ } return ''; }
export function seasonId(date = new Date()) { const o = override(); if (o) return o; const t = day0(date); let best = null;
  for (const [id, a, b, p] of windows(date.getFullYear())) if (t >= day0(a) && t <= day0(b) && (!best || p > best[1])) best = [id, p]; return best ? best[0] : 'normal'; }
export const currentSeason = (date = new Date()) => SEASONS[seasonId(date)];
export const isSeason = (id, date) => seasonId(date) === id;
