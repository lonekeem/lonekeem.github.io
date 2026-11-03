// 🚘 First-person cockpit: one shared, light interior built only while you drive in POV (dropped when you leave POV).
// The car's own body is hidden from the driver's eye so nothing blocks the view; in its place a thin real-looking frame:
// dashboard, instrument hood with canvas speed / RPM / fuel gauges, a steering wheel that turns with steering, door panels,
// side mirrors, thin A-pillars and a clear (barely tinted) windshield. Sized per car / truck class. Phones + low graphics
// get fewer pieces and a smaller gauge canvas that redraws less often. Written by Lone Keem.
export function makeCockpit(THREE, { low = false } = {}) {
  let ck = null; const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), UPY = new THREE.Vector3(0, 1, 0);
  function mount(car, def, seat, paint) { unmount(); const g = new THREE.Group(); g.name = 'cockpit'; g.userData.cockpit = 1; const disp = [];
    const truck = def.H >= 1.7 || /truck|van|pickup|bus|jeep|monster/.test(def.style || ''), sport = !!def.sport || /super|roadster|race/.test(def.style || ''), conv = !!def.conv;
    const W = def.Wd, E = seat.y + 0.62 + (truck ? 0.08 : 0), sz = seat.z, sx = seat.x; const roofY = E + (truck ? 0.5 : sport ? 0.3 : 0.4);
    const mat = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.7, metalness: o.m ?? 0, ...o.x }); disp.push(m); return m; };
    const geo = (x) => (disp.push(x), x); const mesh = (gm, m, x, y, z) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); o.renderOrder = 4; g.add(o); return o; };
    const dashM = mat(truck ? '#2a2f38' : '#1d2129', { r: 0.85 }), trimM = mat('#3a4150', { r: 0.5, m: 0.3 }), softM = mat('#4b4f5c', { r: 0.9 }), chromeM = mat('#cfd6e0', { r: 0.2, m: 0.9 });
    const dashD = truck ? 0.7 : 0.55, dashZ = sz + (truck ? 0.92 : 0.82); const dash = mesh(geo(new THREE.BoxGeometry(W - 0.1, 0.3, dashD)), dashM, 0, E - 0.36, dashZ);
    mesh(geo(new THREE.BoxGeometry(W - 0.12, 0.008, 0.02)), mat('#0e7490', { x: { emissive: '#22d3ee', emissiveIntensity: 0.25 } }), 0, E - 0.3, dashZ - dashD / 2 - 0.005); // ambient strip
    // hood in the car's paint so you can see where the nose is
    const hoodL = Math.max(0.6, def.L / 2 - dashZ - 0.15); const hood = mesh(geo(new THREE.BoxGeometry(W - 0.14, 0.04, hoodL)), mat(paint || '#888', { r: 0.35, m: 0.4 }), 0, E - (truck ? 0.4 : 0.44), dashZ + dashD / 2 + hoodL / 2); hood.rotation.x = 0.04;
    // instrument hood + gauges (canvas)
    mesh(geo(new THREE.BoxGeometry(0.56, 0.06, 0.24)), dashM, sx, E - 0.19, sz + 0.7);
    const cw = low ? 192 : 320, chh = Math.round(cw * 0.42); const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; disp.push(tex);
    const gm = mesh(geo(new THREE.PlaneGeometry(0.5, 0.21)), (() => { const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); disp.push(m); return m; })(), sx, E - 0.3, sz + 0.66); gm.rotation.set(-0.2, Math.PI, 0); gm.renderOrder = 5;
    // steering wheel (turns with steering)
    const wr = truck ? 0.2 : sport ? 0.16 : 0.18; const wheel = new THREE.Group(); wheel.position.set(sx, E - (truck ? 0.41 : 0.4), sz + 0.5); wheel.rotation.x = truck ? -0.55 : -0.3; g.add(wheel); const spin = new THREE.Group(); wheel.add(spin);
    const rimM = mat('#15171c', { r: 0.6 }); const add = (gm2, m, x, y, z) => { const o = new THREE.Mesh(gm2, m); o.position.set(x, y, z); o.renderOrder = 6; spin.add(o); return o; };
    add(geo(new THREE.TorusGeometry(wr, 0.02, low ? 6 : 8, low ? 18 : 30)), rimM, 0, 0, 0); add(geo(new THREE.BoxGeometry(wr * 2 - 0.02, 0.03, 0.02)), rimM, 0, -0.01, 0); add(geo(new THREE.BoxGeometry(0.03, wr - 0.01, 0.02)), rimM, 0, -wr / 2, 0);
    add(geo(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 12)), trimM, 0, -0.01, 0.005).rotation.x = Math.PI / 2; add(geo(new THREE.BoxGeometry(0.04, 0.015, 0.012)), mat('#facc15', { x: { emissive: '#facc15', emissiveIntensity: 0.4 } }), 0, wr, -0.005); // top marker
    mesh(geo(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8)), dashM, sx, E - 0.5, sz + 0.62).rotation.x = Math.PI / 2 - 0.3; // column
    // centre console + screen
    mesh(geo(new THREE.BoxGeometry(0.26, 0.28, 0.7)), dashM, 0, seat.y + 0.12, sz + 0.25); const scr = mesh(geo(new THREE.PlaneGeometry(0.22, 0.13)), mat('#0b1220', { x: { emissive: '#1e3a8a', emissiveIntensity: 0.5 } }), 0, E - 0.34, dashZ - dashD / 2 - 0.01); scr.rotation.y = Math.PI;
    // door panels + sills (low enough to see out the side windows)
    for (const s of [1, -1]) { mesh(geo(new THREE.BoxGeometry(0.07, 0.42, 1.5)), softM, s * (W / 2 - 0.05), E - 0.5, sz + 0.1); mesh(geo(new THREE.BoxGeometry(0.1, 0.03, 1.5)), trimM, s * (W / 2 - 0.06), E - 0.28, sz + 0.1); }
    // thin A-pillars + roof header (none on convertibles: just a slim windshield frame)
    const pil = (a, b, r) => { const len = v3.copy(b).sub(a).length(); const o = mesh(geo(new THREE.CylinderGeometry(r, r, len, 6)), trimM, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); o.quaternion.setFromUnitVectors(UPY, v4.copy(b).sub(a).normalize()); };
    const top = conv ? E + 0.12 : roofY, topZ = sz + (conv ? 0.62 : truck ? 0.5 : 0.34);
    for (const s of [1, -1]) pil(new THREE.Vector3(s * (W / 2 - 0.07), E - 0.22, dashZ - 0.05), new THREE.Vector3(s * (W / 2 - 0.14), top, topZ), conv ? 0.012 : 0.02);
    mesh(geo(new THREE.BoxGeometry(W - 0.26, conv ? 0.02 : 0.05, 0.06)), trimM, 0, top, topZ);
    if (!conv) mesh(geo(new THREE.BoxGeometry(W - 0.2, 0.03, 1.2)), mat('#cbd5e1', { r: 0.95 }), 0, top + 0.04, topZ - 0.62); // headliner
    // windshield: barely tinted + a soft reflection line
    { const a = new THREE.Vector3(0, E - 0.22, dashZ - 0.05), b = new THREE.Vector3(0, top, topZ); const h = v3.copy(b).sub(a).length(); const gl = mesh(geo(new THREE.PlaneGeometry(W - 0.26, h)), (() => { const m = new THREE.MeshBasicMaterial({ color: '#dbeafe', transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }); disp.push(m); return m; })(), 0, (a.y + b.y) / 2, (a.z + b.z) / 2); gl.rotation.x = Math.atan2(b.z - a.z, b.y - a.y); gl.renderOrder = 7; }
    if (!low) { // side mirrors + passenger seat (skipped on phones / low graphics)
      for (const s of [1, -1]) { const mx = s * (W / 2 + 0.09); mesh(geo(new THREE.BoxGeometry(0.2, 0.13, 0.06)), dashM, mx, E - 0.2, dashZ - 0.12); const gl = mesh(geo(new THREE.PlaneGeometry(0.17, 0.1)), chromeM, mx, E - 0.2, dashZ - 0.155); gl.rotation.y = Math.PI + s * 0.25; }
      mesh(geo(new THREE.BoxGeometry(0.48, 0.14, 0.5)), softM, -sx, seat.y + 0.07, sz); mesh(geo(new THREE.BoxGeometry(0.48, 0.62, 0.12)), softM, -sx, seat.y + 0.4, sz - 0.27).rotation.x = -0.12; }
    // hide the car's own body from the driver's eye (restored on unmount)
    // the cockpit lives beside the car (not inside it) so the whole body mesh can be hidden, then follows the car (sibling, local matrix)
    const hid = car.visible ? [car] : []; car.visible = false; g.matrixAutoUpdate = false; (car.parent || car).add(g); car.updateMatrix(); g.matrix.copy(car.matrix);
    ck = { g, car, disp, hid, cv, tex, spin, t: 0, key: '', max: Math.max(120, Math.round((def.top || 25) * 3.6 / 20) * 20 + 20), red: def.redline || 7000 }; draw(0, 0, 1, 1, false); return ck; }
  function draw(kmh, rpm, gear, fuel, rev) { const { cv } = ck, g = cv.getContext('2d'), w = cv.width, h = cv.height, r = h * 0.44;
    g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h); const dial = (cx, v, max, red, lab, txt) => { g.strokeStyle = '#334155'; g.lineWidth = h * 0.05; g.beginPath(); g.arc(cx, h * 0.55, r, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      if (red) { g.strokeStyle = '#ef4444'; g.beginPath(); g.arc(cx, h * 0.55, r, Math.PI * (0.8 + 1.4 * red), Math.PI * 2.2); g.stroke(); }
      const a = Math.PI * (0.8 + 1.4 * Math.min(1, v / max)); g.strokeStyle = '#38bdf8'; g.beginPath(); g.arc(cx, h * 0.55, r, Math.PI * 0.8, a); g.stroke();
      g.strokeStyle = '#f97316'; g.lineWidth = h * 0.03; g.beginPath(); g.moveTo(cx, h * 0.55); g.lineTo(cx + Math.cos(a) * r * 0.92, h * 0.55 + Math.sin(a) * r * 0.92); g.stroke();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 ${h * 0.22}px system-ui,sans-serif`; g.fillText(txt, cx, h * 0.7); g.fillStyle = '#94a3b8'; g.font = `700 ${h * 0.1}px system-ui,sans-serif`; g.fillText(lab, cx, h * 0.88); };
    dial(w * 0.22, kmh, ck.max, 0, 'km/h', String(kmh)); dial(w * 0.78, rpm, ck.red * 1.1, 1 / 1.1 * 0.9 + 0.01, 'rpm ×1000', (rpm / 1000).toFixed(1));
    g.fillStyle = '#fff'; g.font = `900 ${h * 0.3}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(rev ? 'R' : String(gear || 1), w * 0.5, h * 0.48);
    g.fillStyle = '#334155'; g.fillRect(w * 0.4, h * 0.72, w * 0.2, h * 0.07); g.fillStyle = fuel < 0.2 ? '#ef4444' : '#22c55e'; g.fillRect(w * 0.4, h * 0.72, w * 0.2 * Math.max(0, Math.min(1, fuel)), h * 0.07); g.fillStyle = '#94a3b8'; g.font = `700 ${h * 0.09}px system-ui,sans-serif`; g.fillText('⛽', w * 0.5, h * 0.95);
    ck.tex.needsUpdate = true; }
  function update(dt, steer, kmh, rpm, gear, fuel, rev) { if (!ck) return; ck.car.updateMatrix(); ck.g.matrix.copy(ck.car.matrix); ck.g.matrixWorldNeedsUpdate = true; ck.spin.rotation.z = -steer * 2.4; ck.t += dt; if (ck.t < (low ? 0.2 : 0.1)) return; ck.t = 0;
    const key = kmh + '|' + Math.round(rpm / 100) + '|' + gear + '|' + rev + '|' + Math.round(fuel * 50); if (key !== ck.key) { ck.key = key; draw(kmh, rpm, gear, fuel, rev); } }
  function unmount() { if (!ck) return; ck.g.parent && ck.g.parent.remove(ck.g); for (const o of ck.hid) o.visible = true; for (const d of ck.disp) d.dispose(); ck = null; }
  return { mount, unmount, update, get on() { return !!ck; }, get car() { return ck && ck.car; } };
}
