// Pal Shop catalog: wearables, decor, toys and snacks, priced in Star Coins.
// The same prices are stored in Firestore config/palShop (admin-write only) and the rules check every purchase against it.
// kind: wear | decor | toy | snack. slot (wear only): head | face | neck | body | feet | back. r: rarity.
export const RARITY = { c: { name: 'Common', col: '#9aa3b5' }, r: { name: 'Rare', col: '#4aa8ff' }, e: { name: 'Epic', col: '#b26bff' }, l: { name: 'Legendary', col: '#ffb31a' } };
export const SLOTS = ['head', 'face', 'neck', 'body', 'feet', 'back'];
export const SLOT_NAMES = { head: 'Hats', face: 'Glasses', neck: 'Neck', body: 'Tops', feet: 'Shoes', back: 'Back' };
const W = (id, name, slot, st, col, p, r, x = {}) => ({ id, name, kind: 'wear', slot, st, col, p, r, ...x });
export const ITEMS = [
  // head
  W('beanie', 'Cozy Beanie', 'head', 'beanie', '#ff7a8a', 60, 'c'), W('cap', 'Sporty Cap', 'head', 'cap', '#4aa8ff', 60, 'c'),
  W('bigbow', 'Big Bow', 'head', 'bow', '#ff6fae', 50, 'c'), W('tophat', 'Top Hat', 'head', 'tophat', '#3a2a63', 150, 'r'),
  W('flowers', 'Flower Crown', 'head', 'flowers', '#ffb3d9', 140, 'r'), W('wizard', 'Star Wizard Hat', 'head', 'wizard', '#6b4fd6', 300, 'e'),
  W('goldcrown', 'Royal Crown', 'head', 'crown', '#ffd34d', 900, 'l'), W('bunnyband', 'Bunny Headband', 'head', 'bunny', '#fff0f8', 110, 'r'),
  W('santa', 'Winter Hat', 'head', 'santa', '#e8434f', 120, 'r', { season: 'winter' }), W('witch', 'Spooky Hat', 'head', 'witch', '#4a2a7a', 120, 'r', { season: 'fall' }),
  W('pumpkin', 'Pumpkin Hat', 'head', 'pumpkin', '#ff8a2a', 160, 'r', { season: 'fall' }), W('halo', 'Glowy Halo', 'head', 'halo', '#ffe680', 400, 'e'),
  // face
  W('roundspecs', 'Round Specs', 'face', 'round', '#3a2a63', 50, 'c'), W('heartshades', 'Heart Shades', 'face', 'heart', '#ff4f8f', 120, 'r'),
  W('starshades', 'Star Shades', 'face', 'star', '#ffd34d', 120, 'r'), W('monocle', 'Fancy Monocle', 'face', 'monocle', '#d4a020', 220, 'e'),
  W('goggles', 'Swim Goggles', 'face', 'goggles', '#3ac0d0', 90, 'c'),
  // neck
  W('redscarf', 'Knit Scarf', 'neck', 'scarf', '#ff7a8a', 50, 'c'), W('bowtie', 'Bow Tie', 'neck', 'bowtie', '#6b4fd6', 60, 'c'),
  W('bandana', 'Bandana', 'neck', 'bandana', '#4aa8ff', 60, 'c'), W('pearls', 'Pearl Necklace', 'neck', 'pearls', '#fff8f0', 260, 'e'),
  W('bell', 'Jingle Bell', 'neck', 'bell', '#ffd34d', 90, 'r', { season: 'winter' }),
  // body
  W('tee', 'Comfy Tee', 'body', 'tee', '#7ec8ff', 70, 'c'), W('hoodie', 'Purple Hoodie', 'body', 'hoodie', '#8a55dc', 160, 'r'),
  W('dress', 'Twirly Dress', 'body', 'dress', '#ff9ccf', 160, 'r'), W('stripes', 'Stripy Sweater', 'body', 'sweater', '#ffb31a', 120, 'r'),
  W('overalls', 'Little Overalls', 'body', 'overalls', '#5a7ad6', 120, 'r'), W('tutu', 'Sparkle Tutu', 'body', 'tutu', '#ffc6f0', 280, 'e'),
  W('jersey', 'KL Jersey', 'body', 'jersey', '#8a2be2', 200, 'e'), W('raincoat', 'Rain Coat', 'body', 'raincoat', '#ffd84d', 110, 'c'),
  // feet
  W('sneakers', 'Sneakers', 'feet', 'sneakers', '#ff5a6a', 70, 'c'), W('boots', 'Rain Boots', 'feet', 'boots', '#ffd34d', 90, 'c'),
  W('slippers', 'Bunny Slippers', 'feet', 'slippers', '#fff0f8', 130, 'r'), W('goldshoes', 'Golden Kicks', 'feet', 'sneakers', '#ffcf3a', 450, 'e'),
  // back
  W('cape', 'Hero Cape', 'back', 'cape', '#e8434f', 180, 'r'), W('backpack', 'Tiny Backpack', 'back', 'backpack', '#5fae6e', 100, 'c'),
  W('fairy', 'Fairy Wings', 'back', 'wings', '#d8f0ff', 350, 'e'), W('balloon', 'Star Balloon', 'back', 'balloon', '#ff6fae', 80, 'c'),
  W('galaxycape', 'Galaxy Cape', 'back', 'cape', '#2a1a6a', 1200, 'l'),
  // achievement-only (cannot be bought)
  W('ach_glow', 'Glow-Up Crown', 'head', 'crown', '#ff9cf5', 0, 'l', { ach: 'glow', how: 'Glow a Pal up to its final form (level 12)' }),
  W('ach_coins', 'Coin Collector Shades', 'face', 'star', '#ffcf3a', 0, 'e', { ach: 'coins', how: 'Earn 1,000 Star Coins in total' }),
  W('ach_family', 'Pal Family Scarf', 'neck', 'scarf', '#b26bff', 0, 'e', { ach: 'family', how: 'Have 3 Pals in your Pal Box' }),
  W('ach_champ', 'Champion Cape', 'back', 'cape', '#ffd34d', 0, 'l', { ach: 'champ', how: 'Win 5 Pal Games' }),
  // decor (shows in your Pal's corner on your profile)
  { id: 'rug', name: 'Fluffy Rug', kind: 'decor', st: 'rug', col: '#ffb3d9', p: 80, r: 'c' }, { id: 'plant', name: 'Potted Plant', kind: 'decor', st: 'plant', col: '#5fae6e', p: 70, r: 'c' },
  { id: 'lamp', name: 'Moon Lamp', kind: 'decor', st: 'lamp', col: '#ffe680', p: 140, r: 'r' }, { id: 'bed', name: 'Cloud Bed', kind: 'decor', st: 'bed', col: '#e4d6ff', p: 200, r: 'r' },
  { id: 'castle', name: 'Toy Castle', kind: 'decor', st: 'castle', col: '#c8a0ff', p: 500, r: 'e' }, { id: 'rainbow', name: 'Rainbow Arch', kind: 'decor', st: 'rainbow', col: '#ff7a8a', p: 1000, r: 'l' },
  { id: 'pumpkins', name: 'Pumpkin Patch', kind: 'decor', st: 'pumpkins', col: '#ff8a2a', p: 120, r: 'r', season: 'fall' }, { id: 'tree', name: 'Twinkle Tree', kind: 'decor', st: 'tree', col: '#3f9a5a', p: 160, r: 'r', season: 'winter' },
  // toys (play items: extra happiness in play)
  { id: 'ball', name: 'Bouncy Ball', kind: 'toy', st: 'ball', col: '#ff6fae', p: 30, r: 'c' }, { id: 'yarn', name: 'Yarn Ball', kind: 'toy', st: 'yarn', col: '#b26bff', p: 40, r: 'c' },
  { id: 'duck', name: 'Bath Duck', kind: 'toy', st: 'duck', col: '#ffd34d', p: 50, r: 'c' }, { id: 'kite', name: 'Star Kite', kind: 'toy', st: 'kite', col: '#4aa8ff', p: 120, r: 'r' },
  // special Pal voices (Star Coins)
  { id: 'vx_royal', name: 'Royal Voice', kind: 'voice', st: 'mic', col: '#ffd34d', p: 300, r: 'e' }, { id: 'vx_space', name: 'Space Cadet Voice', kind: 'voice', st: 'mic', col: '#5aa8ff', p: 250, r: 'r' },
  { id: 'vx_bonjour', name: 'Bonjour Bun Voice', kind: 'voice', st: 'mic', col: '#ff9ccf', p: 250, r: 'r' }, { id: 'vx_star', name: 'Superstar Voice', kind: 'voice', st: 'mic', col: '#b26bff', p: 800, r: 'l' },
  // snacks (consumable, each one fills hunger a lot)
  { id: 'berry', name: 'Berry Snack', kind: 'snack', st: 'berry', col: '#ff4f6f', p: 10, r: 'c' }, { id: 'cookie', name: 'Star Cookie', kind: 'snack', st: 'cookie', col: '#e0a060', p: 15, r: 'c' },
  { id: 'cake', name: 'Party Cake', kind: 'snack', st: 'cake', col: '#ffc6f0', p: 40, r: 'r' }, { id: 'goldapple', name: 'Golden Apple', kind: 'snack', st: 'apple', col: '#ffcf3a', p: 90, r: 'e' }
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
// Daily Deals: a rotation the rules can also compute (day number since epoch % length).
export const DEALS = [
  { hoodie: 110, berry: 6, plant: 45 }, { tophat: 100, cookie: 9, lamp: 95 }, { dress: 110, ball: 18, rug: 50 }, { cape: 120, cake: 25, bed: 140 },
  { wizard: 210, duck: 30, sneakers: 45 }, { flowers: 95, kite: 80, goldapple: 60 }, { tutu: 190, yarn: 25, castle: 350 }
];
export const dayNo = (ms = Date.now()) => Math.floor(ms / 86400000);
export const todaysDeals = () => DEALS[dayNo() % DEALS.length];
// Star Coin earning: per-write max and per-day cap per source (mirrored in firestore.rules)
export const EARN = { daily: [50, 50], care: [5, 60], win: [25, 150], quest: [10, 60], stars: [5, 50], park: [10, 100], chat: [2, 20] };
// for config/palShop: { prices: {id: p}, kinds: {id: kind}, deals: [ {id: p} ] }
export function shopDoc() {
  const prices = {}, kinds = {};
  for (const i of ITEMS) if (!i.ach) { prices[i.id] = i.p; kinds[i.id] = i.kind; }
  const dprices = {}; for (const i of DITEMS) { dprices[i.id] = i.d; kinds[i.id] = i.kind; }
  return { prices, kinds, deals: DEALS, dprices, v: 1 };
}
// Items registered at runtime (dances from js/pals/dance.js + data/pal-dances.json). They join shopDoc() too.
export function addItems(list) { for (const it of list) if (!ITEM[it.id]) { ITEMS.push(it); ITEM[it.id] = it; } }
// Diamond-priced items (Zombie Armory). Checked by firestore.rules against config/palShop.dprices.
export const DITEMS = [];
export function addDiamondItems(list) { for (const it of list) if (!DITEMS.some((x) => x.id === it.id)) DITEMS.push(it); }
