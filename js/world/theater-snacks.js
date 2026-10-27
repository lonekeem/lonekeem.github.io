// 🍿 Lone Keem Studio snack bar. Star Coins only (the normal Pal Shop path in js/pals/economy.js): no real money, ever.
// They are ordinary 'snack' items, so you can buy them again and again, hold one, eat it, or feed it to your Pal.
// js/app.js adminShopDoc() registers these too, so the admin's auto-publish puts their prices in config/palShop.
export const THEATER_SNACKS = [
  { id: 'tk_popcorn', name: 'Big Popcorn', e: '🍿', p: 12, st: 'cookie', col: '#ffe28a' },
  { id: 'tk_soda', name: 'Fizzy Soda', e: '🥤', p: 8, st: 'berry', col: '#ff5a6a' },
  { id: 'tk_candy', name: 'Gummy Candy', e: '🍬', p: 6, st: 'berry', col: '#ff8ad8' },
  { id: 'tk_choco', name: 'Choco Bar', e: '🍫', p: 7, st: 'cookie', col: '#7a4a2a' },
  { id: 'tk_nachos', name: 'Cheesy Nachos', e: '🧀', p: 15, st: 'cookie', col: '#ffc23a' },
  { id: 'tk_hotdog', name: 'Hot Dog', e: '🌭', p: 14, st: 'cookie', col: '#e0703a' },
  { id: 'tk_icecream', name: 'Ice Cream Cone', e: '🍦', p: 10, st: 'cake', col: '#fff1d6' },
  { id: 'tk_juice', name: 'Juice Box', e: '🧃', p: 5, st: 'berry', col: '#ffb02e' }
];
export const SNACK_BY = Object.fromEntries(THEATER_SNACKS.map((s) => [s.id, s]));
export async function registerTheaterSnacks() {
  const cat = await import('../pals/catalog.js');
  cat.addItems(THEATER_SNACKS.map((s) => ({ id: s.id, name: s.e + ' ' + s.name, kind: 'snack', st: s.st, col: s.col, p: s.p, r: 'c' })));
}
