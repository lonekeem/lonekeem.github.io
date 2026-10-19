// Wardrobe + Jewelry & Accessories: original designs (no characters, logos or brands). Anyone can wear anything;
// g = 'g' | 'b' | 'a' only drives the Girls / Boys / All filter. Free items: id 'f_*' (rules let them be worn
// without a purchase). Premium items: letters-only ids, bought with Star Coins through the normal shop purchase.
export const WSLOTS = ['head', 'hair', 'face', 'ears', 'neck', 'body', 'bottom', 'full', 'feet', 'back', 'bag', 'held', 'wrist', 'hand'];
export const WSLOT_NAMES = { head: 'Hats & Crowns', hair: 'Hair & Bows', face: 'Glasses', ears: 'Earrings', neck: 'Necklaces', body: 'Tops', bottom: 'Bottoms', full: 'Dresses & Outfits', feet: 'Shoes', back: 'Capes & Wings', bag: 'Bags', held: 'Held Items', wrist: 'Bracelets & Watches', hand: 'Rings' };
export const JEWELRY = ['ears', 'neck', 'wrist', 'hand', 'face', 'bag'];
const C = { pink: '#ff8ac0', red: '#e8434f', blue: '#4a8aff', navy: '#2a3a7a', green: '#4ab070', yellow: '#ffd34d', purple: '#8a55dc', white: '#f6f2ff', black: '#2a2438', orange: '#ff8a2a', mint: '#7ae0c0', lilac: '#c8a8ff', gold: '#ffcf3a', silver: '#d0d8e8', rose: '#f0a0b0', teal: '#2ab0b0' };
const T = { pink: 'Pink', red: 'Red', blue: 'Blue', navy: 'Navy', green: 'Green', yellow: 'Sunny', purple: 'Purple', white: 'White', black: 'Midnight', orange: 'Orange', mint: 'Mint', lilac: 'Lilac', gold: 'Gold', silver: 'Silver', rose: 'Rose Gold', teal: 'Teal' };
// [base id, name, slot, style, g, colours, premium price (0 = free), rarity]
const BASE = [
  ['cap', 'Cap', 'head', 'cap', 'a', ['red', 'blue', 'black', 'green'], 0], ['beanie', 'Beanie', 'head', 'beanie', 'a', ['pink', 'navy', 'mint'], 0],
  ['bucket', 'Bucket Hat', 'head', 'bucket', 'a', ['yellow', 'lilac'], 0], ['tiara', 'Tiara', 'head', 'tiara', 'g', ['silver', 'gold', 'pink'], 150, 'r'],
  ['crown', 'Crown', 'head', 'crown', 'a', ['gold', 'silver'], 400, 'e'], ['tophat', 'Top Hat', 'head', 'tophat', 'b', ['black', 'purple'], 120, 'r'],
  ['helmet', 'Sports Helmet', 'head', 'helmet', 'b', ['blue', 'red'], 0], ['earband', 'Kitty Ear Band', 'head', 'earband', 'g', ['pink', 'black'], 0],
  ['wizhat', 'Wizard Hat', 'head', 'wizard', 'a', ['purple', 'navy'], 180, 'r'], ['holiday', 'Holiday Hat', 'head', 'santa', 'a', ['red', 'green'], 0],
  ['flowercrown', 'Flower Crown', 'head', 'flowers', 'g', ['pink'], 0],
  ['bow', 'Hair Bow', 'hair', 'bow', 'g', ['pink', 'red', 'white', 'lilac', 'mint'], 0], ['clip', 'Star Hair Clips', 'hair', 'clips', 'g', ['yellow', 'pink'], 0],
  ['pigtails', 'Pigtails', 'hair', 'pigtails', 'g', ['orange', 'black'], 0], ['bun', 'Top Bun', 'hair', 'bun', 'a', ['black', 'orange'], 0],
  ['quiff', 'Cool Quiff', 'hair', 'quiff', 'b', ['black', 'orange', 'blue'], 0], ['bigbowhair', 'Giant Bow', 'hair', 'bow2', 'g', ['red', 'gold'], 120, 'r'],
  ['specs', 'Round Glasses', 'face', 'round', 'a', ['black', 'gold'], 0], ['shades', 'Sunglasses', 'face', 'lens', 'a', ['black', 'pink', 'blue'], 0],
  ['heartshade', 'Heart Shades', 'face', 'heart', 'g', ['pink', 'red'], 90, 'r'], ['starshade', 'Star Shades', 'face', 'star', 'a', ['gold', 'purple'], 90, 'r'],
  ['studs', 'Stud Earrings', 'ears', 'stud', 'g', ['silver', 'gold', 'pink'], 0], ['hoops', 'Hoop Earrings', 'ears', 'hoop', 'g', ['gold', 'silver'], 80, 'r'],
  ['stardrop', 'Star Drops', 'ears', 'drop', 'g', ['gold', 'lilac'], 140, 'r'],
  ['beads', 'Bead Necklace', 'neck', 'beads', 'g', ['pink', 'mint', 'lilac'], 0], ['chain', 'Chunky Chain', 'neck', 'chain', 'b', ['gold', 'silver'], 120, 'r'],
  ['locket', 'Heart Locket', 'neck', 'locket', 'g', ['gold', 'rose'], 160, 'r'], ['medal', 'Star Medal', 'neck', 'medal', 'a', ['gold', 'silver'], 0],
  ['scarf', 'Knit Scarf', 'neck', 'scarf', 'a', ['red', 'blue', 'yellow'], 0], ['tie', 'Neck Tie', 'neck', 'tie', 'b', ['red', 'navy'], 0], ['bowtie', 'Bow Tie', 'neck', 'bowtie', 'a', ['black', 'red', 'purple'], 0],
  ['tee', 'T-Shirt', 'body', 'tee', 'a', ['white', 'red', 'blue', 'yellow', 'mint'], 0], ['hoodie', 'Hoodie', 'body', 'hoodie', 'a', ['purple', 'black', 'pink', 'green'], 0],
  ['jersey', 'Sports Jersey', 'body', 'jersey', 'b', ['red', 'blue', 'green'], 0], ['sweater', 'Cozy Sweater', 'body', 'sweater', 'a', ['orange', 'lilac'], 0],
  ['puffer', 'Winter Puffer', 'body', 'puffer', 'a', ['navy', 'pink', 'red'], 150, 'r'], ['blouse', 'Frilly Blouse', 'body', 'blouse', 'g', ['white', 'pink'], 0],
  ['shorts', 'Shorts', 'bottom', 'shorts', 'a', ['blue', 'navy', 'red'], 0], ['skirt', 'Skirt', 'bottom', 'skirt', 'g', ['pink', 'purple', 'navy'], 0],
  ['tutu', 'Tutu', 'bottom', 'tutu', 'g', ['pink', 'lilac', 'mint'], 0], ['jeans', 'Jeans', 'bottom', 'pants', 'a', ['blue', 'black'], 0],
  ['joggers', 'Joggers', 'bottom', 'pants', 'b', ['green', 'navy'], 0],
  ['dress', 'Party Dress', 'full', 'dress', 'g', ['pink', 'blue', 'yellow', 'purple'], 0], ['gown', 'Princess Gown', 'full', 'gown', 'g', ['pink', 'lilac', 'gold'], 300, 'e'],
  ['overalls', 'Overalls', 'full', 'overalls', 'a', ['blue', 'pink'], 0], ['pjs', 'Star PJs', 'full', 'pjs', 'a', ['navy', 'pink', 'mint'], 0],
  ['suit', 'Smart Suit', 'full', 'suit', 'b', ['black', 'navy'], 160, 'r'], ['kit', 'Soccer Kit', 'full', 'kit', 'b', ['red', 'blue', 'green'], 0],
  ['uniform', 'School Uniform', 'full', 'uniform', 'a', ['navy', 'green'], 0], ['wintercoat', 'Long Winter Coat', 'full', 'coat', 'a', ['red', 'teal'], 0],
  ['swim', 'Swimsuit', 'full', 'swim', 'a', ['teal', 'pink', 'orange'], 0], ['dino', 'Dino Costume', 'full', 'dino', 'a', ['green'], 200, 'r'],
  ['astro', 'Astronaut Suit', 'full', 'astro', 'a', ['white'], 350, 'e'], ['hero', 'Hero Suit', 'full', 'hero', 'a', ['red', 'blue'], 250, 'r'],
  ['jumper', 'Holiday Jumper', 'full', 'xmas', 'a', ['red', 'green'], 0],
  ['sneakers', 'Sneakers', 'feet', 'sneakers', 'a', ['white', 'red', 'blue', 'pink'], 0], ['boots', 'Boots', 'feet', 'boots', 'a', ['yellow', 'black'], 0],
  ['flats', 'Ballet Flats', 'feet', 'flats', 'g', ['pink', 'red'], 0], ['sandals', 'Sandals', 'feet', 'sandals', 'a', ['orange', 'mint'], 0], ['goldkicks', 'Golden Kicks', 'feet', 'sneakers', 'a', ['gold'], 300, 'e'],
  ['cape', 'Cape', 'back', 'cape', 'a', ['red', 'purple', 'navy'], 0], ['fairy', 'Fairy Wings', 'back', 'wings', 'g', ['lilac', 'mint'], 150, 'r'],
  ['angel', 'Angel Wings', 'back', 'angel', 'a', ['white'], 250, 'e'], ['jetpack', 'Toy Jetpack', 'back', 'jetpack', 'b', ['silver'], 220, 'r'],
  ['backpack', 'Backpack', 'bag', 'backpack', 'a', ['green', 'pink', 'blue'], 0], ['purse', 'Little Purse', 'bag', 'purse', 'g', ['pink', 'red', 'gold'], 0], ['satchel', 'Satchel', 'bag', 'satchel', 'b', ['orange'], 0],
  ['wand', 'Star Wand', 'held', 'wand', 'g', ['gold', 'pink'], 0], ['balloon', 'Balloon', 'held', 'balloon', 'a', ['red', 'blue', 'pink'], 0], ['icecream', 'Ice Cream', 'held', 'icecream', 'a', ['pink'], 0],
  ['teddy', 'Teddy', 'held', 'teddy', 'a', ['orange'], 0], ['guitar', 'Toy Guitar', 'held', 'guitar', 'b', ['red', 'blue'], 120, 'r'], ['ball', 'Ball', 'held', 'ball', 'b', ['white', 'orange'], 0],
  ['mic', 'Microphone', 'held', 'mic', 'a', ['silver', 'gold'], 100, 'r'], ['umbrella', 'Umbrella', 'held', 'umbrella', 'a', ['yellow', 'purple'], 0],
  ['bracelet', 'Bracelet', 'wrist', 'bracelet', 'g', ['gold', 'silver', 'pink'], 0], ['beadband', 'Bead Bracelet', 'wrist', 'beadband', 'a', ['mint', 'lilac'], 0],
  ['watch', 'Watch', 'wrist', 'watch', 'b', ['black', 'blue', 'silver'], 0], ['smartwatch', 'Glow Watch', 'wrist', 'watch', 'a', ['purple'], 110, 'r'],
  ['ring', 'Ring', 'hand', 'ring', 'a', ['gold', 'silver'], 0], ['gemring', 'Gem Ring', 'hand', 'gem', 'g', ['pink', 'blue', 'purple'], 140, 'r'], ['starring', 'Superstar Ring', 'hand', 'gem', 'a', ['gold'], 500, 'l'],
];
export const WEAR = [];
for (const [id, name, slot, st, g, cols, p, r] of BASE) for (const k of cols) {
  const wid = (p ? '' : 'f_') + id + (cols.length > 1 ? '_' + k : '');
  WEAR.push({ id: p ? wid.replace(/[^a-z_]/g, '').slice(0, 16) : wid.slice(0, 15), name: (cols.length > 1 ? T[k] + ' ' : '') + name, kind: 'wear', slot, st, col: C[k], p, r: r || 'c', g, free: !p });
}
export const WEAR_BY = Object.fromEntries(WEAR.map((w) => [w.id, w]));
// Looks: premium patterns and Rare Pal variants (needs users/{uid}/inv/{id})
export const PATTERNS = [
  { id: 'none', name: 'Plain', p: 0 }, { id: 'spots', name: 'Spots', p: 0 }, { id: 'stripes', name: 'Stripes', p: 0 }, { id: 'sparkle', name: 'Sparkle', p: 0 },
  { id: 'pt_hearts', name: 'Little Hearts', p: 150, r: 'r' }, { id: 'pt_stars', name: 'Starry', p: 150, r: 'r' }, { id: 'pt_rainbow', name: 'Rainbow Belly', p: 300, r: 'e' }, { id: 'pt_galaxy', name: 'Galaxy Swirls', p: 450, r: 'e' },
];
export const RARES = [
  { id: 'rare_shiny', name: 'Shiny', p: 600, r: 'e', desc: 'Pearly, glossy coat with a soft shimmer' },
  { id: 'rare_glow', name: 'Glowing', p: 900, r: 'e', desc: 'Softly glows in the dark' },
  { id: 'rare_galaxy', name: 'Galaxy', p: 1500, r: 'l', desc: 'Deep-space colours with twinkling stars' },
  { id: 'rare_gold', name: 'Golden', p: 2000, r: 'l', desc: 'Legendary gold coat' },
  { id: 'rare_crystal', name: 'Crystal', p: 1800, r: 'l', desc: 'See-through crystal sparkle' },
];
export const RARE = Object.fromEntries(RARES.map((r) => [r.id, r]));
