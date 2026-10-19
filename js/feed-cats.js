// Lone Keem Studios - post categories (Funny, News, Music, …) shared by the upload forms, the
// For You feed chips and the ranking. Keep CATS in sync with `postCats()` in firestore.rules.
export const CATS = [
  { id: 'funny', label: 'Funny', emoji: '😂' },
  { id: 'news', label: 'News', emoji: '📰' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'pals', label: 'Pals', emoji: '🐾' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'animals', label: 'Animals', emoji: '🐶' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'dance', label: 'Dance', emoji: '💃' },
  { id: 'learning', label: 'Learning', emoji: '💡' },
  { id: 'other', label: 'Other', emoji: '✨' }
];
export const CAT_IDS = CATS.map((c) => c.id);
export const catLabel = (id) => CATS.find((c) => c.id === id)?.label || '';
const WORDS = {
  funny: /\b(funny|comedy|lol|lmao|joke|jokes|prank|pranks|meme|memes|skit|hilarious|fail|fails|laugh)\b/,
  news: /\b(news|update|breaking|headline|announcement|report)\b/,
  music: /\b(music|song|songs|beat|beats|rap|singing|cover|remix|musicvideo)\b/,
  gaming: /\b(gaming|game|games|gamer|gameplay|bubblequest|starpool|chess|ludo)\b/,
  pals: /\b(pal|pals|kemypals|virtualpet)\b/,
  art: /\b(art|drawing|painting|sketch|design|animation)\b/,
  sports: /\b(sports|football|soccer|basketball|nba|nfl|goal|workout|fitness)\b/,
  movies: /\b(movie|movies|film|trailer|shortfilm|series|episode)\b/,
  animals: /\b(dog|dogs|cat|cats|puppy|kitten|animals|pet|pets)\b/,
  food: /\b(food|recipe|cooking|baking|snack)\b/,
  dance: /\b(dance|dancing|choreo|choreography)\b/,
  learning: /\b(learn|learning|howto|tutorial|science|facts|tips)\b/
};
// Category of a post: the one chosen at upload, else guessed from #hashtags / caption / movie genre.
export function catOf(p) {
  if (!p) return '';
  if (p.cat && CAT_IDS.includes(p.cat)) return p.cat;
  if (p.type === 'movie') return p.work?.genre === 'Comedy' ? 'funny' : p.work?.genre === 'Music' ? 'music' : 'movies';
  if (p.type === 'song') return 'music';
  const t = ((p.hashtags || []).join(' ') + ' ' + (p.text || '') + ' ' + (p.work?.title || '')).toLowerCase().replace(/#/g, ' ');
  for (const [id, re] of Object.entries(WORDS)) if (re.test(t)) return id;
  return '';
}
// Chip picker for upload forms. Returns markup; read the value with pickedCat(root, name).
export function catPickerHtml(name = 'cat', selected = '', esc = (s) => s) {
  return `<fieldset class="catpick"><legend class="small">Category <span class="muted">(helps people find it)</span></legend>
    <div class="catpick-row">${CATS.map((c) => `<label class="catchip"><input type="radio" name="${esc(name)}" value="${c.id}" ${selected === c.id ? 'checked' : ''}><span>${c.emoji} ${c.label}</span></label>`).join('')}</div></fieldset>`;
}
export const pickedCat = (root, name = 'cat') => { const v = root.querySelector(`input[name="${name}"]:checked`)?.value || ''; return CAT_IDS.includes(v) ? v : ''; };
