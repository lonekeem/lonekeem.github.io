// Shot spark pictures for Pal Zombie. Each shape is its own stamp.
// Only the Star Cannon uses a star. Goo guns use green drops. Written by Lone Keem.

export const FX_SHAPES = ['blob', 'drop', 'dot', 'puff', 'chip', 'flame', 'zap', 'star'];
export const GOO_COLORS = ['#6dff5a', '#3dcc45', '#b6ff8a'];

export function fxIndex(name) {
  const i = FX_SHAPES.indexOf(name);
  return i < 0 ? 0 : i;
}

// Which picture a gun's muzzle, trail, and impact should use.
export function shotFx(w) {
  if (!w) return 'blob';
  if (w.id === 'star') return 'star';
  if (w.id === 'goo' || w.id === 'glue') return 'drop';
  if (w.id === 'bubble' || w.id === 'seeker' || w.id === 'foam' || w.id === 'marsh' || w.id === 'halo') return 'puff';
  if (w.id === 'confetti' || w.id === 'boom' || w.id === 'rocket' || w.id === 'sling') return 'chip';
  if (w.id === 'toast' || w.id === 'comet') return 'flame';
  if (w.id === 'spark') return 'zap';
  if (w.id === 'nova' || w.id === 'prism') return 'chip';
  return 'dot';
}

// Goo guns stay green. Other guns return null and keep their own colours.
export function shotColors(w) {
  if (w && (w.id === 'goo' || w.id === 'glue')) return GOO_COLORS;
  return null;
}

// Draw one cell of the particle strip. White ink; the game tints it.
export function paintFxCell(ctx, name, s) {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.globalAlpha = 1;
  const m = s / 2;
  if (name === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 0.16 : 0.42) * s, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(m + Math.cos(a) * r, m + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); return;
  }
  if (name === 'drop') {
    ctx.beginPath();
    ctx.moveTo(m, s * 0.1);
    ctx.bezierCurveTo(s * 0.86, s * 0.4, s * 0.76, s * 0.9, m, s * 0.9);
    ctx.bezierCurveTo(s * 0.24, s * 0.9, s * 0.14, s * 0.4, m, s * 0.1);
    ctx.fill(); return;
  }
  if (name === 'dot') { ctx.beginPath(); ctx.arc(m, m, s * 0.16, 0, Math.PI * 2); ctx.fill(); return; }
  if (name === 'puff') {
    ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.beginPath(); ctx.arc(m, m, s * 0.24, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(m, m, s * 0.08, 0, Math.PI * 2); ctx.fill(); return;
  }
  if (name === 'chip') { ctx.fillRect(s * 0.3, s * 0.36, s * 0.4, s * 0.26); return; }
  if (name === 'flame') {
    ctx.beginPath();
    ctx.moveTo(m, s * 0.14);
    ctx.quadraticCurveTo(s * 0.8, s * 0.55, m, s * 0.86);
    ctx.quadraticCurveTo(s * 0.2, s * 0.55, m, s * 0.14);
    ctx.fill(); return;
  }
  if (name === 'zap') {
    ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.22); ctx.lineTo(s * 0.48, s * 0.46); ctx.lineTo(s * 0.36, s * 0.52); ctx.lineTo(s * 0.78, s * 0.8);
    ctx.stroke(); return;
  }
  const g = ctx.createRadialGradient(m, m, s * 0.04, m, m, s * 0.38);
  g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m, m, s * 0.38, 0, Math.PI * 2); ctx.fill();
}
