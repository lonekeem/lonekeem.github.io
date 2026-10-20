// Pal Park Arcade: the mini-game hub. Each game registers here once and shows up as an arcade booth in the park
// (BOOTHS gives world positions for the park scene) and in the #/arcade menu (fallback for any device).
// To add a game: registerMinigame({ id, name, emoji, color, desc, open: async (ctx) => {...} }) and give it a booth.
export const MINIGAMES = [];
export function registerMinigame(g) { if (!MINIGAMES.some((x) => x.id === g.id)) MINIGAMES.push(g); return g; }
export const BOOTHS = [ // park coordinates (2D park world px; 3D park: x/40, y/40), near the plaza
  { id: 'zombie', x: 1600, y: 1560, label: '🧟 Zombie Survival' },
  { id: 'armory', x: 1760, y: 1560, label: '🛡️ Zombie Armory' }
];
registerMinigame({ id: 'zombie', name: 'Pal Zombie Survival', emoji: '🧟', color: '#3d2a7a', tag: '3D · Action · Solo or 2-4 player co-op',
  desc: 'Play as your own Pal and splat waves of goofy zombies with goo, foam, bubbles and a pillow hammer. Earn 💎 Diamonds!',
  open: async (ctx, q) => { const m = await import('./zombie-lobby.js'); (ctx.zlobby = ctx.zlobby || m.createZombieLobby(ctx)); return ctx.zlobby.page(q || {}); } });
registerMinigame({ id: 'armory', name: 'Zombie Armory', emoji: '🛡️', color: '#5b3a1e', tag: 'Shop', desc: 'Weapons, upgrades and armor for Zombie Survival. Pay with 💎 Diamonds or ★ Star Coins.',
  open: async (ctx) => { const m = await import('./armory.js'); return m.createArmory(ctx).page(ctx.main); } });
registerMinigame({ id: 'palgames', name: 'Pal Games', emoji: '🐾', color: '#2a6a4a', tag: 'Race · Bubbles · Stars · Dance', desc: 'The classic Pal mini-games (vs other players or a bot).', href: '#/games/pals' });
export function createArcade(ctx) {
  const { main, esc, requireAuth } = ctx;
  function hub() {
    let best = {}; try { best = JSON.parse(localStorage.getItem('kemy-z-best-' + (ctx.S.user && ctx.S.user.uid)) || '{}'); } catch { /* */ }
    main.innerHTML = `<section style="max-width:760px;margin:0 auto;padding:12px"><div style="display:flex;align-items:center;gap:10px"><h2 style="flex:1;margin:0">🎮 Pal Park Arcade</h2><a class="btn btn-sm btn-ghost" href="#/park">🌳 Back to the Park</a></div>
      <p class="muted small">Step into a booth in Pal Park, or pick a game here.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">${MINIGAMES.map((g) => `<a class="card" href="${g.href || '#/arcade/' + g.id}" data-mg="${g.id}" style="display:block;padding:16px;border-radius:18px;background:${g.color};color:#fff;text-decoration:none;min-height:150px">
        <div style="font-size:46px">${g.emoji}</div><b style="font-size:1.15rem">${esc(g.name)}</b><div class="small" style="opacity:.8">${esc(g.tag || '')}</div><p class="small" style="margin:6px 0 0;opacity:.9">${esc(g.desc)}</p>${g.id === 'zombie' && best.wave ? `<div class="small" style="margin-top:6px">🏅 Best: wave ${best.wave} · ⭐ ${best.score}</div>` : ''}</a>`).join('')}</div>
      <p style="margin-top:14px"><a href="#/scores/pals">🏆 Scoreboard</a></p></section>`;
  }
  async function page(id, qs) {
    if (!requireAuth()) return;
    if (!id) return hub();
    const g = MINIGAMES.find((x) => x.id === id); if (!g) return hub();
    if (g.href) { location.hash = g.href; return; }
    return g.open(ctx, Object.fromEntries(new URLSearchParams(qs || '')));
  }
  return { page };
}
