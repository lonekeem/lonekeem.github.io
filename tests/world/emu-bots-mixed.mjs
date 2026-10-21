// Mixed-version presence bots on the EMULATOR: an OLD-build walker + OLD-build driver (no c/vx/ct/an fields)
// and a NEW-build walker + driver, all near (0,60). 1 update/s. Usage: T=60 node tests/world/emu-bots-mixed.mjs
const EMU = 'http://127.0.0.1:8199/v1/projects/lone-keem-studios/databases/(default)/documents/';
const T = +process.env.T || 60; const toP = (x, z) => [Math.round(x * 16 + 1600), Math.round(z * 16 + 1200)];
const bots = [{ id: 'old_walk', old: 1, cx: -6, cz: 66, R: 3, w: 0.4 }, { id: 'old_drive', old: 1, car: '~c310', cx: 0, cz: 80, R: 18, w: 0.3 },
  { id: 'new_walk', cx: 6, cz: 66, R: 3, w: 0.4 }, { id: 'new_drive', car: '~c520', cx: 0, cz: 80, R: 12, w: -0.35 }];
const put = (b, t) => { const ang = b.w * t, x = b.cx + Math.sin(ang) * b.R, z = b.cz + Math.cos(ang) * b.R; const vx = Math.cos(ang) * b.R * b.w, vz = -Math.sin(ang) * b.R * b.w; const [px, py] = toP(x, z); const yaw = Math.atan2(vx, vz); const r = ((Math.round(yaw * 180 / Math.PI) % 360) + 360) % 360;
  const f = { x: { integerValue: px }, y: { integerValue: py }, d: { integerValue: 1 }, r: { integerValue: r }, name: { stringValue: b.id }, uname: { stringValue: b.id }, color: { stringValue: '#ff8800' }, pal: { mapValue: { fields: { species: { stringValue: 'tiger' }, name: { stringValue: b.id } } } }, at: { timestampValue: new Date().toISOString() } };
  if (!b.old) Object.assign(f, { c: { stringValue: Math.floor(x / 160) + '_' + Math.floor(z / 160) }, vx: { integerValue: Math.round(vx * 10) }, vz: { integerValue: Math.round(vz * 10) }, ct: { integerValue: Date.now() }, an: { stringValue: b.car ? 'drive' : 'walk' }, v: { integerValue: 3 } });
  if (b.car) f.dn = { stringValue: b.car };
  return fetch(EMU + 'parkRooms/r1/p/' + b.id, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) }); };
const t0 = Date.now(); while (Date.now() - t0 < T * 1000) { const s = Date.now(); await Promise.all(bots.map((b) => put(b, (Date.now() - t0) / 1000))); await new Promise((r) => setTimeout(r, Math.max(0, 1000 - (Date.now() - s)))); }
