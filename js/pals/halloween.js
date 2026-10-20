// 🎃 Halloween costume collection for Kemy Pals. Every design is ORIGINAL (generic spooky-fun vibes, no movie
// characters, logos or look-alikes). Kid-safe: funny-spooky, no gore or blood (slime green / purple instead), and
// every prop is a clearly-toy foam / rubber / glow item. Written by Lone Keem.
// Ids: f_hw_* = free forever (the rules let f_* be worn without buying), hw_* = Star Coins (config/palShop.prices),
// z_hw_* = 👑 premium, Diamonds (config/palShop.dprices) with a placeholder Play Billing productId (not used yet).
// Full costumes ('full' slot) also add their matching set pieces (hair / hat / mask / tail / cape / prop) when that
// slot is empty, so one tap gives the whole look. 3D models: js/pals/halloween3d.js.
export const HW_ON = (d = new Date()) => d.getMonth() === 9; // the limited-time Halloween banner shows in October
export const HW_ENDS = (d = new Date()) => new Date(d.getFullYear(), 10, 1); // Nov 1, local time
export const hwProduct = (id) => 'kemy_costume_' + id.replace(/^(z_|f_)?hw_/, ''); // placeholder productId
const X = (id, name, slot, st, col, price, r, x = {}) => ({ id, name, kind: 'wear', slot, st, col, p: id.startsWith('z_') || id.startsWith('f_') ? 0 : price, r, g: 'a', hw: 1, free: id.startsWith('f_') || undefined, ...(id.startsWith('z_') ? { d: price, prem: 1, productId: hwProduct(id) } : {}), ...x });
export const HALLOWEEN = [
  // ---------------------------------------------------------------- 🆓 free (8)
  X('f_hw_boo', 'Boo Sheet Ghost', 'full', 'hw_boo', '#f6f3ff', 0, 'c', { icon: '👻' }),
  X('f_hw_skelly', 'Skelly Bones Suit', 'full', 'hw_skelly', '#24202e', 0, 'c', { icon: '💀' }),
  X('f_hw_jackhead', 'Jack-o-Lantern Head', 'head', 'hw_jack', '#ff8a1e', 0, 'c', { icon: '🎃' }),
  X('f_hw_witchhat', 'Witchy Hat', 'head', 'hw_witchhat', '#5b2a8a', 0, 'c', { icon: '🧙' }),
  X('f_hw_kitmask', 'Spooky Kitty Mask', 'face', 'hw_kitmask', '#2a2238', 0, 'c', { icon: '🐈‍⬛' }),
  X('f_hw_batwings', 'Bat Wings', 'back', 'hw_batwings', '#3a2a52', 0, 'c', { icon: '🦇' }),
  X('f_hw_glowwand', 'Glow Wand', 'held', 'hw_glowwand', '#9bff6a', 0, 'c', { icon: '🪄' }),
  X('f_hw_candy', 'Candy Pumpkin Pail', 'held', 'hw_candy', '#ff8a1e', 0, 'c', { icon: '🍬' }),
  // ---------------------------------------------------------------- ★ Star Coins: full costume sets (13)
  X('hw_stitchdoll', 'Stitch Doll', 'full', 'hw_stitchdoll', '#4f8fd0', 260, 'e', { icon: '🪡', set: 'yarn hair + button cheeks' }),
  X('hw_dreamfiend', 'Dream Fiend', 'full', 'hw_dreamfiend', '#6b3f9a', 280, 'e', { icon: '😴', set: 'squashy hat + foam claw mitt' }),
  X('hw_campghoul', 'Camp Ghoul', 'full', 'hw_campghoul', '#3f6b52', 240, 'r', { icon: '🏕️', set: 'white sports mask' }),
  X('hw_mummy', 'Mummy Wrap', 'full', 'hw_mummy', '#efe6cf', 200, 'r', { icon: '🧻', set: 'head wraps' }),
  X('hw_countfangs', 'Count Fangs', 'full', 'hw_countfangs', '#2a2238', 300, 'e', { icon: '🧛', set: 'high collar cape + toy fangs' }),
  X('hw_wolfpup', 'Wolf Pup', 'full', 'hw_wolfpup', '#8a7a6a', 260, 'e', { icon: '🐺', set: 'wolf-ear hood + fluffy tail' }),
  X('hw_frankenpal', 'Frankenpal', 'full', 'hw_frankenpal', '#5a6a4a', 260, 'e', { icon: '🔩', set: 'flat-top + toy neck bolts' }),
  X('hw_zombie', 'Zombie Shuffler', 'full', 'hw_zombie', '#7a8a9a', 200, 'r', { icon: '🧟', set: 'slime-patch beanie' }),
  X('hw_scarecrow', 'Scarecrow', 'full', 'hw_scarecrow', '#c0503a', 220, 'r', { icon: '🌾', set: 'straw hat' }),
  X('hw_bogbeast', 'Bog Beastie', 'full', 'hw_bogbeast', '#4a7a4a', 280, 'e', { icon: '🌿', set: 'mossy fin crown' }),
  X('hw_alien', 'Zap Alien', 'full', 'hw_alien', '#c8d4e8', 240, 'r', { icon: '👽', set: 'bobble antennae' }),
  X('hw_madsci', 'Mad Scientist', 'full', 'hw_madsci', '#f4f6fa', 220, 'r', { icon: '🧪', set: 'wild hair + goggles + toy flask' }),
  X('hw_witchy', 'Witchy Robe', 'full', 'hw_witchy', '#5b2a8a', 200, 'r', { icon: '🔮', set: 'pairs with the free Witchy Hat' }),
  // ---------------------------------------------------------------- ★ masks, hats, capes, toy props (10)
  X('hw_grinmask', 'Grin Mask', 'face', 'hw_grinmask', '#ffb02e', 120, 'r', { icon: '😁' }),
  X('hw_monstmask', 'Fuzzy Monster Mask', 'face', 'hw_monstmask', '#7ad070', 120, 'r', { icon: '👾' }),
  X('hw_ghostmask', 'Ghosty Mask', 'face', 'hw_ghostmask', '#f6f3ff', 100, 'c', { icon: '😶‍🌫️' }),
  X('hw_batmask', 'Bat Eye Mask', 'face', 'hw_batmask', '#3a2a52', 90, 'c', { icon: '🦇' }),
  X('hw_imphorns', 'Imp Horns', 'head', 'hw_imphorns', '#c23a8a', 90, 'c', { icon: '😈' }),
  X('hw_nightcape', 'Midnight Cape', 'back', 'hw_nightcape', '#2a1a4a', 160, 'r', { icon: '🦹' }),
  X('hw_foamaxe', 'Foam Toy Axe', 'held', 'hw_foamaxe', '#ffcf3a', 140, 'r', { icon: '🪓' }),
  X('hw_rubberclaws', 'Rubber Claws', 'held', 'hw_rubberclaws', '#9a6aff', 110, 'r', { icon: '🧤' }),
  X('hw_broom', 'Toy Broom', 'held', 'hw_broom', '#a0703a', 120, 'r', { icon: '🧹' }),
  X('hw_lantern', 'Boo Lantern', 'held', 'hw_lantern', '#ff8a1e', 130, 'r', { icon: '🏮' }),
  // ---------------------------------------------------------------- 👑 premium, Diamonds (6)
  X('z_hw_bride', 'Haunted Bride', 'full', 'hw_bride', '#e8e4f6', 1200, 'l', { icon: '👰', set: 'floaty veil + glow bouquet' }),
  X('z_hw_pumpking', 'Pumpkin King', 'full', 'hw_pumpking', '#ff7a1a', 1100, 'l', { icon: '👑', set: 'pumpkin crown + vine cape' }),
  X('z_hw_glowskel', 'Glow Skeleton', 'full', 'hw_glowskel', '#14121c', 900, 'l', { icon: '☠️', set: 'glowing skull hood' }),
  X('z_hw_plague', 'Plague Bird', 'full', 'hw_plague', '#2e2a3a', 900, 'l', { icon: '🐦‍⬛', set: 'cartoon beak mask + wide hat' }),
  X('z_hw_moonwitch', 'Moon Witch', 'full', 'hw_moonwitch', '#1f2a6a', 1000, 'l', { icon: '🌙', set: 'moon hat + star broom' }),
  X('z_hw_spectral', 'Spectral Wings', 'back', 'hw_spectral', '#a8f0ff', 800, 'l', { icon: '🪽' }),
];
export const HW_BY = Object.fromEntries(HALLOWEEN.map((w) => [w.id, w]));
