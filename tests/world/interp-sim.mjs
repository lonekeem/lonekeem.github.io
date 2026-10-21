// offline 60 fps replay of the receive path: OLD (lerp toward last target, k=dt*8) vs NEW (park3d interp(): 1.1 s buffered Hermite + dead-reckoning)
const DELAY = 1100; const R0 = +process.argv[2] || 4, W0 = +process.argv[3] || 0.35;
const truth = (t) => { const a = W0 * t / 1000; return { x: Math.sin(a) * R0, z: Math.cos(a) * R0, vx: Math.cos(a) * R0 * W0, vz: -Math.sin(a) * R0 * W0 }; };
const sends = []; for (let t = 0; t < 60000; t += 1000 + (Math.random() - 0.5) * 300) sends.push({ t, arr: t + 80 + Math.random() * 250, ...truth(t) });
function interp(o, dt, now) { const B = o.buf; const rt = now - o.off - DELAY; let a = B[0], b = null; for (let i = 0; i < B.length - 1; i++) if (B[i].t <= rt && B[i + 1].t >= rt) { a = B[i]; b = B[i + 1]; break; }
  let x, z; if (b) { const u = (rt - a.t) / Math.max(1, b.t - a.t), s1 = (b.t - a.t) / 1000; const u2 = u * u, u3 = u2 * u, h1 = 2 * u3 - 3 * u2 + 1, h2 = -2 * u3 + 3 * u2, h3 = u3 - 2 * u2 + u, h4 = u3 - u2; x = h1 * a.x + h2 * b.x + (h3 * a.vx + h4 * b.vx) * s1; z = h1 * a.z + h2 * b.z + (h3 * a.vz + h4 * b.vz) * s1; }
  else { const L = rt < B[0].t ? B[0] : B[B.length - 1]; const ah = Math.max(0, Math.min(1.5, (rt - L.t) / 1000)); x = L.x + L.vx * ah; z = L.z + L.vz * ah; }
  if (o.ix == null) { o.ix = x; o.iz = z; } else { const k = Math.min(1, dt * 14); o.ix += (x - o.ix) * k; o.iz += (z - o.iz) * k; } }
const run = (mode) => { const o = { buf: [], off: null }; let ox = null, oz, tx, tz, si = 0, px, pz; const sp = [];
  for (let now = 0; now < 60000; now += 1000 / 60) { while (si < sends.length && sends[si].arr <= now) { const s = sends[si++]; tx = s.x; tz = s.z; const off = now - s.t; o.off = o.off == null ? off : Math.min(off, o.off + (off - o.off) * 0.1); o.buf.push(s); if (o.buf.length > 4) o.buf.shift(); if (ox == null) { ox = tx; oz = tz; } }
    if (ox == null) continue; let x, z; if (mode === 'old') { const k = Math.min(1, 1 / 60 * 8); ox += (tx - ox) * k; oz += (tz - oz) * k; x = ox; z = oz; } else { interp(o, 1 / 60, now); x = o.ix; z = o.iz; }
    if (now > 5000 && px != null) sp.push(Math.hypot(x - px, z - pz) * 60); px = x; pz = z; }
  const m = sp.reduce((a, b) => a + b) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / sp.length); return { trueSpeed: +(R0 * W0).toFixed(2), mean: +m.toFixed(2), jitterCV: +(sd / m).toFixed(2), stalled: +(sp.filter((v) => v < 0.2 * m).length / sp.length).toFixed(2), maxJumpPerFrame_cm: +(Math.max(...sp) / 60 * 100).toFixed(1) }; };
console.log(JSON.stringify({ old: run('old'), new: run('new') }));
