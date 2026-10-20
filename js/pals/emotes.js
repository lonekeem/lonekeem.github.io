// Kemy Emotes: 50+ ORIGINAL emotes and dances (no copied or trademarked moves/names) for 3D Pals.
// Every entry is a 3D clip in the dances3d.js pose format (hip/spine/chest/head + arms [abduct, forward, elbow, twist]
// + legs [lift, spread, knee]); clipFor() adds the groove layer and motion3d plants the feet with IK, so they work for
// small / medium / big Pals, outfits and held items. A 2D fallback pose is derived automatically.
// Shop: free starters, Star Coins items (inv dn_<id>), and a gold PREMIUM tier priced in Diamonds for now
// (inv z_dn_<id>, so the existing Diamonds rules accept them). Each premium item carries a placeholder Play Billing
// productId (kemy_dance_<id>) for later; NO real-money purchase flow is enabled.
import { register3D } from './dances3d.js';

const K = (beats, keys, o = {}) => ({ beats, keys, ...o });
const N = { aL: [24, 6, 14], aR: [24, 6, 14] };
// cat: quick (short reaction), dance (looping, beat-synced), silly. r: c/r/l rarity (Star Coins). free / prem.
// ---------------------------------------------------------------- DISPLAY NAMES (edit here)
// id -> name shown in the wheel, shop and bubbles. Ids, owned-item ids (dn_/z_dn_), productIds and prices never change.
export const EMOTE_NAMES = {
  hiwave: "Kemy Hello",
  cheer: "Lone Keem Cheer",
  giggle: "Giggle Bubbles",
  thumbsyes: "Thumbs Up Kemy",
  clapclap: "Bubble Clap",
  bow: "Axolotl Bow",
  shrug: "Kemy Shrug",
  salute: "Star Captain Salute",
  facepalm: "Oopsie Kemy",
  hearthands: "Pal Heart",
  flex: "Mighty Pal Flex",
  sleepy: "Sleepy Axolotl",
  spinout: "Swirly Spin",
  joyjump: "Kemy Joy Jump",
  lookthere: "Over There, Pal!",
  thinker: "Big Brain Bubble",
  nodyes: "Yes-Yes Bop",
  nopenope: "Nuh-Uh Wiggle",
  peacesign: "Peace & Pals",
  victory: "Champion Kemy",
  boohoo: "Bubble Tears",
  sparkstep: "Kemy Shuffle",
  moonbounce: "Lone Keem Bounce",
  jellywiggle: "Jelly Jam",
  pixelpop: "Pixel Pal Pop",
  boogiebot: "Kemy-Bot Boogie",
  kneeknock: "Wobble Knees",
  stompclap: "Studio Stomp",
  boxstep: "Pal Box Step",
  fingersnap: "Purple Drip",
  skatesway: "Lagoon Glide",
  airguitar: "Keem Rock Riff",
  airdrums: "Bubble Drum Solo",
  djscratch: "DJ Kemy",
  propeller: "Fin Copter",
  zoomzoom: "Turbo Paws",
  waverider: "Axolotl Flow",
  cosmicfloat: "Space Pal Drift",
  hopscotch: "Hop-a-Lot",
  rollercoaster: "Coaster Kemy",
  popnlock: "Pop & Sparkle",
  cloudwalk: "Cloud Hopper Glide",
  chickenflap: "Cluck Cluck Flap",
  noodlearms: "Spaghetti Arms",
  waddle: "Waddle Pal",
  dizzyspin: "Dizzy Bubbles",
  froghop: "Lily Pad Leap",
  bigsneeze: "Ah-Choo Kemy",
  tickled: "Tickle Trouble",
  jellylegs: "Wiggly Legs",
  starburst: "Kemy Supernova",
  galaxyglide: "Axolotl Galaxy Glide",
  rocketroll: "Lone Keem Rocket",
  turbotwist: "Purple Tornado",
  thunderclap: "Thunder Fins",
  neonpulse: "Neon Kemy Pulse",
  crownstrut: "Royal Axolotl Strut",
  phoenixrise: "Fire Pal Rise",
  hyperhop: "Hyper Bunny Bop",
  electroflow: "Kemy Volt Flow",
  meteorspin: "Shooting Star Spin",
  rainbowwave: "Rainbow Fin Wave",
};
const E = (id, name, icon, cat, clip, o = {}) => ({ id, name: EMOTE_NAMES[id] || name, icon, cat, clip, ...o });
const S = Math.PI;
export const EMOTE_LIST = [
  // ---------------------------------------------------------------- quick emotes
  E('hiwave', 'Hello Wave', '👋', 'quick', K(2, [{ hrz: 0.05, nz: 0.12, aR: [158, 12, 40], aL: [22, 8, 16] }, { hrz: 0.05, nz: 0.08, aR: [150, 12, 70, -20] }]), { free: 1, say: 'Hi!' }),
  E('cheer', 'Big Cheer', '🙌', 'quick', K(2, [{ hy: -0.1, aL: [40, 20, 60], aR: [40, 20, 60], cx: 0.08 }, { hy: 0.22, aL: [168, 10, 20], aR: [168, 10, 20], nx: -0.2, lL: [15, 5, 30], lR: [15, 5, 30], star: 1 }]), { free: 1 }),
  E('giggle', 'Giggle Fit', '😂', 'quick', K(1, [{ cx: 0.18, nx: 0.15, aL: [30, 40, 110], aR: [30, 40, 110], hy: -0.05, hrz: 0.05 }, { cx: 0.05, nx: -0.12, aL: [34, 35, 100], aR: [34, 35, 100], hy: -0.02, hrz: -0.05 }]), { free: 1 }),
  E('thumbsyes', 'Thumbs Up', '👍', 'quick', K(2, [{ aR: [40, 70, 95, 70], aL: [24, 6, 14], nz: -0.08, hy: -0.03 }, { aR: [45, 78, 100, 70], nz: 0.06, nx: 0.08 }]), { free: 1 }),
  E('clapclap', 'Clap Clap', '👏', 'quick', K(1, [{ aL: [40, 75, 70, -40], aR: [40, 75, 70, -40], hy: -0.04 }, { aL: [32, 80, 80, -40], aR: [32, 80, 80, -40], hy: -0.01 }]), { free: 1 }),
  E('bow', 'Polite Bow', '🙇', 'quick', K(4, [N, { sx: 0.25, cx: 0.45, nx: 0.3, aL: [12, -10, 20], aR: [30, 60, 110] }, { sx: 0.25, cx: 0.45, nx: 0.3, aL: [12, -10, 20], aR: [30, 60, 110] }, N]), { free: 1, gentle: 1 }),
  E('shrug', 'Who Knows?', '🤷', 'quick', K(2, [{ aL: [55, 30, 100, 60], aR: [55, 30, 100, 60], nz: 0.18, hy: 0.02, cx: -0.05 }, { aL: [45, 30, 90, 60], aR: [45, 30, 90, 60], nz: -0.1 }]), { free: 1 }),
  E('salute', 'Sharp Salute', '🫡', 'quick', K(4, [N, { aR: [95, 40, 145, 10], cx: -0.06, nx: -0.06, star: 1 }, { aR: [95, 40, 145, 10], cx: -0.06, nx: -0.06 }, { aR: [95, 40, 145, 10], cx: -0.04 }], { ease: 'snap' }), { free: 1 }),
  E('facepalm', 'Facepalm', '🤦', 'quick', K(4, [N, { aR: [40, 85, 140, 20], nx: 0.3, cx: 0.12, ny: -0.1 }, { aR: [40, 85, 140, 20], nx: 0.32, cx: 0.12, ny: 0.15 }, { aR: [40, 85, 140, 20], nx: 0.32, cx: 0.12, ny: -0.15 }]), { r: 'c' }),
  E('hearthands', 'Heart Hands', '🫶', 'quick', K(2, [{ aL: [60, 70, 120, -30], aR: [60, 70, 120, -30], nz: 0.12, hrz: 0.04 }, { aL: [65, 72, 125, -30], aR: [65, 72, 125, -30], nz: -0.12, hrz: -0.04, star: 1 }]), { r: 'c' }),
  E('flex', 'Muscle Flex', '💪', 'quick', K(2, [{ aL: [92, 10, 135, 40], aR: [92, 10, 135, 40], hy: -0.08, cx: -0.08, lL: [0, 10, 10], lR: [0, 10, 10] }, { aL: [98, 12, 145, 40], aR: [86, 10, 125, 40], hy: -0.1, cz: 0.08, star: 1 }]), { r: 'c' }),
  E('sleepy', 'So Sleepy', '😴', 'quick', K(4, [{ aL: [70, 30, 120], aR: [150, 10, 60], cx: -0.1, nx: -0.15 }, { cx: 0.2, nx: 0.35, nz: 0.2, hy: -0.06, aL: [18, 20, 30], aR: [18, 20, 30] }, { cx: 0.24, nx: 0.42, nz: 0.25, hy: -0.08 }, { cx: 0.05, nx: -0.05, hy: 0 }], { gentle: 1 }), { r: 'c' }),
  E('spinout', 'Happy Spin', '🌀', 'quick', K(2, [{ ry: 0, aL: [80, 0, 40], aR: [80, 0, 40] }, { ry: S, hy: 0.06, aL: [110, 0, 30], aR: [110, 0, 30] }, { ry: S * 2, aL: [80, 0, 40], aR: [80, 0, 40] }], { ease: 'spin' }), { r: 'c' }),
  E('joyjump', 'Jump for Joy', '🤸', 'quick', K(2, [{ hy: -0.14, cx: 0.12, aL: [30, 30, 50], aR: [30, 30, 50] }, { hy: 0.38, aL: [165, -10, 15], aR: [165, -10, 15], lL: [25, 15, 60], lR: [25, 15, 60], nx: -0.2, star: 1 }, { hy: 0.3, aL: [150, 0, 20], aR: [150, 0, 20], lL: [20, 10, 50], lR: [20, 10, 50] }, { hy: -0.1, aL: [40, 20, 50], aR: [40, 20, 50] }]), { r: 'c' }),
  E('lookthere', 'Look Over There!', '👉', 'quick', K(4, [N, { aR: [90, 70, 15], ny: -0.45, hry: -0.15, cx: -0.04 }, { aR: [92, 72, 15], ny: -0.5, hry: -0.15, aL: [30, 20, 60] }, { aR: [90, 70, 15], ny: -0.45, hry: -0.15 }], { ease: 'snap' }), { r: 'c' }),
  E('thinker', 'Hmm, Thinking', '🤔', 'quick', K(4, [{ aR: [35, 80, 140, 10], aL: [30, 50, 110], nz: 0.15, nx: -0.1 }, { aR: [35, 80, 140, 10], aL: [30, 50, 110], nz: -0.05, nx: -0.18, ny: 0.2 }]), { r: 'c', gentle: 1 }),
  E('nodyes', 'Yes Yes!', '😄', 'quick', K(1, [{ nx: 0.25, hy: -0.04, aL: [30, 30, 60], aR: [30, 30, 60] }, { nx: -0.15, hy: 0 }]), { r: 'c' }),
  E('nopenope', 'Nope Nope', '🙅', 'quick', K(1, [{ ny: 0.4, aL: [60, 60, 30], aR: [60, 60, 30] }, { ny: -0.4, aL: [70, 65, 30], aR: [70, 65, 30] }]), { r: 'c' }),
  E('peacesign', 'Peace Out', '✌️', 'quick', K(2, [{ aR: [150, 20, 60, 30], hrz: 0.06, nz: 0.15, hx: -0.03 }, { aR: [145, 25, 75, 30], hrz: 0.08, nz: 0.2, ny: 0.15 }]), { r: 'c' }),
  E('victory', 'Victory Pose', '🏆', 'quick', K(4, [{ hy: -0.08, aL: [40, 20, 60], aR: [40, 20, 60] }, { hy: 0.1, aR: [170, 5, 10], aL: [80, 10, 130], cz: 0.1, nx: -0.15, lL: [30, 10, 60], star: 1 }, { hy: 0.06, aR: [170, 5, 10], aL: [80, 10, 130], cz: 0.1, lL: [30, 10, 60] }, { hy: 0.06, aR: [168, 5, 10], aL: [80, 10, 130], cz: 0.08 }], { ease: 'snap' }), { r: 'r' }),
  E('boohoo', 'Boo-Hoo', '😢', 'quick', K(1, [{ aL: [40, 70, 145], aR: [40, 70, 145], nx: 0.2, cx: 0.12, hy: -0.04 }, { aL: [42, 72, 150], aR: [42, 72, 150], nx: 0.28, cx: 0.14, hy: -0.06, nz: 0.06 }]), { r: 'c' }),
  // ---------------------------------------------------------------- dances (looping, on the beat)
  E('sparkstep', 'Spark Step', '✨', 'dance', K(2, [{ hx: -0.06, hrz: 0.08, lR: [28, 10, 40], aL: [110, 20, 50], aR: [30, 40, 90], hy: -0.06 }, { hy: -0.02, aL: [60, 30, 80], aR: [60, 30, 80] }], { mirror: 1 }), { free: 1 }),
  E('moonbounce', 'Moon Bounce', '🌙', 'dance', K(2, [{ hy: -0.12, aL: [45, 30, 80], aR: [45, 30, 80], cx: 0.08 }, { hy: 0.16, aL: [120, 10, 40], aR: [120, 10, 40], lL: [12, 8, 25], lR: [12, 8, 25] }, { hy: -0.12, aL: [45, 30, 80], aR: [45, 30, 80], hrz: 0.08 }, { hy: 0.08, aL: [95, 20, 50], aR: [95, 20, 50] }]), { free: 1 }),
  E('jellywiggle', 'Jelly Wiggle', '🍮', 'dance', K(1, [{ hx: -0.07, hrz: 0.14, cz: -0.16, nz: 0.14, aL: [55, 15, 70], aR: [40, 15, 90], hy: -0.06 }, { hx: 0.07, hrz: -0.14, cz: 0.16, nz: -0.14, aL: [40, 15, 90], aR: [55, 15, 70], hy: -0.06 }]), { r: 'c' }),
  E('pixelpop', 'Pixel Pop', '👾', 'dance', K(4, [{ aL: [90, 0, 90], aR: [24, 6, 14], hry: 0.2 }, { aL: [90, 0, 90], aR: [90, 0, 90], hy: -0.06 }, { aL: [160, 0, 10], aR: [90, 0, 90], hry: -0.2, ny: -0.3 }, { aL: [90, 90, 90], aR: [90, 90, 90], hy: -0.08, star: 1 }], { ease: 'snap' }), { r: 'c' }),
  E('boogiebot', 'Boogie Bot', '🤖', 'dance', K(2, [{ aL: [80, 20, 95, -20], aR: [30, 60, 95], hry: 0.25, ny: 0.3, hy: -0.04 }, { aL: [30, 60, 95], aR: [80, 20, 95, -20], hry: -0.25, ny: -0.3, hy: -0.04 }], { ease: 'snap' }), { r: 'c' }),
  E('kneeknock', 'Knee Knock', '🦵', 'dance', K(1, [{ hy: -0.1, lL: [10, -12, 45], lR: [10, -12, 45], aL: [40, 50, 90], aR: [40, 50, 90], cx: 0.12 }, { hy: -0.08, lL: [10, 14, 35], lR: [10, 14, 35], aL: [50, 40, 70], aR: [50, 40, 70], cx: 0.1 }]), { r: 'c' }),
  E('stompclap', 'Stomp Clap', '🥁', 'dance', K(2, [{ lL: [35, 0, 55], hy: -0.02, aL: [35, 70, 70, -40], aR: [35, 70, 70, -40] }, { hy: -0.12, aL: [30, 80, 80, -40], aR: [30, 80, 80, -40], cx: 0.1 }], { mirror: 1 }), { r: 'c' }),
  E('boxstep', 'Box Step', '📦', 'dance', K(4, [{ hx: -0.05, lR: [20, -8, 30], aL: [30, 30, 80], aR: [30, -10, 60] }, { hx: 0.05, lL: [20, 8, 30], hrz: -0.06 }, { hx: 0.05, lR: [15, 10, 30], aL: [30, -10, 60], aR: [30, 30, 80] }, { hx: -0.05, lL: [15, -10, 30], hrz: 0.06 }]), { r: 'c' }),
  E('fingersnap', 'Snap Groove', '🫰', 'dance', K(2, [{ hx: -0.07, hrz: 0.1, aR: [55, 55, 110, 30], aL: [30, 20, 60], nz: 0.1, hy: -0.05 }, { hx: 0.07, hrz: -0.1, aL: [55, 55, 110, 30], aR: [30, 20, 60], nz: -0.1, hy: -0.05 }]), { r: 'c' }),
  E('skatesway', 'Skate Sway', '🛼', 'dance', K(2, [{ hx: 0.12, hrz: -0.1, lL: [8, -20, 20], aL: [70, -20, 30], aR: [50, 40, 60], ry: -0.25, cx: 0.12 }, { hx: -0.12, hrz: 0.1, lR: [8, 20, 20], aR: [70, -20, 30], aL: [50, 40, 60], ry: 0.25, cx: 0.12 }], { gentle: 1 }), { r: 'r' }),
  E('airguitar', 'Air Guitar', '🎸', 'dance', K(1, [{ aL: [50, 75, 60, 20], aR: [35, 45, 100, -20], cx: 0.15, nx: 0.2, hy: -0.08, lL: [0, 12, 15], lR: [0, 12, 15] }, { aL: [50, 75, 60, 20], aR: [35, 55, 80, -20], cx: 0.05, nx: -0.15, hy: -0.04 }]), { r: 'r' }),
  E('airdrums', 'Air Drums', '🥁', 'dance', K(1, [{ aL: [40, 60, 120], aR: [40, 50, 70], hy: -0.06, nx: 0.12 }, { aL: [40, 50, 70], aR: [40, 60, 120], hy: -0.02, nx: -0.06 }]), { r: 'r' }),
  E('djscratch', 'DJ Scratch', '🎧', 'dance', K(1, [{ aL: [40, 70, 120, -10], aR: [30, 70, 90], hry: 0.08, nx: 0.12, hy: -0.06 }, { aL: [40, 70, 120, -10], aR: [45, 60, 100], hry: -0.08, nx: -0.05, hy: -0.03 }]), { r: 'r' }),
  E('propeller', 'Propeller Arms', '🚁', 'dance', K(1, [{ aL: [170, 0, 15], aR: [20, 0, 20], hrz: 0.08 }, { aL: [95, 20, 20], aR: [95, -20, 20], hy: -0.05 }, { aL: [20, 0, 20], aR: [170, 0, 15], hrz: -0.08 }, { aL: [95, -20, 20], aR: [95, 20, 20], hy: -0.05 }], { ease: 'linear' }), { r: 'r' }),
  E('zoomzoom', 'Zoom Zoom', '🏎️', 'dance', K(1, [{ aL: [25, 60, 95], aR: [25, -40, 95], lL: [30, 0, 55], hy: -0.06, cx: 0.15 }, { aL: [25, -40, 95], aR: [25, 60, 95], lR: [30, 0, 55], hy: -0.06, cx: 0.15 }]), { r: 'r' }),
  E('waverider', 'Wave Rider', '🌊', 'dance', K(4, [{ aL: [95, 0, 20], aR: [80, 0, 60], hy: 0, cz: 0.12 }, { aL: [90, 0, 40], aR: [90, 0, 40], hy: -0.12, cx: 0.1 }, { aL: [80, 0, 60], aR: [95, 0, 20], hy: 0, cz: -0.12 }, { aL: [100, 0, 20], aR: [100, 0, 20], hy: -0.06, cx: -0.12, hrx: 0.1 }]), { r: 'r' }),
  E('cosmicfloat', 'Cosmic Float', '🪐', 'dance', K(4, [{ hx: 0.2, lL: [0, 0, 40], aL: [70, 10, 50], aR: [70, 10, 50], nz: 0.1 }, { hx: 0.07, lR: [0, 0, 40], aL: [80, 5, 40], aR: [80, 5, 40] }, { hx: -0.07, lL: [0, 0, 40], nz: -0.1 }, { hx: -0.2, lR: [0, 0, 40], aL: [70, 10, 50], aR: [70, 10, 50] }], { ease: 'linear', slide: 1, gentle: 1 }), { r: 'r' }),
  E('hopscotch', 'Hop Scotch', '🔢', 'dance', K(2, [{ hy: 0.12, lL: [30, 0, 70], aL: [70, 20, 40], aR: [70, 20, 40] }, { hy: -0.08 }, { hy: 0.12, lR: [30, 0, 70], aL: [70, 20, 40], aR: [70, 20, 40] }, { hy: -0.08, lL: [0, 12, 10], lR: [0, 12, 10] }]), { r: 'c' }),
  E('rollercoaster', 'Rollercoaster', '🎢', 'dance', K(4, [{ hy: -0.15, cx: 0.2, aL: [40, 70, 40], aR: [40, 70, 40] }, { hy: 0.05, cx: -0.12, aL: [165, 5, 15], aR: [165, 5, 15] }, { hy: -0.05, hrz: 0.15, cz: 0.15, aL: [160, 5, 15], aR: [160, 5, 15] }, { hy: -0.05, hrz: -0.15, cz: -0.15, aL: [160, 5, 15], aR: [160, 5, 15], star: 1 }]), { r: 'r' }),
  E('popnlock', 'Pop & Freeze', '⚡', 'dance', K(4, [{ aL: [90, 0, 90], aR: [90, 0, 90], cx: -0.1, hy: -0.04 }, { aL: [90, 0, 90], aR: [90, 0, 90], cx: 0.12, hy: -0.1, nz: 0.2 }, { aL: [30, 80, 110], aR: [150, 0, 20], hrz: 0.12, hy: -0.06 }, { aL: [150, 0, 20], aR: [30, 80, 110], hrz: -0.12, hy: -0.06, star: 1 }], { ease: 'snap' }), { r: 'r' }),
  E('cloudwalk', 'Cloud Walk', '☁️', 'dance', K(4, [{ hx: -0.3, lR: [0, 0, 45], aL: [30, 30, 40], aR: [30, -20, 40], ry: 0.6 }, { hx: -0.1, lL: [0, 0, 45], ry: 0.6 }, { hx: 0.1, lR: [0, 0, 45], ry: 0.6 }, { hx: 0.3, lL: [0, 0, 45], ry: 0.6 }], { ease: 'linear', slide: 1, mirrorBack: 1 }), { r: 'l' }),
  // ---------------------------------------------------------------- silly
  E('chickenflap', 'Chicken Flap', '🐔', 'silly', K(1, [{ aL: [70, -10, 150, 40], aR: [70, -10, 150, 40], nx: 0.15, cx: 0.12, hy: -0.06 }, { aL: [30, -10, 150, 40], aR: [30, -10, 150, 40], nx: -0.2, ny: 0.2, hy: -0.02 }]), { r: 'c' }),
  E('noodlearms', 'Noodle Arms', '🍜', 'silly', K(2, [{ aL: [110, 30, 80, 40], aR: [40, -20, 120, -40], hrz: 0.12, cz: -0.15, nz: 0.2 }, { aL: [60, 10, 140, -40], aR: [130, 40, 60, 40], hrz: -0.08, nz: -0.1 }, { aL: [40, -20, 120, -40], aR: [110, 30, 80, 40], hrz: -0.12, cz: 0.15, nz: -0.2 }, { aL: [130, 40, 60, 40], aR: [60, 10, 140, -40], hrz: 0.08 }]), { r: 'c' }),
  E('waddle', 'Penguin Waddle', '🐧', 'silly', K(1, [{ hrz: 0.18, hx: -0.05, lR: [12, 0, 10], aL: [40, -10, 20], aR: [40, -10, 20], nz: -0.12 }, { hrz: -0.18, hx: 0.05, lL: [12, 0, 10], aL: [40, -10, 20], aR: [40, -10, 20], nz: 0.12 }]), { r: 'c' }),
  E('dizzyspin', 'Dizzy Daze', '😵', 'silly', K(4, [{ ry: 0, nz: 0.2, aL: [60, 0, 40], aR: [60, 0, 40] }, { ry: S, hrz: 0.12, nz: -0.25, hy: -0.04 }, { ry: S * 2, hrz: -0.15, nz: 0.3, cz: 0.12, aL: [90, 10, 60], aR: [40, 20, 60] }, { ry: S * 2, hrz: 0.1, cz: -0.12, nz: -0.25, hy: -0.08 }], { ease: 'spin' }), { r: 'c' }),
  E('froghop', 'Frog Hop', '🐸', 'silly', K(2, [{ hy: -0.2, cx: 0.3, lL: [5, 25, 30], lR: [5, 25, 30], aL: [30, 60, 60], aR: [30, 60, 60] }, { hy: 0.3, cx: -0.1, aL: [140, 10, 20], aR: [140, 10, 20], lL: [30, 20, 70], lR: [30, 20, 70] }]), { r: 'c' }),
  E('bigsneeze', 'Big Sneeze', '🤧', 'silly', K(4, [{ cx: -0.2, nx: -0.35, aL: [30, 40, 120], aR: [30, 40, 120], hy: 0.02 }, { cx: -0.25, nx: -0.42, hy: 0.04 }, { cx: 0.35, nx: 0.35, hy: -0.12, aL: [40, 80, 140], aR: [40, 80, 140], star: 1 }, { cx: 0.05, nx: 0, ny: 0.3 }], { ease: 'snap' }), { r: 'c' }),
  E('tickled', 'Tickle Wiggle', '🪶', 'silly', K(1, [{ hrz: 0.15, cz: -0.15, aL: [30, 30, 140], aR: [30, 30, 140], nz: 0.25, hy: -0.06 }, { hrz: -0.15, cz: 0.15, nz: -0.25, hy: -0.03 }]), { r: 'c' }),
  E('jellylegs', 'Jelly Legs', '🦑', 'silly', K(1, [{ hy: -0.14, lL: [10, -15, 50], lR: [10, 15, 10], hrz: 0.12, aL: [80, 10, 40], aR: [60, 10, 60] }, { hy: -0.08, lL: [10, 15, 10], lR: [10, -15, 50], hrz: -0.12, aL: [60, 10, 60], aR: [80, 10, 40] }]), { r: 'r' }),
  // ---------------------------------------------------------------- PREMIUM (gold): the showpiece dances, Diamonds for now
  E('starburst', 'Starburst', '🌟', 'dance', K(4, [{ hy: -0.16, cx: 0.2, aL: [25, 60, 110], aR: [25, 60, 110], nx: 0.2 }, { hy: 0.3, aL: [170, -15, 10], aR: [170, -15, 10], lL: [20, 20, 50], lR: [20, 20, 50], nx: -0.25, star: 1 }, { hy: 0.02, ry: S, aL: [100, 0, 30], aR: [100, 0, 30] }, { hy: -0.12, ry: S * 2, aL: [140, 10, 30], aR: [60, 40, 90], hrz: 0.12, star: 1 }], { ease: 'spin' }), { prem: 1 }),
  E('galaxyglide', 'Galaxy Glide', '🌌', 'dance', K(4, [{ hx: 0.32, lL: [0, 0, 50], aL: [150, 10, 20], aR: [60, 20, 80], ry: -0.5, nz: 0.15 }, { hx: 0.1, lR: [0, 0, 50], aL: [120, 20, 40], aR: [90, 20, 60], ry: -0.5 }, { hx: -0.1, lL: [0, 0, 50], aL: [90, 20, 60], aR: [120, 20, 40], ry: -0.5 }, { hx: -0.32, lR: [0, 0, 50], aL: [60, 20, 80], aR: [150, 10, 20], ry: -0.5, nz: -0.15, star: 1 }], { ease: 'linear', slide: 1, mirrorBack: 1 }), { prem: 1 }),
  E('rocketroll', 'Rocket Roll', '🚀', 'dance', K(2, [{ aL: [50, 75, 110], aR: [60, 85, 100], hy: -0.08, hrz: 0.08, cx: 0.1 }, { aL: [60, 85, 100], aR: [50, 75, 110], hy: -0.08, hrz: -0.08 }, { aL: [50, 75, 110], aR: [60, 85, 100], hy: -0.12, hrz: 0.08, cx: 0.15 }, { aL: [175, -5, 10], aR: [175, -5, 10], hy: 0.25, lL: [15, 5, 35], lR: [15, 5, 35], star: 1 }]), { prem: 1 }),
  E('turbotwist', 'Turbo Twist', '🌪️', 'dance', K(1, [{ hy: -0.14, hry: 0.55, cy: -0.6, aL: [70, 50, 100], aR: [60, -30, 70], lL: [10, 0, 20], nx: 0.1 }, { hy: -0.18, hry: -0.55, cy: 0.6, aL: [60, -30, 70], aR: [70, 50, 100], lR: [10, 0, 20], nx: 0.1 }]), { prem: 1 }),
  E('thunderclap', 'Thunder Clap', '🌩️', 'dance', K(4, [{ aL: [165, 10, 20], aR: [165, 10, 20], hy: 0.06, cx: -0.12 }, { aL: [60, 85, 60, -40], aR: [60, 85, 60, -40], hy: -0.2, cx: 0.25, lL: [0, 18, 20], lR: [0, 18, 20], star: 1 }, { lL: [45, 0, 60], hy: -0.04, aL: [100, 0, 30], aR: [100, 0, 30] }, { lR: [45, 0, 60], hy: -0.04, aL: [100, 0, 30], aR: [100, 0, 30] }], { ease: 'snap' }), { prem: 1 }),
  E('neonpulse', 'Neon Pulse', '💡', 'dance', K(2, [{ cx: -0.22, hy: 0, aL: [70, 30, 120], aR: [70, 30, 120], nx: -0.2 }, { cx: 0.22, sx: 0.08, hy: -0.12, aL: [90, 60, 60], aR: [90, 60, 60], nx: 0.2, hz: 0.05 }, { cz: 0.18, hrz: -0.12, aL: [150, 0, 30], aR: [40, 40, 100], hy: -0.06 }, { cz: -0.18, hrz: 0.12, aL: [40, 40, 100], aR: [150, 0, 30], hy: -0.06, star: 1 }]), { prem: 1 }),
  E('crownstrut', 'Royal Strut', '👑', 'dance', K(2, [{ hx: -0.05, hrz: 0.12, lR: [30, 0, 45], aL: [30, 40, 120, 30], aR: [20, -20, 40], cx: -0.1, nx: -0.12, ny: 0.2 }, { hy: -0.04, hrz: 0.06 }], { mirror: 1 }), { prem: 1 }),
  E('phoenixrise', 'Phoenix Rise', '🔥', 'dance', K(4, [{ hy: -0.22, cx: 0.4, nx: 0.3, aL: [30, -30, 40], aR: [30, -30, 40] }, { hy: -0.06, cx: 0.1, aL: [100, -20, 40], aR: [100, -20, 40] }, { hy: 0.2, cx: -0.15, nx: -0.25, aL: [165, 0, 20], aR: [165, 0, 20], lL: [15, 8, 30], lR: [15, 8, 30], star: 1 }, { hy: 0.04, aL: [120, -10, 50], aR: [120, -10, 50] }]), { prem: 1 }),
  E('hyperhop', 'Hyper Hop', '🐇', 'dance', K(1, [{ hy: -0.1, lL: [40, 0, 70], aL: [40, 70, 100], aR: [40, -30, 70], cx: 0.1 }, { hy: 0.18, lR: [40, 0, 70], aL: [40, -30, 70], aR: [40, 70, 100] }]), { prem: 1 }),
  E('electroflow', 'Electro Flow', '🔌', 'dance', K(4, [{ aL: [90, 0, 30], aR: [90, 0, 30], hrz: 0.1, cz: 0.15, hy: -0.04 }, { aL: [140, 20, 60, 40], aR: [60, 0, 60], hrz: 0.04, cz: 0.05, hy: -0.08, ny: 0.3 }, { aL: [60, 0, 60], aR: [140, 20, 60, 40], hrz: -0.04, cz: -0.05, hy: -0.08, ny: -0.3 }, { aL: [90, 0, 30], aR: [90, 0, 30], hrz: -0.1, cz: -0.15, hy: -0.04, star: 1 }]), { prem: 1 }),
  E('meteorspin', 'Meteor Spin', '☄️', 'dance', K(4, [{ hy: -0.15, aL: [40, 70, 120], aR: [40, 70, 120], cx: 0.2 }, { hy: 0.1, ry: S, aL: [95, 0, 20], aR: [95, 0, 20], lL: [30, 10, 60] }, { hy: 0.08, ry: S * 2, aL: [170, 0, 10], aR: [170, 0, 10], star: 1 }, { hy: -0.12, ry: S * 2, aL: [100, 0, 30], aR: [30, 30, 60], hrz: 0.15, lR: [0, 18, 15] }], { ease: 'spin' }), { prem: 1 }),
  E('rainbowwave', 'Rainbow Wave', '🌈', 'dance', K(4, [{ aL: [165, -30, 20], aR: [60, 20, 70], hrz: 0.12, hx: -0.06, nz: 0.15 }, { aL: [140, 0, 20], aR: [140, 0, 20], hy: -0.08 }, { aL: [60, 20, 70], aR: [165, -30, 20], hrz: -0.12, hx: 0.06, nz: -0.15 }, { aL: [90, 30, 60], aR: [90, 30, 60], hy: -0.14, cx: 0.15, star: 1 }]), { prem: 1 }),
  // ---------------------------------------------------------------- 🎃 HALLOWEEN (append-only: matching emotes for the costume sets)
  E('monstermash', 'Monster Mash Stomp', '🧟', 'dance', K(2, [{ hy: -0.08, aL: [80, 70, 20], aR: [80, 70, 20], hrz: 0.12, lL: [25, 0, 40], nz: 0.15 }, { hy: -0.02, aL: [85, 75, 15], aR: [85, 75, 15], hrz: -0.12, lR: [25, 0, 40], nz: -0.15 }]), { free: 1 }),
  E('ghostfloat', 'Boo Float', '👻', 'dance', K(4, [{ hy: 0.12, aL: [110, 30, 60], aR: [110, 30, 60], hrz: 0.08, nz: 0.12 }, { hy: 0.2, aL: [130, 20, 40], aR: [130, 20, 40], cx: -0.08 }, { hy: 0.12, aL: [110, 30, 60], aR: [110, 30, 60], hrz: -0.08, nz: -0.12 }, { hy: 0.04, aL: [160, 10, 20], aR: [160, 10, 20], star: 1 }], { gentle: 1 }), { r: 'r', say: 'Boo!' }),
  E('zombiewalk', 'Zombie Shuffle', '🧟‍♂️', 'silly', K(2, [{ hx: -0.06, hrz: 0.15, aL: [90, 85, 10], aR: [90, 85, 10], lR: [10, 0, 20], nz: 0.25, cx: 0.1 }, { hx: 0.06, hrz: -0.15, aL: [90, 85, 10], aR: [90, 85, 10], lL: [10, 0, 20], nz: -0.25, cx: 0.1 }]), { r: 'c' }),
  E('vampswoop', 'Cape Swoop', '🦇', 'quick', K(2, [{ aL: [100, 10, 70], aR: [30, 60, 120], hrz: 0.1, cx: 0.15, nx: 0.1 }, { aL: [150, -20, 10], aR: [150, -20, 10], hy: 0.15, star: 1 }]), { r: 'r', say: 'Bleh!' }),
];
// prices: Star Coins by rarity (same as dances), Diamonds for premium (high-ish; earn cap is 1500/day)
export const EMOTE_COINS = { c: 60, r: 140, l: 300 };
const PREM_D = { starburst: 1200, galaxyglide: 1200, rocketroll: 900, turbotwist: 800, thunderclap: 900, neonpulse: 1000, crownstrut: 800, phoenixrise: 1100, hyperhop: 700, electroflow: 900, meteorspin: 1000, rainbowwave: 800 };
export const premItemId = (id) => 'z_dn_' + id;
export const productIdOf = (id) => 'kemy_dance_' + id; // placeholder Google Play Billing product id (not used yet)
// as dance objects (dance.js TRENDING format): 2D fallback keys derived from the 3D keys
const to2D = (k) => { const a = (k && k.aL) || N.aL, b = (k && k.aR) || N.aR; return { aL: a[0], aR: b[0], y: -((k && k.hy) || 0) * 30, r: ((k && k.hrz) || 0) * 50, k: ((k && k.cz) || 0), star: k && k.star }; };
export const EMOTE_DANCES = EMOTE_LIST.map((e) => {
  register3D(e.id, { ease: e.clip.ease || 'smooth', ...e.clip, gentle: e.gentle || e.clip.gentle });
  const d = { id: e.id, name: e.name, icon: e.icon, cat: e.cat, group: e.prem ? 'premium' : 'emote', beats: e.clip.beats * (e.clip.mirror ? 2 : 1), ease: e.clip.ease === 'snap' ? 'snap' : e.clip.ease === 'linear' || e.clip.ease === 'spin' ? 'linear' : 'smooth', keys: e.clip.keys.map((k) => to2D(k)), emote: 1 };
  if (e.free) d.free = 1;
  if (e.prem) Object.assign(d, { prem: 1, r: 'l', d: PREM_D[e.id], productId: productIdOf(e.id), item: premItemId(e.id) });
  else if (!e.free) Object.assign(d, { r: e.r || 'c', p: EMOTE_COINS[e.r || 'c'] });
  if (e.gentle) d.gentle = 1;
  return d;
});
export const EMOTE_BY_ID = Object.fromEntries(EMOTE_DANCES.map((d) => [d.id, d]));
// how long a wheel emote plays (ms): quick reactions are short, dances loop longer
export const emoteMs = (id) => { const d = EMOTE_BY_ID[id]; return !d ? 8000 : d.cat === 'quick' ? 3200 : d.cat === 'silly' ? 5000 : 9000; };
// stable index (append-only!) for compact sync in the zombie game (em = 500 + index)
export const EMOTE_IDX = EMOTE_DANCES.map((d) => d.id);
