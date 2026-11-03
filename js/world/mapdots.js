// Other players on the minimap / full map. Presence data only (no reads/writes). Written by Lone Keem.
// Uses the smoothed pose (ix/iz from park3d interp) when there is one. Nearest N only. Reuses one array.
const pick = [];
const inCar = (dn) => typeof dn === 'string' && (dn.slice(0, 2) === '~c' || dn.slice(0, 2) === '~r');
const short = (s) => { s = String(s || '').trim(); return s.length > 12 ? s.slice(0, 11) + '…' : s; };
export function nearPlayers(others, px, pz, n = 30) {
  pick.length = 0; if (!others) return pick;
  for (const o of others.values()) { if (o.house) continue; const x = o.ix ?? o.x, z = o.iz ?? o.z; if (!Number.isFinite(x) || !Number.isFinite(z) || x > 392) continue; pick.push({ o, x, z, d: (x - px) ** 2 + (z - pz) ** 2 }); }
  pick.sort((a, b) => a.d - b.d); if (pick.length > n) pick.length = n; return pick;
}
// one dot (+ white ring and 🚗 when driving or riding), optional name under it
export function drawPlayer(cx, a, b, p, name, k = 1) {
  const o = p.o, car = inCar(o.dn), r = 4 * k;
  cx.fillStyle = /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : '#7c3aed'; cx.strokeStyle = '#fff'; cx.lineWidth = car ? 2.5 : 1.5;
  cx.beginPath(); cx.arc(a, b, car ? r + 1.5 : r, 0, 7); cx.fill(); cx.stroke();
  if (car) { cx.font = `${Math.round(10 * k)}px system-ui`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🚗', a + r + 5, b - r - 3); }
  if (name) { const t = short(o.name); if (!t) return; cx.font = `700 ${Math.round(10 * k)}px Inter,system-ui,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'top'; cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.65)'; cx.strokeText(t, a, b + r + 2); cx.fillStyle = '#fff'; cx.fillText(t, a, b + r + 2); }
}
