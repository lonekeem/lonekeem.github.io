// Notification sound names. The files are made by tools/make-notify-sounds.py.
// Written by Lone Keem.
export const DEFAULT_CHIME = 'soft-breeze';
export const CHIME_SOUNDS = [
  { id: 'soft-breeze', name: 'Soft Breeze', file: 'sounds/notify/soft-breeze.ogg' },
  { id: 'kalimba-hello', name: 'Kalimba Hello', file: 'sounds/notify/kalimba-hello.ogg' },
  { id: 'kalimba-sparkle', name: 'Kalimba Sparkle', file: 'sounds/notify/kalimba-sparkle.ogg' },
  { id: 'lo-fi-keys', name: 'Lo-fi Keys', file: 'sounds/notify/lo-fi-keys.ogg' },
  { id: 'velvet-ping', name: 'Velvet Ping', file: 'sounds/notify/velvet-ping.ogg' },
  { id: 'glass-drop', name: 'Glass Drop', file: 'sounds/notify/glass-drop.ogg' },
  { id: 'crystal-pair', name: 'Crystal Pair', file: 'sounds/notify/crystal-pair.ogg' },
  { id: 'soft-pluck', name: 'Soft Pluck', file: 'sounds/notify/soft-pluck.ogg' },
  { id: 'pocket-bell', name: 'Pocket Bell', file: 'sounds/notify/pocket-bell.ogg' },
  { id: 'dreamy-pad-ping', name: 'Dreamy Pad Ping', file: 'sounds/notify/dreamy-pad-ping.ogg' },
  { id: 'soft-bubble-pop', name: 'Soft Bubble Pop', file: 'sounds/notify/soft-bubble-pop.ogg' },
  { id: 'night-glow', name: 'Night Glow', file: 'sounds/notify/night-glow.ogg' },
  { id: 'star-blink', name: 'Star Blink', file: 'sounds/notify/star-blink.ogg' },
  { id: 'cozy-chord', name: 'Cozy Chord', file: 'sounds/notify/cozy-chord.ogg' },
  { id: 'pebble-tap', name: 'Pebble Tap', file: 'sounds/notify/pebble-tap.ogg' },
  { id: 'calm-ascend', name: 'Calm Ascend', file: 'sounds/notify/calm-ascend.ogg' },
  { id: 'moon-harp', name: 'Moon Harp', file: 'sounds/notify/moon-harp.ogg' },
  { id: 'hello-friend', name: 'Hello Friend', file: 'sounds/notify/hello-friend.ogg' },
  { id: 'airy-ding', name: 'Airy Ding', file: 'sounds/notify/airy-ding.ogg' },
  { id: 'none', name: 'None (silent)', file: '' }
];

export function validChime(id) {
  return CHIME_SOUNDS.some((s) => s.id === id);
}
export function chimeFile(id) {
  const s = CHIME_SOUNDS.find((x) => x.id === id);
  return s && s.file ? s.file : '';
}
