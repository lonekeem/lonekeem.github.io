// Pal Bingo — full-screen stadium win party. Loaded only when a player wins (never on the feed).
// Written by Lone Keem.
const CSS = `.pbs{position:fixed;inset:0;z-index:120;display:grid;place-items:center;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#fff;
background:radial-gradient(120% 70% at 50% 100%,#3fbf5a 0 34%,#2a8a3f 34.5% 40%,transparent 40.5%),linear-gradient(#1b1150,#3a1d7a 55%,#22104a);animation:pbsIn .35s ease-out}
.pbs-stands{position:absolute;left:-5%;right:-5%;top:14%;height:46%;background:repeating-linear-gradient(0deg,#2c1a66 0 18px,#24145a 18px 22px);border-radius:50% 50% 0 0/30% 30% 0 0;box-shadow:inset 0 -20px 30px rgba(0,0,0,.35)}
.pbs-crowd{position:absolute;inset:6% 4% 8%;display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:center;gap:2px 4px;font-size:clamp(14px,3.6vw,24px);line-height:1}
.pbs-crowd i{font-style:normal;display:inline-block;animation:pbsCheer .7s ease-in-out infinite alternate}
.pbs-crowd i:nth-child(3n){animation-delay:.2s}.pbs-crowd i:nth-child(3n+1){animation-delay:.45s}.pbs-crowd i:nth-child(4n){animation-duration:.55s}
.pbs-spot{position:absolute;top:-10%;width:34%;height:120%;background:linear-gradient(rgba(255,250,200,.55),rgba(255,250,200,0) 80%);clip-path:polygon(45% 0,55% 0,100% 100%,0 100%);mix-blend-mode:screen;transform-origin:50% 0;animation:pbsSweep 3s ease-in-out infinite alternate}
.pbs-spot.l{left:2%;transform:rotate(-18deg)}.pbs-spot.r{right:2%;transform:rotate(18deg);animation-delay:-1.5s}
.pbs-conf{position:absolute;inset:0;pointer-events:none}
.pbs-conf b{position:absolute;top:-6%;width:9px;height:14px;border-radius:2px;animation:pbsFall linear infinite}
.pbs-mid{position:relative;z-index:2;display:grid;justify-items:center;gap:6px;text-align:center;padding:12px;margin-top:6vh}
.pbs-mid h2{margin:0;font-size:clamp(40px,11vw,76px);line-height:.95;font-weight:900;color:#ffd34d;text-shadow:0 5px 0 #b4471f,0 0 24px rgba(255,211,77,.7);animation:pbsPop .5s cubic-bezier(.2,1.6,.4,1)}
.pbs-mid p{margin:0;font-weight:900;font-size:clamp(18px,5vw,26px);text-shadow:0 2px 0 #2b1d55}
.pbs-stars{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(255,211,77,.18);border:2px solid #ffd34d;font-weight:900;font-size:18px}
.pbs-pal{position:relative;width:min(40vw,180px);height:min(40vw,180px);animation:pbsDance 2.4s ease-in-out infinite}
.pbs-pal canvas{width:100%;height:100%}
.pbs-pal .pbs-emo{position:absolute;inset:0;display:grid;place-items:center;font-size:min(30vw,140px)}
.pbs-pal::after{content:"";position:absolute;left:18%;right:18%;bottom:2%;height:10%;border-radius:50%;background:rgba(0,0,0,.28);z-index:-1}
.pbs-go{margin-top:8px;padding:14px 30px;border:0;border-radius:18px;font:900 20px Inter,system-ui,sans-serif;color:#3a2300;background:linear-gradient(#ffe58a,#ffb020);box-shadow:0 5px 0 #b06f00,0 8px 18px rgba(0,0,0,.4);cursor:pointer}
.pbs-go:active{transform:translateY(3px);box-shadow:0 2px 0 #b06f00}
.pbs.out{animation:pbsOut .3s ease-in forwards}
.pbs-prize{display:flex;gap:10px;align-items:stretch;justify-content:center;flex-wrap:wrap}
.pbs-big{position:relative;display:grid;place-items:center;min-width:120px;padding:6px 16px;border-radius:20px;background:rgba(255,211,77,.16);border:3px solid #ffd34d;font-weight:900;font-size:clamp(30px,9vw,44px);line-height:1;color:#ffe58a;text-shadow:0 3px 0 #b4471f}
.pbs-big small{display:block;font-size:12px;letter-spacing:.06em;color:#fff;text-shadow:none;opacity:.9}
.pbs-burst{position:absolute;inset:0;pointer-events:none}.pbs-burst i{position:absolute;left:50%;top:50%;font-style:normal;font-size:18px;animation:pbsBurst .9s ease-out forwards}
.pbs-box{position:relative;display:grid;place-items:center;min-width:120px;padding:6px 16px;border-radius:20px;background:rgba(90,200,255,.16);border:3px solid #7fd6ff;font-weight:900;font-size:clamp(30px,9vw,44px);line-height:1;color:#cff3ff;text-shadow:0 3px 0 #1d4f8a}
.pbs-box small{display:block;font-size:12px;letter-spacing:.06em;color:#fff;text-shadow:none;opacity:.9}
.pbs-gift{font-size:44px;display:inline-block;animation:pbsShake .5s ease-in-out infinite}
.pbs-box.open .pbs-gift{display:none}.pbs-box .pbs-got{display:none}.pbs-box.open .pbs-got{display:block;animation:pbsPop .45s cubic-bezier(.2,1.6,.4,1)}
.pbs-note{font-weight:800;font-size:15px;max-width:320px}
@keyframes pbsBurst{from{transform:translate(-50%,-50%) scale(.4);opacity:1}to{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1.1);opacity:0}}
@keyframes pbsShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg) scale(1.05)}75%{transform:rotate(10deg) scale(1.05)}}
@keyframes pbsIn{from{opacity:0}}@keyframes pbsOut{to{opacity:0}}
@keyframes pbsPop{from{transform:scale(.3)}}
@keyframes pbsCheer{to{transform:translateY(-5px) rotate(6deg)}}
@keyframes pbsSweep{to{transform:rotate(14deg)}}
.pbs-spot.r{animation-name:pbsSweepR}@keyframes pbsSweepR{to{transform:rotate(-14deg)}}
@keyframes pbsFall{to{transform:translateY(115vh) rotate(720deg)}}
@keyframes pbsDance{0%{transform:translate(0,0) rotate(0)}10%{transform:translate(0,-18px)}20%{transform:translate(0,0) scaleY(.94)}30%{transform:translate(-26px,0) rotate(-8deg)}40%{transform:translate(26px,0) rotate(8deg)}50%{transform:translate(-26px,0) rotate(-8deg)}60%{transform:translate(0,0) rotate(0)}75%{transform:translate(0,-10px) rotate(360deg)}85%{transform:translate(0,0) rotate(360deg) scaleY(.94)}100%{transform:rotate(360deg)}}
@media (orientation:landscape) and (max-height:500px){.pbs-mid{grid-template-columns:auto auto;align-items:center;column-gap:18px;margin-top:2vh}.pbs-pal{grid-row:1/5;width:min(34vh,180px);height:min(34vh,180px)}}
@media (prefers-reduced-motion:reduce){.pbs,.pbs *{animation:none!important}.pbs-conf{display:none}}`;
const FANS = ['😀', '😄', '🥳', '😆', '🤩', '😺', '🐻', '🐰', '🐶', '🐼', '🦊', '🐸', '👏', '🙌', '📣', '🎉'];
const CONF = ['#ff4d6d', '#3fa9ff', '#ffd23f', '#4cd07d', '#ff8a1f', '#b77bff'];
let open = null;
// Synthesized crowd cheer (filtered noise swell) — no audio files.
function cheer(ctx, vol) {
  if (!ctx || vol <= 0) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const len = 2.2, sr = ctx.sampleRate, buf = ctx.createBuffer(1, Math.floor(sr * len), sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * (0.75 + 0.25 * Math.sin(t * 23 + Math.sin(t * 7) * 3)); }
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = ctx.currentTime;
    src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16 * vol, t0 + 0.35); g.gain.setValueAtTime(0.16 * vol, t0 + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    src.connect(bp).connect(g).connect(ctx.destination); src.start(t0); src.stop(t0 + len);
  } catch { /* no audio */ }
}
function ding(ctx, vol) {
  try { const t0 = ctx.currentTime; [784, 988, 1319].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; const t = t0 + i * 0.09; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4); }); } catch { /* no audio */ }
}
export function closeCelebration() { if (!open) return; const o = open; open = null; o.close(); }
// opts: { stars, title, sub, getPal: async () => pal|null, ctx, vol, muted, onClose }
export function celebrate(opts = {}) {
  closeCelebration();
  if (!document.getElementById('pbs-css')) { const s = document.createElement('style'); s.id = 'pbs-css'; s.textContent = CSS; document.head.appendChild(s); }
  const calm = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div'); el.className = 'pbs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'You won Pal Bingo');
  const fans = Array.from({ length: 70 }, (_, i) => `<i>${FANS[(i * 7 + 3) % FANS.length]}</i>`).join('');
  const conf = calm ? '' : Array.from({ length: 36 }, (_, i) => `<b style="left:${(i * 37) % 100}%;background:${CONF[i % CONF.length]};animation-duration:${2.4 + (i % 5) * 0.5}s;animation-delay:${-(i % 9) * 0.35}s"></b>`).join('');
  el.innerHTML = `<div class="pbs-stands"><div class="pbs-crowd" aria-hidden="true">${fans}</div></div><i class="pbs-spot l" aria-hidden="true"></i><i class="pbs-spot r" aria-hidden="true"></i><div class="pbs-conf" aria-hidden="true">${conf}</div>
    <div class="pbs-mid"><div class="pbs-pal" aria-hidden="true"><span class="pbs-emo">🐾</span></div><h2>BINGO!</h2><p>${opts.title || 'You win!'}</p><div class="pbs-prize">${opts.stars ? `<div class="pbs-big" data-s><span><span data-n>+0</span> ⭐<small>STARS</small></span><span class="pbs-burst" aria-hidden="true"></span></div>` : ''}${opts.boxP ? `<div class="pbs-box" data-box><span class="pbs-gift" aria-label="Prize box">🎁</span><span class="pbs-got" data-got></span></div>` : ''}</div><p class="pbs-note" data-note>${opts.trophy ? `${{ g: '🥇 Gold', s: '🥈 Silver', b: '🥉 Bronze' }[opts.trophy]} trophy added to your shelf!` : opts.sticker ? `New sticker: ${opts.sticker}` : ''}</p><button type="button" class="pbs-go">Keep playing</button></div>`;
  document.body.appendChild(el);
  let raf = 0, done = false;
  const close = () => { if (done) return; done = true; if (open && open.el === el) open = null; cancelAnimationFrame(raf); clearTimeout(tm); el.classList.add('out'); setTimeout(() => el.remove(), 300); if (opts.onClose) opts.onClose(); };
  const tm = setTimeout(close, 7000);
  el.querySelector('.pbs-go').onclick = close;
  open = { el, close };
  // prize: stars count up with a star burst, then the prize box pops open (💎 diamonds or bonus stars)
  const sEl = el.querySelector('[data-s]'), note = el.querySelector('[data-note]');
  const addNote = (t) => { if (note && t && !note.textContent.includes(t)) note.textContent = (note.textContent ? note.textContent + ' ' : '') + t; };
  if (sEl) {
    const n = sEl.querySelector('[data-n]'); let to = opts.stars | 0; const t0 = performance.now(), dur = calm ? 0 : 900;
    const step = (now) => { if (done) return; const k = dur ? Math.min(1, (now - t0) / dur) : 1; n.textContent = '+' + Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); else if (!calm) { const b = sEl.querySelector('.pbs-burst'); b.innerHTML = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<i style="--x:${Math.round(Math.cos(a) * 70)}px;--y:${Math.round(Math.sin(a) * 50)}px">⭐</i>`; }).join(''); } };
    requestAnimationFrame(step);
    Promise.resolve(opts.starP).then((g) => { if (done) return; if (g === 0) { sEl.firstElementChild.innerHTML = '⭐<small>STARS MAXED</small>'; addNote('Daily stars maxed, come back tomorrow!'); } else if (g > 0 && g < to) { to = g; n.textContent = '+' + g; } }).catch(() => {});
  }
  const box = el.querySelector('[data-box]');
  if (box) {
    const shown = new Promise((r) => setTimeout(r, calm ? 300 : 1300));
    Promise.all([Promise.resolve(opts.boxP).catch(() => ({})), shown]).then(([r]) => {
      if (done) return; r = r || {}; const got = box.querySelector('[data-got]');
      got.innerHTML = r.inf ? '∞ 💎<small>INFINITY PASS</small>' : r.dia ? `+${r.dia | 0} 💎<small>DIAMONDS</small>` : r.stars ? `+${r.stars | 0} ⭐<small>BONUS STARS</small>` : '🎉<small>GREAT GAME</small>';
      if (!r.dia && !r.stars && !r.inf) addNote('Daily stars maxed, come back tomorrow!');
      box.classList.add('open');
      if (!opts.muted && opts.ctx) ding(opts.ctx, opts.vol == null ? 1 : opts.vol);
    });
  }
  if (!opts.muted) cheer(opts.ctx, opts.vol == null ? 1 : opts.vol);
  // Draw the player's own Pal (3D if it's already loaded on this phone, otherwise the 2D art), waving its arms.
  (async () => {
    try {
      const pal = opts.getPal ? await opts.getPal() : null; if (!pal || done) return;
      const { drawPal } = await import('../pals/art.js'); if (done) return;
      const host = el.querySelector('.pbs-pal'); const cv = document.createElement('canvas'); cv.width = cv.height = 220;
      const c = cv.getContext('2d'); host.innerHTML = ''; host.appendChild(cv);
      let f = 0, last = 0;
      const draw = (now) => {
        if (done) return;
        if (now - last > 33) { last = now; f += 2; c.clearRect(0, 0, 220, 220); drawPal(c, 110, 205, 128, pal, { t: f, mode: calm ? 'idle' : 'happy' }); }
        if (!calm) raf = requestAnimationFrame(draw);
      };
      draw(performance.now() + 100);
    } catch { /* keep the 🐾 */ }
  })();
  return close;
}
