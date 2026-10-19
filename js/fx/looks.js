// Lone Keem Studios - the shared filter catalog (camera, stories, in-app live, and any editor).
// Every name here is original. Looks are colour grades run by js/fx/engine.js (one WebGL shader).
// Params (all optional, neutral defaults): exp (stops), con, sat, temp (-1 cool .. 1 warm),
// tint (-1 green .. 1 magenta), fade, vig, hue (degrees), mono, sh/hi (shadow / highlight tone
// colours for split toning) with split strength, grain. sw = swatch colours for the picker.
export const LOOKS = [
  { id: 'none', name: 'Original', sw: ['#3a3a44', '#9a9aa8'] },
  { id: 'lonestar', name: 'Lone Star', con: 1.08, sat: 1.05, sh: [0.42, 0.12, 0.78], hi: [1, 0.82, 0.3], split: 0.32, vig: 0.25, sw: ['#4b1a86', '#ffc83d'] },
  { id: 'studio', name: 'Studio Purple', con: 1.06, sat: 0.95, sh: [0.35, 0.1, 0.62], hi: [0.85, 0.7, 1], split: 0.4, tint: 0.25, sw: ['#3a0f6b', '#c9a2ff'] },
  { id: 'golden', name: 'Golden Hour', exp: 0.08, con: 1.04, sat: 1.12, temp: 0.75, hi: [1, 0.8, 0.45], sh: [0.4, 0.22, 0.1], split: 0.22, sw: ['#7a3d12', '#ffcf6b'] },
  { id: 'midnight', name: 'Midnight', exp: -0.18, con: 1.18, sat: 0.85, temp: -0.7, sh: [0.05, 0.08, 0.3], hi: [0.6, 0.75, 1], split: 0.3, vig: 0.4, sw: ['#060c2e', '#5c7cff'] },
  { id: 'neon', name: 'Neon Dream', con: 1.12, sat: 1.45, sh: [0.6, 0.05, 0.75], hi: [0.2, 0.95, 1], split: 0.38, sw: ['#9a0fb8', '#24f2ff'] },
  { id: 'velvet', name: 'Velvet', con: 0.95, sat: 0.9, fade: 0.25, tint: 0.35, sh: [0.3, 0.1, 0.35], hi: [1, 0.85, 0.95], split: 0.25, sw: ['#4a1838', '#f2c6e6'] },
  { id: 'noir', name: 'Noir', mono: 1, con: 1.35, exp: -0.05, vig: 0.45, grain: 0.05, sw: ['#050505', '#d8d8d8'] },
  { id: 'silver', name: 'Silver Screen', mono: 1, con: 0.92, fade: 0.3, grain: 0.04, sw: ['#3c3c3c', '#f0f0f0'] },
  { id: 'honey', name: 'Honey', temp: 0.5, fade: 0.18, sat: 1.05, hi: [1, 0.86, 0.55], split: 0.2, sw: ['#7a5418', '#ffe2a0'] },
  { id: 'ocean', name: 'Ocean Drive', con: 1.12, sat: 1.1, sh: [0.0, 0.32, 0.4], hi: [1, 0.68, 0.4], split: 0.42, sw: ['#00525e', '#ffa860'] },
  { id: 'lavender', name: 'Lavender Haze', con: 0.88, sat: 0.8, exp: 0.12, fade: 0.2, sh: [0.55, 0.45, 0.8], hi: [0.95, 0.88, 1], split: 0.35, sw: ['#7b64b8', '#efe4ff'] },
  { id: 'ember', name: 'Ember', con: 1.2, sat: 1.15, temp: 0.6, tint: 0.15, sh: [0.35, 0.05, 0.02], hi: [1, 0.6, 0.3], split: 0.3, vig: 0.3, sw: ['#5c0b00', '#ff8a3d'] },
  { id: 'frost', name: 'Frost', sat: 0.65, temp: -0.55, exp: 0.08, con: 1.02, hi: [0.85, 0.95, 1], split: 0.2, sw: ['#4c6070', '#e8f6ff'] },
  { id: 'retro', name: 'Retro Reel', fade: 0.32, con: 0.94, sat: 0.85, sh: [0.1, 0.3, 0.2], hi: [1, 0.9, 0.7], split: 0.3, grain: 0.08, vig: 0.3, sw: ['#294a3a', '#f3dfb0'] },
  { id: 'sunset', name: 'Sunset Strip', con: 1.06, sat: 1.18, sh: [0.5, 0.1, 0.4], hi: [1, 0.62, 0.35], split: 0.4, sw: ['#7a1a5c', '#ff9a4a'] },
  { id: 'mint', name: 'Mint Fresh', tint: -0.4, exp: 0.06, sat: 0.95, hi: [0.8, 1, 0.9], split: 0.22, sw: ['#1c5a46', '#c8ffe6'] },
  { id: 'cyber', name: 'Cyber Pop', con: 1.22, sat: 1.35, hue: 12, sh: [0.1, 0.0, 0.5], hi: [1, 0.3, 0.85], split: 0.35, sw: ['#1a0080', '#ff4fd8'] },
  { id: 'royal', name: 'Royal Gold', con: 1.1, sat: 1.0, sh: [0.25, 0.05, 0.45], hi: [1, 0.85, 0.35], split: 0.45, vig: 0.35, sw: ['#2d0a52', '#ffd36b'] },
  { id: 'rose', name: 'Dusty Rose', sat: 0.8, fade: 0.15, tint: 0.3, temp: 0.15, hi: [1, 0.8, 0.82], split: 0.3, sw: ['#6b3a44', '#ffd6dc'] },
  { id: 'matte', name: 'Soft Matte', con: 0.85, fade: 0.35, sat: 0.92, sw: ['#3d3a38', '#d8d2cc'] },
  { id: 'vivid', name: 'Vivid', con: 1.15, sat: 1.4, exp: 0.04, sw: ['#e0215a', '#1ad1ff'] },
  { id: 'sepia', name: 'Sepia Dreams', mono: 0.85, temp: 0.85, fade: 0.15, sh: [0.25, 0.14, 0.06], hi: [1, 0.88, 0.66], split: 0.4, grain: 0.04, sw: ['#4a2e14', '#f5dcb0'] },
  { id: 'arcade', name: 'Arcade', hue: 160, sat: 1.25, con: 1.1, sw: ['#00b38f', '#ff3da0'] }
];

// "Smooth skin": skin-masked edge-preserving blur + a gentle even-tone lift. Stacks with looks.
export const BEAUTY = [
  { id: 'off', name: 'Off', v: 0 },
  { id: 'light', name: 'Light', v: 0.38 },
  { id: 'medium', name: 'Medium', v: 0.62, heavy: true },
  { id: 'strong', name: 'Strong', v: 0.85, heavy: true }
];

// Funny face lenses (need the face tracker). warp = shader distortion, art = drawn on top.
export const FUNNY = [
  { id: 'none', name: 'No lens', icon: '∅' },
  { id: 'bigeyes', name: 'Big Eyes', icon: '👀', warp: true },
  { id: 'bobble', name: 'Bobblehead', icon: '🎈', warp: true },
  { id: 'tinyface', name: 'Tiny Face', icon: '🤏', warp: true },
  { id: 'bubblenose', name: 'Bubble Nose', icon: '🔴', warp: true },
  { id: 'pup', name: 'Purple Pup', icon: '🐶', art: true },
  { id: 'alien', name: 'Antenna Alien', icon: '👽', art: true },
  { id: 'dapper', name: 'Dapper', icon: '🧐', art: true },
  { id: 'starmouth', name: 'Star Shout', icon: '⭐', art: true, hint: 'Open your mouth' },
  { id: 'swirl', name: 'Face Swirl', icon: '🌀', warp: true },
  { id: 'mirror', name: 'Mirror Me', icon: '🪞', warp: true },
  { id: 'blush', name: 'Cartoon Blush', icon: '☺️', art: true },
  { id: 'crown', name: 'Gold Crown', icon: '👑', art: true },
  { id: 'shades', name: 'Star Shades', icon: '🕶️', art: true },
  { id: 'klsticker', name: 'KL Badge', icon: 'KL', art: true },
  { id: 'cheeks', name: 'Sparkle Cheeks', icon: '✨', art: true }
];

// Fun effects (no face needed, except the backdrop ones which use the selfie segmenter).
export const FUNFX = [
  { id: 'none', name: 'No effect', icon: '∅' },
  { id: 'glow', name: 'Soft Glow', icon: '🌟' },
  { id: 'sparkle', name: 'Star Sparkle', icon: '💫' },
  { id: 'neon', name: 'Neon Edge', icon: '💜' },
  { id: 'bgblur', name: 'Background Blur', icon: '🌫️', seg: true, heavy: true },
  { id: 'backdrop', name: 'Studio Backdrop', icon: '🎬', seg: true, heavy: true }
];

export const lookById = (id) => LOOKS.find((l) => l.id === id) || LOOKS[0];
export const FX_DEFAULT = { look: 'none', beauty: 'off', funny: 'none', fx: 'none' };
export const isFastPath = (s) => !s || ((s.look || 'none') === 'none' && (s.beauty || 'off') === 'off' && (s.funny || 'none') === 'none' && (s.fx || 'none') === 'none');
