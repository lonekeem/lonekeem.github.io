// Pal Zombie Survival weapon catalog, splat-coin wallet, and loadout.
// Coins and owned guns live in localStorage (this device). Real-money coin packs stay off
// until a parent gate and a verified store purchase exist. Written by Lone Keem.
const KEY = (uid) => 'kemy-z-shop-' + (uid || 'guest');
const MAX_LEVEL = 5;
const RARITY_MULT = { common: 1, uncommon: 1.7, rare: 2.5, epic: 3.6, legendary: 5, mythic: 6.5 };
export const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// Future splat-coin packs. Do not render these while COIN_PACKS_ENABLED is false.
// Turning the flag on still needs a parent gate (js/parental.js) and a verified purchase
// (js/billing.js). purchaseCoinPack must not credit coins until that server check exists.
export const COIN_PACKS_ENABLED = false;
export const COIN_PACKS = [
  { id: 'splat_pouch', coins: 400, usd: 0.99, label: 'Splat Pouch' },
  { id: 'splat_sack', coins: 1400, usd: 3.99, label: 'Splat Sack' },
  { id: 'splat_vault', coins: 3200, usd: 7.99, label: 'Splat Vault' }
];
export const coinPacksForSale = () => (COIN_PACKS_ENABLED ? COIN_PACKS : []);
export async function purchaseCoinPack() {
  if (!COIN_PACKS_ENABLED) return { ok: false, reason: 'disabled' };
  return { ok: false, reason: 'not-wired' };
}

// Short cartoon synth presets. [wave, freqStart, freqEnd, seconds, gain]
export const SFX = {
  pew: ['square', 700, 300, 0.07, 0.05],
  foam: ['triangle', 300, 160, 0.12, 0.07],
  bub: ['sine', 500, 900, 0.18, 0.08],
  ice: ['sawtooth', 1500, 1100, 0.06, 0.03],
  bonk: ['triangle', 220, 90, 0.15, 0.1],
  poof: ['sine', 900, 1800, 0.18, 0.08],
  groan: ['sawtooth', 140, 80, 0.6, 0.05],
  hurt: ['square', 240, 160, 0.15, 0.06],
  pick: ['sine', 880, 1760, 0.15, 0.08],
  boom: ['sawtooth', 160, 40, 0.5, 0.12],
  wave: ['triangle', 523, 1046, 0.4, 0.08],
  pip: ['square', 1120, 740, 0.05, 0.045],
  tik: ['square', 520, 300, 0.035, 0.022],
  lob: ['triangle', 260, 110, 0.14, 0.07],
  shot: ['triangle', 170, 55, 0.16, 0.09],
  twang: ['triangle', 480, 160, 0.12, 0.07],
  splort: ['sine', 280, 150, 0.13, 0.06],
  party: ['square', 980, 520, 0.09, 0.05],
  pluff: ['sine', 210, 80, 0.16, 0.07],
  crack: ['square', 680, 360, 0.06, 0.045],
  scope: ['triangle', 190, 60, 0.2, 0.08],
  tap: ['square', 540, 250, 0.05, 0.04],
  seek: ['sine', 640, 920, 0.12, 0.05],
  boing: ['triangle', 420, 980, 0.1, 0.06],
  flame: ['sawtooth', 180, 70, 0.09, 0.035],
  plasma: ['sine', 280, 760, 0.12, 0.06],
  whoosh: ['sawtooth', 150, 48, 0.22, 0.07],
  zap: ['square', 1500, 380, 0.08, 0.04],
  spin: ['square', 380, 220, 0.03, 0.018],
  ray: ['sawtooth', 920, 680, 0.07, 0.03],
  comet: ['triangle', 560, 180, 0.16, 0.07],
  nova: ['sine', 740, 1280, 0.14, 0.06],
  halo: ['sine', 420, 700, 0.16, 0.06],
  prism: ['triangle', 620, 1480, 0.12, 0.055],
  star: ['square', 500, 1100, 0.16, 0.06],
  popboom: ['sawtooth', 210, 48, 0.28, 0.08],
  plip: ['sine', 880, 1400, 0.08, 0.04]
};

// Stats are tuned so the free Goo Blaster, Pop Pistol, and Pillow Hammer can clear waves.
// Bought guns add a new trick (splash, frost, chain) more than they replace skill.
// rate = seconds between shots. pierce = extra zombies a shot can pass through.
const LIST = [
  { id: 'goo', name: 'Goo Blaster', icon: '🟢', blurb: 'A friendly green blob gun. Your first pal-sized blaster.', rarity: 'common', price: 0, free: 1, shape: 'blaster', snd: 'pew', col: 0x6dff5a, rate: 0.16, dmg: 12, spd: 30, ammo: 30, rel: 1.1, range: 28, r: 0.16, pattern: 'single' },
  { id: 'pop', name: 'Pop Pistol', icon: '🟡', blurb: 'A little yellow sidearm with a crisp pop.', rarity: 'common', price: 0, free: 1, shape: 'pistol', snd: 'pip', col: 0xffd23f, rate: 0.3, dmg: 18, spd: 42, ammo: 12, rel: 0.95, range: 34, r: 0.1, pattern: 'single' },
  { id: 'hammer', name: 'Pillow Hammer', icon: '🛏️', blurb: 'A soft hammer that bonks zombies into sparkles.', rarity: 'common', price: 0, free: 1, shape: 'hammer', snd: 'bonk', col: 0xffc7e6, rate: 0.45, dmg: 36, melee: 1, range: 2.4, pattern: 'melee' },
  { id: 'zip', name: 'Zip SMG', icon: '💨', blurb: 'A zippy sprayer for close-up silly crowds.', rarity: 'common', price: 100, shape: 'smg', snd: 'tik', col: 0x7ee0ff, rate: 0.07, dmg: 6, spd: 34, ammo: 36, rel: 1.25, range: 18, r: 0.08, pattern: 'single', jitter: 0.06 },
  { id: 'sling', name: 'Gummy Sling', icon: '🍬', blurb: 'Lobs a bouncy gummy that pops into sprinkles.', rarity: 'common', price: 40, shape: 'launcher', snd: 'lob', col: 0xff7eb6, rate: 0.55, dmg: 24, spd: 15, ammo: 8, rel: 1.2, range: 22, r: 0.2, pattern: 'lob', lob: 1, explode: 1.6 },
  { id: 'boom', name: 'Party Popper', icon: '🎉', blurb: 'A wide confetti blast for zombies right in front of you.', rarity: 'uncommon', price: 180, shape: 'shotgun', snd: 'shot', col: 0xff8a3d, rate: 0.62, dmg: 8, spd: 28, ammo: 6, rel: 1.45, range: 11, r: 0.12, pattern: 'spread', spread: 6, spreadAng: 0.18 },
  { id: 'foam', name: 'Foam Launcher', icon: '🧽', blurb: 'Bouncy foam balls that splash a few zombies.', rarity: 'uncommon', price: 160, item: 'z_foam', shape: 'launcher', snd: 'foam', col: 0xffb347, rate: 0.5, dmg: 11, spd: 24, ammo: 12, rel: 1.3, range: 20, r: 0.2, pattern: 'spread', spread: 3, spreadAng: 0.12 },
  { id: 'cross', name: 'Candy Crossbow', icon: '🏹', blurb: 'A candy bolt that zips through a line of zombies.', rarity: 'uncommon', price: 220, shape: 'crossbow', snd: 'twang', col: 0xff5d73, rate: 0.48, dmg: 28, spd: 38, ammo: 10, rel: 1.35, range: 36, r: 0.1, pattern: 'single', pierce: 2 },
  { id: 'glue', name: 'Sticky Goo Gun', icon: '💚', blurb: 'Sticky green goo that makes zombies shuffle extra slow.', rarity: 'uncommon', price: 200, shape: 'pistol', snd: 'splort', col: 0x8dff6a, rate: 0.2, dmg: 9, spd: 22, ammo: 24, rel: 1.2, range: 16, r: 0.16, pattern: 'single', freeze: 0.85 },
  { id: 'confetti', name: 'Confetti Cracker', icon: '🎊', blurb: 'A cracker that showers the arena in paper sparkles.', rarity: 'uncommon', price: 240, shape: 'shotgun', snd: 'party', col: 0xff6ad5, rate: 0.55, dmg: 7, spd: 24, ammo: 8, rel: 1.35, range: 14, r: 0.11, pattern: 'spread', spread: 5, spreadAng: 0.16 },
  { id: 'marsh', name: 'Marshmallow Mortar', icon: '☁️', blurb: 'Lobs a toasted marshmallow that puffs into fluff.', rarity: 'uncommon', price: 260, shape: 'launcher', snd: 'pluff', col: 0xfff1d0, rate: 0.72, dmg: 30, spd: 14, ammo: 6, rel: 1.55, range: 24, r: 0.24, pattern: 'lob', lob: 1, explode: 2.3 },
  { id: 'pepper', name: 'Pepper Rifle', icon: '🌶️', blurb: 'A steady pepper rifle that pokes through the first zombie.', rarity: 'rare', price: 460, shape: 'rifle', snd: 'crack', col: 0xe24b3a, rate: 0.14, dmg: 18, spd: 44, ammo: 28, rel: 1.3, range: 38, r: 0.09, pattern: 'single', pierce: 1 },
  { id: 'scope', name: 'Moon Scope', icon: '🌙', blurb: 'A long moon-silver rifle. One careful shot, a big bonk.', rarity: 'rare', price: 620, shape: 'sniper', snd: 'scope', col: 0xc9e7ff, rate: 0.95, dmg: 72, spd: 70, ammo: 5, rel: 1.75, range: 48, r: 0.08, pattern: 'single', pierce: 3 },
  { id: 'drum', name: 'Drum Burst', icon: '🥁', blurb: 'A musical rifle that rattles out three quick notes.', rarity: 'rare', price: 500, shape: 'rifle', snd: 'tap', col: 0xf0b429, rate: 0.46, dmg: 12, spd: 40, ammo: 24, rel: 1.4, range: 32, r: 0.09, pattern: 'burst', burst: 3 },
  { id: 'pops', name: 'Popsicle Popper', icon: '🧊', blurb: 'A chilly scatter of popsicle chips that freeze the shuffle.', rarity: 'rare', price: 540, shape: 'shotgun', snd: 'ice', col: 0xbff4ff, rate: 0.52, dmg: 7, spd: 30, ammo: 12, rel: 1.45, range: 14, r: 0.11, pattern: 'spread', spread: 4, spreadAng: 0.14, freeze: 1.5 },
  { id: 'freeze', name: 'Freeze Ray', icon: '❄️', blurb: 'A frosty beam that turns zombies into popsicles.', rarity: 'rare', price: 560, item: 'z_freeze', shape: 'blaster', snd: 'ice', col: 0xbff4ff, rate: 0.08, dmg: 5, spd: 40, ammo: 70, rel: 1.4, range: 20, r: 0.12, pattern: 'beam', freeze: 1.7 },
  { id: 'bubble', name: 'Bubble Cannon', icon: '🫧', blurb: 'Big slow bubbles that float zombies up and away.', rarity: 'rare', price: 580, item: 'z_bubble', shape: 'cannon', snd: 'bub', col: 0x8fd8ff, rate: 0.7, dmg: 30, spd: 11, ammo: 8, rel: 1.6, range: 26, r: 0.42, pattern: 'single', pierce: 3, lift: 1 },
  { id: 'seeker', name: 'Seeker Bubbles', icon: '💙', blurb: 'Curious bubbles that curve toward the nearest zombie.', rarity: 'rare', price: 640, shape: 'blaster', snd: 'seek', col: 0x6aa7ff, rate: 0.34, dmg: 18, spd: 16, ammo: 14, rel: 1.35, range: 28, r: 0.2, pattern: 'single', homing: 5 },
  { id: 'bounce', name: 'Bouncy Blaster', icon: '🟣', blurb: 'A rubber shot that boings on to the next zombie.', rarity: 'rare', price: 600, shape: 'smg', snd: 'boing', col: 0xc084fc, rate: 0.22, dmg: 16, spd: 28, ammo: 18, rel: 1.3, range: 26, r: 0.12, pattern: 'single', bounce: 2 },
  { id: 'toast', name: 'Toasty Thrower', icon: '🔥', blurb: 'A short warm cone. Zombies get toasty, never scary.', rarity: 'epic', price: 1040, shape: 'flame', snd: 'flame', col: 0xff7a3c, rate: 0.08, dmg: 7, spd: 18, ammo: 50, rel: 1.6, range: 8.5, r: 0.2, pattern: 'flame', burn: 1.35, burnDps: 8 },
  { id: 'plasma', name: 'Plasma Pop', icon: '🟣', blurb: 'A round purple pop that splashes nearby zombies.', rarity: 'epic', price: 1180, shape: 'blaster', snd: 'plasma', col: 0xd56bff, rate: 0.32, dmg: 22, spd: 26, ammo: 16, rel: 1.45, range: 24, r: 0.2, pattern: 'single', explode: 1.8, explodeMul: 0.45 },
  { id: 'rocket', name: 'Confetti Rocket', icon: '🚀', blurb: 'A slow party rocket that blooms into confetti.', rarity: 'epic', price: 1320, shape: 'rocket', snd: 'whoosh', col: 0xff5b6e, rate: 0.9, dmg: 56, spd: 18, ammo: 4, rel: 1.9, range: 32, r: 0.18, pattern: 'rocket', explode: 4.2 },
  { id: 'spark', name: 'Jelly Lightning', icon: '⚡', blurb: 'A jelly zap that jumps to nearby zombies.', rarity: 'epic', price: 1260, shape: 'wand', snd: 'zap', col: 0xffe56a, rate: 0.38, dmg: 20, spd: 42, ammo: 12, rel: 1.45, range: 24, r: 0.1, pattern: 'single', chain: 3, chainRange: 5.5 },
  { id: 'spinner', name: 'Giggle Minigun', icon: '🌀', blurb: 'Spins up, then giggles out a stream of soft pellets.', rarity: 'epic', price: 1480, shape: 'minigun', snd: 'spin', col: 0x7d8cff, rate: 0.055, dmg: 6, spd: 36, ammo: 90, rel: 2.15, range: 20, r: 0.07, pattern: 'single', spin: 1, jitter: 0.05 },
  { id: 'beam', name: 'Rainbow Beam', icon: '🌈', blurb: 'A bright beam that paints every zombie in a straight line.', rarity: 'epic', price: 1400, shape: 'rifle', snd: 'ray', col: 0xff8ad8, rate: 0.18, dmg: 15, spd: 50, ammo: 20, rel: 1.6, range: 26, r: 0.12, pattern: 'beam' },
  { id: 'comet', name: 'Comet Bow', icon: '☄️', blurb: 'A gold comet that homes in and pops like fireworks.', rarity: 'legendary', price: 2300, shape: 'bow', snd: 'comet', col: 0xffd23f, rate: 0.55, dmg: 36, spd: 22, ammo: 8, rel: 1.55, range: 32, r: 0.16, pattern: 'rocket', homing: 6, explode: 2.5, skin: 'legend' },
  { id: 'nova', name: 'Nova Wand', icon: '✨', blurb: 'A purple wand that draws a glittering piercing beam.', rarity: 'legendary', price: 2500, shape: 'wand', snd: 'nova', col: 0xc9a6ff, rate: 0.22, dmg: 22, spd: 46, ammo: 16, rel: 1.5, range: 28, r: 0.12, pattern: 'beam', skin: 'legend' },
  { id: 'halo', name: 'Halo Hurler', icon: '😇', blurb: 'Throws a glowing ring that floats zombies off their feet.', rarity: 'legendary', price: 2100, shape: 'launcher', snd: 'halo', col: 0xffe9a3, rate: 0.58, dmg: 34, spd: 16, ammo: 8, rel: 1.5, range: 24, r: 0.28, pattern: 'single', pierce: 2, lift: 1, skin: 'legend' },
  { id: 'prism', name: 'Royal Prism', icon: '👑', blurb: 'A royal crystal shot that pierces, then jumps as sparkles.', rarity: 'mythic', price: 3800, shape: 'blaster', snd: 'prism', col: 0xb48cff, rate: 0.16, dmg: 18, spd: 34, ammo: 24, rel: 1.4, range: 28, r: 0.14, pattern: 'single', pierce: 2, chain: 2, chainRange: 5, skin: 'mythic' },
  { id: 'star', name: 'Star Cannon', icon: '🌟', blurb: 'The legendary Star Cannon in Kemy purple and gold. Homing stars that bloom into sparkles.', rarity: 'mythic', price: 4500, shape: 'cannon', snd: 'star', col: 0xb48cff, rate: 0.42, dmg: 48, spd: 28, ammo: 10, rel: 1.7, range: 34, r: 0.2, pattern: 'rocket', homing: 5.5, explode: 3.2, skin: 'mythic' }
];

export const WEAPON_LIST = LIST.map((w) => ({ ...w, hex: '#' + w.col.toString(16).padStart(6, '0') }));
export const WEAPONS = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, w]));
export const MAX_WEAPON_LEVEL = MAX_LEVEL;

export function tagsOf(w) {
  const t = [];
  if (!w) return t;
  if (w.pattern === 'spread') t.push('Spread');
  if (w.pattern === 'burst') t.push('Burst');
  if (w.pattern === 'beam') t.push('Beam');
  if (w.pattern === 'flame') t.push('Toasty');
  if (w.pattern === 'rocket' || w.pattern === 'lob' || w.explode) t.push('Splash');
  if (w.homing) t.push('Homing');
  if (w.bounce) t.push('Bounce');
  if (w.chain) t.push('Chain');
  if (w.freeze) t.push('Frost');
  if (w.burn && w.pattern !== 'flame') t.push('Toasty');
  if (w.pierce) t.push('Pierce');
  if (w.lift) t.push('Floaty');
  if (w.spin) t.push('Spin-up');
  if (w.lob || w.pattern === 'lob') t.push('Lob');
  if (w.melee) t.push('Bonk');
  if (w.skin === 'mythic' || w.skin === 'legend') t.push('Glow');
  return t;
}

export function combatMods(w, lvl = 1, bonus = {}) {
  const L = Math.max(0, Math.min(MAX_LEVEL, lvl || 1) - 1);
  const rate = (w.rate || 0.3) / (1 + 0.05 * L);
  return {
    dmg: (w.dmg || 0) * (1 + 0.12 * L) * (bonus.dmg || 1),
    rate,
    rel: (w.rel || 1) / (1 + 0.04 * L) / (bonus.fastReload || 1),
    mag: w.melee ? 0 : Math.max(1, Math.round((w.ammo || 1) * (1 + 0.08 * L) * (bonus.ammo || 1))),
    range: w.melee ? (w.range || 2.4) : (w.range || 24)
  };
}

// Bars are 0–100 against the whole catalog so a sniper looks different from a minigun.
export function statBars(w, lvl = 1) {
  const m = combatMods(w, lvl);
  const per = w.pattern === 'burst' ? m.dmg * (w.burst || 3) : m.dmg;
  const clamp = (n) => Math.max(4, Math.min(100, Math.round(n)));
  return [
    { k: 'Damage', v: w.melee ? Math.round(m.dmg) : Math.round(per), pct: clamp((per / 80) * 100), hint: w.pattern === 'spread' ? 'per pellet' : w.pattern === 'burst' ? 'per burst' : 'per hit' },
    { k: 'Fire rate', v: w.melee ? (1 / m.rate).toFixed(1) : (1 / m.rate).toFixed(1), pct: clamp(((1 / m.rate) / 16) * 100), hint: 'shots / sec' },
    { k: w.melee ? 'Swing' : 'Ammo', v: w.melee ? 'bonk' : m.mag, pct: w.melee ? 40 : clamp((m.mag / 100) * 100), hint: w.melee ? 'no reload' : 'per tank' },
    { k: 'Range', v: w.melee ? 'close' : Math.round(m.range) + 'm', pct: clamp(((w.melee ? 3 : m.range) / 48) * 100), hint: w.melee ? 'arm’s reach' : 'meters' }
  ];
}

export function upgradeCost(w, lvl) {
  const mult = RARITY_MULT[w.rarity] || 1;
  return Math.round(40 * Math.max(1, lvl) * mult);
}

export function killCoins(type, wave) {
  const base = { walk: 5, run: 7, chonk: 16, boss: 55 }[type] || 5;
  return Math.round(base * (1 + Math.max(0, wave) * 0.06));
}
export function waveCoins(wave) { return 18 + Math.max(1, wave) * 12; }

function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

function blank() {
  const owned = {};
  for (const w of WEAPON_LIST) if (w.free) owned[w.id] = { lvl: 1 };
  return { v: 1, coins: 0, owned, loadout: ['goo', 'pop', 'hammer'], equipped: 'goo' };
}

export function loadProgress(uid) {
  const base = blank();
  let raw = null;
  try { raw = JSON.parse(storeGet(KEY(uid)) || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object') return base;
  const owned = { ...base.owned };
  if (raw.owned && typeof raw.owned === 'object') {
    for (const [id, v] of Object.entries(raw.owned)) {
      if (!WEAPONS[id]) continue;
      const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.round((v && v.lvl) || 1)));
      owned[id] = { lvl };
    }
  }
  const loadout = [];
  for (const id of Array.isArray(raw.loadout) ? raw.loadout : base.loadout) {
    if (WEAPONS[id] && !loadout.includes(id)) loadout.push(id);
    if (loadout.length >= 3) break;
  }
  const coins = Math.max(0, Math.min(999999, Math.round(Number(raw.coins) || 0)));
  const equipped = WEAPONS[raw.equipped] ? raw.equipped : (loadout[0] || 'goo');
  return { v: 1, coins, owned, loadout, equipped };
}

export function saveProgress(uid, data) {
  const p = data || blank();
  storeSet(KEY(uid), JSON.stringify({ v: 1, coins: p.coins || 0, owned: p.owned || {}, loadout: p.loadout || [], equipped: p.equipped || 'goo' }));
  return p;
}

export function isOwned(prog, id, inv) {
  const w = WEAPONS[id];
  if (!w) return false;
  if (w.free) return true;
  if (prog && prog.owned && prog.owned[id]) return true;
  if (w.item && inv && inv[w.item]) return true;
  return false;
}

export function levelOf(prog, id) {
  const lvl = prog && prog.owned && prog.owned[id] && prog.owned[id].lvl;
  return Math.max(1, Math.min(MAX_LEVEL, lvl || 1));
}

export function ownedIds(prog, inv) {
  return WEAPON_LIST.map((w) => w.id).filter((id) => isOwned(prog, id, inv));
}

// Remember Armory guns (Diamonds / Star Coins) in the local wallet so they stay equipped offline.
export function acknowledge(uid, inv = {}) {
  const p = loadProgress(uid);
  let changed = false;
  for (const w of WEAPON_LIST) {
    if (w.free && !p.owned[w.id]) { p.owned[w.id] = { lvl: 1 }; changed = true; }
    if (w.item && inv && inv[w.item] && !p.owned[w.id]) { p.owned[w.id] = { lvl: 1 }; changed = true; }
  }
  if (changed) saveProgress(uid, p);
  return loadProgress(uid);
}

export function usableLoadout(prog, inv) {
  const out = [];
  for (const id of (prog && prog.loadout) || []) if (isOwned(prog, id, inv) && !out.includes(id)) out.push(id);
  for (const id of ['goo', 'pop', 'hammer']) if (out.length < 3 && isOwned(prog, id, inv) && !out.includes(id)) out.push(id);
  return out.slice(0, 3);
}

export function addCoins(uid, n) {
  const p = loadProgress(uid);
  p.coins = Math.max(0, Math.min(999999, Math.round((p.coins || 0) + (Number(n) || 0))));
  saveProgress(uid, p);
  return p.coins;
}

export function buyWeapon(uid, id, inv) {
  const w = WEAPONS[id];
  const p = acknowledge(uid, inv);
  if (!w) return { ok: false, reason: 'missing', prog: p };
  if (isOwned(p, id, inv)) return { ok: false, reason: 'owned', prog: p };
  if ((p.coins || 0) < w.price) return { ok: false, reason: 'coins', need: w.price - p.coins, prog: p };
  p.coins -= w.price;
  p.owned[id] = { lvl: 1 };
  saveProgress(uid, p);
  return { ok: true, prog: loadProgress(uid) };
}

export function upgradeWeapon(uid, id, inv) {
  const w = WEAPONS[id];
  const p = acknowledge(uid, inv);
  if (!w || !isOwned(p, id, inv)) return { ok: false, reason: 'locked', prog: p };
  const lvl = levelOf(p, id);
  if (lvl >= MAX_LEVEL) return { ok: false, reason: 'max', prog: p };
  const cost = upgradeCost(w, lvl);
  if (p.coins < cost) return { ok: false, reason: 'coins', need: cost - p.coins, cost, prog: p };
  p.coins -= cost;
  p.owned[id] = { lvl: lvl + 1 };
  saveProgress(uid, p);
  return { ok: true, cost, prog: loadProgress(uid) };
}

export function equipToSlot(uid, id, slot, inv) {
  const p = acknowledge(uid, inv);
  if (!isOwned(p, id, inv)) return { ok: false, reason: 'locked', prog: p };
  const loadout = usableLoadout(p, inv);
  while (loadout.length < 3) loadout.push('goo');
  const i = Math.max(0, Math.min(2, slot | 0));
  const prev = loadout.indexOf(id);
  if (prev >= 0 && prev !== i) loadout[prev] = loadout[i];
  loadout[i] = id;
  const uniq = [];
  for (const x of loadout) if (x && !uniq.includes(x)) uniq.push(x);
  p.loadout = uniq.slice(0, 3);
  p.equipped = id;
  saveProgress(uid, p);
  return { ok: true, prog: loadProgress(uid) };
}

export function weaponSvg(w) {
  const c = w.hex || '#fff';
  const ink = '#241244';
  const gold = '#ffd23f';
  const glow = w.skin === 'mythic' || w.skin === 'legend';
  const ring = glow ? `<circle cx="78" cy="36" r="30" fill="none" stroke="${gold}" stroke-width="3" opacity="0.9"/>` : '';
  const body = {
    pistol: `<path d="M34 40 h36 v8 h-14 l-6 14 h-10 z" fill="${ink}"/><rect x="40" y="30" width="46" height="10" rx="4" fill="${c}" stroke="${ink}" stroke-width="3"/>`,
    smg: `<rect x="28" y="34" width="70" height="8" rx="3" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="40" y="42" width="10" height="18" rx="2" fill="${ink}"/><rect x="54" y="42" width="16" height="14" rx="2" fill="${ink}"/>`,
    shotgun: `<rect x="24" y="32" width="78" height="12" rx="4" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="24" y="44" width="78" height="7" rx="3" fill="${ink}"/><rect x="30" y="26" width="28" height="8" rx="2" fill="${ink}"/>`,
    rifle: `<rect x="18" y="34" width="92" height="9" rx="3" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="36" y="43" width="22" height="12" rx="2" fill="${ink}"/><rect x="70" y="28" width="16" height="6" rx="2" fill="${ink}"/>`,
    sniper: `<rect x="12" y="36" width="102" height="7" rx="3" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="48" y="26" width="28" height="8" rx="3" fill="${ink}"/><circle cx="70" cy="30" r="3" fill="${gold}"/>`,
    minigun: `<rect x="30" y="28" width="62" height="6" rx="2" fill="${c}" stroke="${ink}" stroke-width="2"/><rect x="30" y="36" width="62" height="6" rx="2" fill="${c}" stroke="${ink}" stroke-width="2"/><rect x="30" y="44" width="62" height="6" rx="2" fill="${c}" stroke="${ink}" stroke-width="2"/><rect x="22" y="30" width="16" height="22" rx="3" fill="${ink}"/>`,
    rocket: `<rect x="28" y="30" width="58" height="18" rx="8" fill="${c}" stroke="${ink}" stroke-width="3"/><path d="M86 30 l16 9 l-16 9 z" fill="${gold}" stroke="${ink}" stroke-width="3"/><path d="M34 30 l10 -10 h12 l-6 10 z" fill="${ink}"/>`,
    flame: `<rect x="26" y="34" width="40" height="16" rx="6" fill="${ink}"/><rect x="58" y="36" width="28" height="12" rx="4" fill="${c}" stroke="${ink}" stroke-width="3"/><path d="M86 34 q16 8 0 16 q8 -4 0 -8 q8 -4 0 -8 z" fill="#ffd23f" stroke="${ink}" stroke-width="2"/>`,
    blaster: `<rect x="30" y="32" width="40" height="16" rx="8" fill="${ink}"/><circle cx="78" cy="40" r="14" fill="${c}" stroke="${ink}" stroke-width="3"/><circle cx="82" cy="36" r="4" fill="#fff"/>`,
    crossbow: `<path d="M30 40 h40" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M68 18 q28 22 0 44" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M70 22 l24 18 l-24 18" fill="none" stroke="${ink}" stroke-width="2"/>`,
    cannon: `<rect x="26" y="30" width="64" height="22" rx="10" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="34" y="34" width="10" height="14" fill="${gold}"/><rect x="52" y="34" width="10" height="14" fill="${gold}"/><path d="M92 41 l8 -10 l3 12 l-8 8 z" fill="${gold}" stroke="${ink}" stroke-width="2"/>`,
    wand: `<rect x="24" y="38" width="58" height="6" rx="3" fill="${ink}" transform="rotate(-20 50 40)"/><path d="M78 18 l4 10 l10 2 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -2 z" fill="${gold}" stroke="${ink}" stroke-width="2"/>`,
    hammer: `<rect x="28" y="36" width="36" height="8" rx="3" fill="#b48cff" stroke="${ink}" stroke-width="3"/><rect x="58" y="24" width="34" height="28" rx="8" fill="${c}" stroke="${ink}" stroke-width="3"/>`,
    launcher: `<rect x="24" y="30" width="70" height="20" rx="8" fill="${c}" stroke="${ink}" stroke-width="3"/><rect x="36" y="24" width="18" height="8" rx="3" fill="${ink}"/><circle cx="86" cy="40" r="8" fill="${gold}" stroke="${ink}" stroke-width="3"/>`,
    bow: `<path d="M40 14 q-24 26 0 52" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M40 16 l0 48" stroke="${ink}" stroke-width="2"/><path d="M40 40 h28" stroke="${gold}" stroke-width="4"/><path d="M68 40 l10 -6 v12 z" fill="${gold}" stroke="${ink}" stroke-width="2"/>`
  }[w.shape] || `<rect x="30" y="32" width="50" height="16" rx="6" fill="${c}" stroke="${ink}" stroke-width="3"/>`;
  return `<svg class="zw-svg" viewBox="0 0 120 72" aria-hidden="true">${ring}${body}</svg>`;
}

function wipeGun(gun) {
  const drop = [];
  gun.traverse((o) => { if (o !== gun) drop.push(o); });
  for (const o of drop) {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose && x.dispose());
    else if (m && m.dispose) m.dispose();
  }
  gun.clear();
}

export function buildGun(THREE, gun, w, L) {
  wipeGun(gun);
  if (!w) return;
  const c = w.col || 0xffffff;
  const ink = 0x241244;
  const gold = 0xffd23f;
  const add = (geo, y, col, em, sc, rot) => {
    const mat = L(em ? { emissive: col, emissiveIntensity: em } : {}, col);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    if (sc) mesh.scale.set(sc[0], sc[1], sc[2]);
    mesh.castShadow = false;
    gun.add(mesh);
    return mesh;
  };
  const ring = (y, col, spin) => {
    const m = add(new THREE.TorusGeometry(0.18, 0.022, 6, 16), y, col, 0.85, null, [Math.PI / 2, 0, 0]);
    m.userData.glow = 1; m.userData.spin = spin || 3; m.userData.ph = y;
    return m;
  };
  const shape = w.melee ? 'hammer' : w.shape;
  if (shape === 'hammer') {
    add(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 6), 0.3, 0xb48cff, 0);
    add(new THREE.BoxGeometry(0.38, 0.2, 0.26), 0.62, 0xffc7e6, 0);
    add(new THREE.BoxGeometry(0.16, 0.12, 0.3), 0.62, 0xff8fb8, 0.2);
  } else if (shape === 'pistol') {
    add(new THREE.BoxGeometry(0.1, 0.26, 0.12), 0.16, ink, 0);
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.36, 8), 0.32, c, 0.25);
    add(new THREE.SphereGeometry(0.07, 8, 6), 0.52, c, 0.7);
  } else if (shape === 'smg') {
    add(new THREE.BoxGeometry(0.08, 0.5, 0.09), 0.32, ink, 0);
    add(new THREE.CylinderGeometry(0.035, 0.04, 0.48, 8), 0.36, c, 0.2);
    add(new THREE.BoxGeometry(0.1, 0.16, 0.08), 0.18, 0x1b1030, 0);
    add(new THREE.SphereGeometry(0.05, 8, 6), 0.62, c, 0.6);
  } else if (shape === 'shotgun') {
    add(new THREE.BoxGeometry(0.14, 0.28, 0.12), 0.16, ink, 0);
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 8), 0.34, c, 0.15, [1, 1, 1], null);
    add(new THREE.CylinderGeometry(0.04, 0.045, 0.5, 8), 0.34, 0xfff6e8, 0.1, null, null);
    gun.children[gun.children.length - 1].position.z = 0.07;
    gun.children[gun.children.length - 2].position.z = -0.05;
    add(new THREE.BoxGeometry(0.12, 0.08, 0.1), 0.58, gold, 0.3);
  } else if (shape === 'rifle') {
    add(new THREE.BoxGeometry(0.09, 0.34, 0.1), 0.18, ink, 0);
    add(new THREE.CylinderGeometry(0.035, 0.04, 0.7, 8), 0.4, c, 0.2);
    add(new THREE.BoxGeometry(0.08, 0.16, 0.06), 0.5, ink, 0);
    add(new THREE.SphereGeometry(0.045, 8, 6), 0.76, c, 0.55);
  } else if (shape === 'sniper') {
    add(new THREE.BoxGeometry(0.08, 0.3, 0.08), 0.16, ink, 0);
    add(new THREE.CylinderGeometry(0.028, 0.032, 0.9, 8), 0.46, c, 0.25);
    const scope = add(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8), 0.62, ink, 0);
    scope.position.z = 0.08;
    add(new THREE.SphereGeometry(0.04, 8, 6), 0.92, gold, 0.8);
  } else if (shape === 'minigun') {
    add(new THREE.BoxGeometry(0.2, 0.22, 0.2), 0.2, ink, 0);
    for (let i = 0; i < 4; i++) {
      const m = add(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), 0.48, c, 0.35);
      const a = (i / 4) * Math.PI * 2;
      m.position.x = Math.cos(a) * 0.08; m.position.z = Math.sin(a) * 0.08;
    }
    const spin = add(new THREE.TorusGeometry(0.12, 0.02, 6, 12), 0.34, gold, 0.6, null, [Math.PI / 2, 0, 0]);
    spin.userData.glow = 1; spin.userData.spin = 8;
  } else if (shape === 'rocket') {
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.46, 8), 0.32, c, 0.25);
    add(new THREE.ConeGeometry(0.09, 0.16, 8), 0.6, gold, 0.7);
    add(new THREE.BoxGeometry(0.22, 0.06, 0.08), 0.2, ink, 0);
    add(new THREE.BoxGeometry(0.08, 0.06, 0.22), 0.2, ink, 0);
  } else if (shape === 'flame') {
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.28, 8), 0.2, ink, 0);
    add(new THREE.CylinderGeometry(0.06, 0.09, 0.28, 8), 0.42, c, 0.35);
    add(new THREE.ConeGeometry(0.1, 0.16, 8), 0.62, 0xffd23f, 0.8);
  } else if (shape === 'crossbow') {
    add(new THREE.BoxGeometry(0.08, 0.5, 0.08), 0.28, ink, 0);
    add(new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI), 0.48, c, 0.4, null, [0, 0, Math.PI]);
    add(new THREE.ConeGeometry(0.05, 0.16, 6), 0.7, gold, 0.5);
  } else if (shape === 'cannon') {
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.48, 10), 0.34, c, 0.35);
    add(new THREE.TorusGeometry(0.13, 0.025, 6, 12), 0.22, gold, 0.7, null, [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.13, 0.025, 6, 12), 0.46, gold, 0.7, null, [Math.PI / 2, 0, 0]);
    const star = add(new THREE.OctahedronGeometry(0.12), 0.66, gold, 0.95);
    star.userData.glow = 1; star.userData.spin = 4;
  } else if (shape === 'wand') {
    add(new THREE.CylinderGeometry(0.025, 0.03, 0.7, 6), 0.34, ink, 0);
    const star = add(new THREE.OctahedronGeometry(0.12), 0.74, gold, 0.9);
    star.userData.glow = 1; star.userData.spin = 5;
    add(new THREE.SphereGeometry(0.06, 8, 6), 0.74, c, 0.8);
  } else if (shape === 'bow') {
    add(new THREE.TorusGeometry(0.28, 0.028, 6, 14, Math.PI * 1.15), 0.36, c, 0.45, null, [0, 0, Math.PI * 0.9]);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), 0.36, gold, 0.4);
    add(new THREE.ConeGeometry(0.06, 0.14, 6), 0.62, gold, 0.7);
  } else if (shape === 'launcher') {
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8), 0.34, c, 0.3);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.12), 0.5, ink, 0);
    add(new THREE.SphereGeometry(0.09, 8, 6), 0.64, gold, 0.55);
  } else {
    add(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8), 0.28, 0x6a4bc4, 0);
    add(new THREE.SphereGeometry(0.12, 10, 8), 0.5, c, 0.55);
  }
  if (w.skin === 'legend' || w.skin === 'mythic') {
    ring(0.28, gold, 3);
    if (w.skin === 'mythic') {
      ring(0.5, 0xb48cff, -4);
      const light = new THREE.PointLight(0xffd23f, 1.1, 2.8, 2);
      light.position.y = 0.45; light.userData.lamp = 1; gun.add(light);
    }
  }
  gun.scale.setScalar(shape === 'minigun' || shape === 'cannon' ? 1.85 : shape === 'pistol' ? 1.45 : 1.6);
  gun.userData.skin = w.skin || '';
}

export function catalogIssues() {
  const issues = [];
  if (WEAPON_LIST.length < 25) issues.push('need 25+ weapons, have ' + WEAPON_LIST.length);
  const ids = new Set(); const names = new Set(); const snds = new Set(); const shapes = new Set();
  const patterns = new Set();
  for (const w of WEAPON_LIST) {
    if (ids.has(w.id)) issues.push('dup id ' + w.id);
    ids.add(w.id); names.add(w.name); snds.add(w.snd); shapes.add(w.shape); patterns.add(w.pattern);
    if (!w.name || !w.blurb || !w.snd || !w.shape || !RARITY_LABEL[w.rarity]) issues.push('incomplete ' + w.id);
    if (!SFX[w.snd]) issues.push('missing sfx ' + w.id);
    if (!(w.dmg > 0) || !(w.rate > 0)) issues.push('stats ' + w.id);
    if (w.price < 0 || (w.free && w.price !== 0)) issues.push('price ' + w.id);
    const dps = (w.pattern === 'burst' ? w.dmg * (w.burst || 3) : w.dmg) / w.rate;
    if (dps > 200) issues.push('dps high ' + w.id + ' ' + dps.toFixed(0));
  }
  if (names.size !== WEAPON_LIST.length) issues.push('dup names');
  if (snds.size < 20) issues.push('sounds too similar');
  if (shapes.size < 10) issues.push('shapes too similar');
  for (const p of ['single', 'spread', 'burst', 'beam', 'flame', 'rocket', 'lob', 'melee']) if (!patterns.has(p)) issues.push('missing pattern ' + p);
  if (!WEAPON_LIST.some((w) => w.homing)) issues.push('no homing');
  if (!WEAPON_LIST.some((w) => w.chain)) issues.push('no chain');
  if (!WEAPON_LIST.some((w) => w.bounce)) issues.push('no ricochet');
  if (!WEAPON_LIST.some((w) => w.freeze)) issues.push('no freeze');
  if (!WEAPON_LIST.some((w) => w.burn)) issues.push('no burn');
  if (!WEAPON_LIST.some((w) => w.pierce)) issues.push('no pierce');
  if (!WEAPON_LIST.some((w) => w.id === 'star' && w.skin === 'mythic')) issues.push('star cannon');
  if (COIN_PACKS_ENABLED || coinPacksForSale().length) issues.push('coin packs should be hidden');
  const goo = WEAPONS.goo; const gooDps = goo.dmg / goo.rate;
  if (gooDps < 50 || gooDps > 100) issues.push('starter dps ' + gooDps);
  return issues;
}
