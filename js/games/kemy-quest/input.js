// Keyboard, gamepad and touch input -> {left,right,up,down,jump,run,pause}
export function createInput(touchRoot) {
  const keys = new Set(); const touch = { left: false, right: false, jump: false, run: false };
  const st = { script: null, onPause: null, onAny: null, gpPause: false };
  const K = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], jump: ['Space', 'KeyZ', 'ArrowUp', 'KeyW', 'KeyK'], run: ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyJ'] };
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter' && st.playing) { st.onPause && st.onPause(); e.preventDefault(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && st.playing) e.preventDefault();
    keys.add(e.code); st.onAny && st.onAny();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); for (const k in touch) touch[k] = false; });
  // touch buttons: elements with data-k
  if (touchRoot) touchRoot.querySelectorAll('[data-k]').forEach((b) => {
    const k = b.dataset.k; const set = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle('on', v); if (v && b.setPointerCapture) try { b.setPointerCapture(e.pointerId); } catch {} st.onAny && st.onAny(); };
    b.addEventListener('pointerdown', set(true)); b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false)); b.addEventListener('lostpointercapture', () => { touch[k] = false; b.classList.remove('on'); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  const any = (arr) => arr.some((c) => keys.has(c));
  st.read = () => {
    if (st.script) return st.script();
    const s = { left: any(K.left) || touch.left, right: any(K.right) || touch.right, up: any(K.up), down: any(K.down), jump: any(K.jump) || touch.jump, run: any(K.run) || touch.run };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of pads) { if (!g) continue; const b = (i) => g.buttons[i] && g.buttons[i].pressed; const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      s.left ||= ax < -0.4 || b(14); s.right ||= ax > 0.4 || b(15); s.down ||= ay > 0.5 || b(13); s.up ||= ay < -0.5 || b(12);
      s.jump ||= b(0) || b(3); s.run ||= b(1) || b(2) || b(7) || b(6);
      if (b(9) && !st.gpPause) st.onPause && st.onPause(); st.gpPause = b(9);
    }
    return s;
  };
  st.clear = () => { keys.clear(); for (const k in touch) touch[k] = false; };
  return st;
}
