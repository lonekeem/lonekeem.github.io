// Share Kemy: on-device QR code, Web Share, and a saveable picture.
// The code is drawn here (js/vendor/qrcode.js). Nothing is sent to a QR service.
// Written by Lone Keem.

import { qrcode } from './vendor/qrcode.js';

// Where the QR code and the share link point.
// This is the public Kemy site for now. Once the Android app is public on
// Google Play, switch this one constant to:
// https://play.google.com/store/apps/details?id=com.lonekeemstudios.kemy
export const SHARE_URL = 'https://lonekeem.github.io/';

export const SHARE_MESSAGE = 'Play Kemy: 10+ free games, no ads! 💜';

// Level H recovers about 30% of a damaged code, which leaves room for the logo.
const ECC = 'H';
const QUIET = 4;
// Deep purple on light gold. Both stay far apart so cameras can still read the code.
export const QR_DARK = [42, 8, 69, 255]; // #2a0845
export const QR_LIGHT = [255, 246, 214, 255]; // #fff6d6
const LOGO_URL = new URL('../kemy-logo.png', import.meta.url);

// Alignment-pattern positions, version 1..40 (ISO/IEC 18004). Used only to keep
// the center logo off those patterns when there is room.
const ALIGN_POS = [
  [],
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
];

if (typeof TextEncoder !== 'undefined') {
  qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));
}

export function qrMatrix(text = SHARE_URL) {
  const qr = qrcode(0, ECC);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rows = new Array(n);
  for (let r = 0; r < n; r++) {
    const row = new Array(n);
    for (let c = 0; c < n; c++) row[c] = qr.isDark(r, c);
    rows[r] = row;
  }
  return rows;
}

// Full width of the light pad behind the logo, in modules.
export function logoBoxModules(n) {
  const version = (n - 17) / 4;
  const pos = ALIGN_POS[version - 1] || [];
  const mid = (n - 1) / 2;
  const last = pos.length ? pos[pos.length - 1] : 0;
  let half = n * 0.105; // about 21% of the code, a readable logo
  for (const y of pos) {
    for (const x of pos) {
      const onFinder = (x === 6 && y === 6) || (x === 6 && y === last) || (y === 6 && x === last);
      if (onFinder) continue;
      const room = Math.max(Math.abs(x - mid), Math.abs(y - mid)) - 3;
      if (room < half) half = room;
    }
  }
  const finderClear = mid - 8;
  half = Math.min(half, finderClear);
  // A version with an alignment pattern in the middle cannot dodge it. Keep a
  // smaller logo (about 17% wide). Level H still has plenty of spare codewords.
  const minHalf = Math.min(n * 0.085, finderClear);
  if (!(half >= minHalf)) half = minHalf;
  return Math.max(4, half * 2);
}

function fill(data, w, x, y, bw, bh, color) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(w, x + bw), y1 = Math.min(data.length / 4 / w, y + bh);
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * w + x0) * 4;
    for (let xx = x0; xx < x1; xx++) {
      data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; data[o + 3] = color[3];
      o += 4;
    }
  }
}

function inRound(px, py, bw, bh, r) {
  const cx = px < r ? r : px >= bw - r ? bw - r : px;
  const cy = py < r ? r : py >= bh - r ? bh - r : py;
  if (cx === px && cy === py) return true;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function fillRound(data, w, x, y, bw, bh, r, color) {
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      if (!inRound(i + 0.5, j + 0.5, bw, bh, r)) continue;
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= w) continue;
      const o = (yy * w + xx) * 4;
      if (o < 0 || o + 3 >= data.length) continue;
      data[o] = color[0]; data[o + 1] = color[1]; data[o + 2] = color[2]; data[o + 3] = color[3];
    }
  }
}

function blit(dest, dw, src, dx, dy, bw, bh, radius) {
  const sw = src.width, sh = src.height, sd = src.data;
  for (let j = 0; j < bh; j++) {
    const sy = (j + 0.5) * sh / bh - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = Math.min(1, Math.max(0, sy - y0));
    for (let i = 0; i < bw; i++) {
      if (radius && !inRound(i + 0.5, j + 0.5, bw, bh, radius)) continue;
      const sx = (i + 0.5) * sw / bw - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      const xx = dx + i, yy = dy + j;
      if (xx < 0 || yy < 0 || xx >= dw) continue;
      const o = (yy * dw + xx) * 4;
      const a = (sd[i00 + 3] * (1 - fx) * (1 - fy) + sd[i10 + 3] * fx * (1 - fy) + sd[i01 + 3] * (1 - fx) * fy + sd[i11 + 3] * fx * fy) / 255;
      for (let k = 0; k < 3; k++) {
        const v = sd[i00 + k] * (1 - fx) * (1 - fy) + sd[i10 + k] * fx * (1 - fy) + sd[i01 + k] * (1 - fx) * fy + sd[i11 + k] * fx * fy;
        dest[o + k] = dest[o + k] * (1 - a) + v * a;
      }
      dest[o + 3] = 255;
    }
  }
}

// Raster of the QR, quiet zone included, with the logo sitting on a light pad.
export function renderSymbol(matrix, { modulePx = 8, logo = null } = {}) {
  const n = matrix.length;
  const dim = (n + QUIET * 2) * modulePx;
  const data = new Uint8ClampedArray(dim * dim * 4);
  fill(data, dim, 0, 0, dim, dim, QR_LIGHT);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      fill(data, dim, (c + QUIET) * modulePx, (r + QUIET) * modulePx, modulePx, modulePx, QR_DARK);
    }
  }
  const boxMods = logoBoxModules(n);
  const box = Math.round(boxMods * modulePx);
  const ox = Math.round((dim - box) / 2);
  const oy = Math.round((dim - box) / 2);
  const radius = Math.max(4, Math.round(box * 0.18));
  fillRound(data, dim, ox, oy, box, box, radius, QR_LIGHT);
  if (logo && logo.width && logo.height) {
    const inset = Math.max(2, Math.round(box * 0.1));
    const side = box - inset * 2;
    blit(data, dim, logo, ox + inset, oy + inset, side, side, Math.max(2, radius - inset));
  }
  return { width: dim, height: dim, data };
}

function paintCanvas(canvas, matrix, logo) {
  const column = canvas.closest('.sk-page, .sk-home') || canvas.parentElement;
  const wrap = canvas.parentElement;
  const avail = column?.clientWidth || 320;
  // The cream plate adds padding and a gold border around the code. Leave that
  // room so the plate stays inside the column instead of sticking out the side.
  let frame = 36;
  if (wrap && wrap !== column && typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(wrap);
    frame = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
      + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  }
  const cssMax = Math.min(400, Math.max(220, Math.floor(avail - frame - 2)));
  const dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const modulePx = Math.max(6, Math.floor((cssMax * dpr) / (matrix.length + QUIET * 2)));
  const sym = renderSymbol(matrix, { modulePx, logo });
  canvas.width = sym.width;
  canvas.height = sym.height;
  canvas.style.width = Math.round(sym.width / dpr) + 'px';
  canvas.style.height = Math.round(sym.height / dpr) + 'px';
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(sym.data, sym.width, sym.height), 0, 0);
  return sym;
}

let logoPromise = null;
export function loadLogoPixels() {
  if (typeof document === 'undefined') return Promise.resolve(null);
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const im = ctx.getImageData(0, 0, c.width, c.height);
          resolve({ width: im.width, height: im.height, data: im.data });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = LOGO_URL.href;
    });
  }
  return logoPromise;
}

function roundPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// PNG card: QR, Kemy logo (in the code and beside the title), and "Scan to play Kemy".
export async function buildCardCanvas() {
  const logo = await loadLogoPixels();
  const matrix = qrMatrix(SHARE_URL);
  const sym = renderSymbol(matrix, { modulePx: 16, logo });
  const side = 72;
  const W = sym.width + side * 2;
  const header = 210;
  const footer = 210;
  const H = header + sym.height + footer;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241043';
  ctx.fillRect(0, 0, W, H);
  roundPath(ctx, 28, 28, W - 56, H - 56, 36);
  ctx.strokeStyle = '#ffc83d';
  ctx.lineWidth = 8;
  ctx.stroke();

  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* draw with the fallback */ } }

  const mark = 88;
  const title = 'Kemy';
  ctx.font = '700 64px "Space Grotesk", system-ui, sans-serif';
  const titleW = ctx.measureText(title).width;
  const rowW = mark + 18 + titleW;
  const rowX = (W - rowW) / 2;
  if (logo) {
    const icon = document.createElement('canvas');
    icon.width = logo.width; icon.height = logo.height;
    icon.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(logo.data), logo.width, logo.height), 0, 0);
    roundPath(ctx, rowX, 58, mark, mark, 22);
    ctx.save();
    ctx.clip();
    ctx.drawImage(icon, rowX, 58, mark, mark);
    ctx.restore();
  }
  ctx.fillStyle = '#ffc83d';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, rowX + mark + 18, 58 + mark / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6d6';
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText('10+ free games, no ads', W / 2, 186);

  const plateY = header - 8;
  roundPath(ctx, side - 16, plateY, sym.width + 32, sym.height + 32, 28);
  ctx.fillStyle = '#fff6d6';
  ctx.fill();
  const qrCanvas = document.createElement('canvas');
  qrCanvas.width = sym.width; qrCanvas.height = sym.height;
  qrCanvas.getContext('2d').putImageData(new ImageData(sym.data, sym.width, sym.height), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, side, header + 8);

  const label = 'Scan to play Kemy';
  ctx.font = '700 48px system-ui, sans-serif';
  const lw = ctx.measureText(label).width;
  const pillW = lw + 64, pillH = 84;
  const pillX = (W - pillW) / 2;
  const pillY = header + sym.height + 36;
  roundPath(ctx, pillX, pillY, pillW, pillH, 42);
  ctx.fillStyle = '#ffc83d';
  ctx.fill();
  ctx.fillStyle = '#1a0533';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, pillY + pillH / 2);
  ctx.fillStyle = '#fff6d6';
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillText(SHARE_URL, W / 2, pillY + pillH + 40);
  ctx.fillStyle = '#e9d5ff';
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('Written by Lone Keem', W / 2, H - 52);
  return canvas;
}

export async function cardDataUrl() {
  const canvas = await buildCardCanvas();
  return canvas.toDataURL('image/png');
}

async function copyText(text, nav) {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch { /* try the older path */ }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch { return false; }
}

// Web Share when the browser has it. Otherwise copy the link and say so.
export async function shareKemy({ toast, nav } = {}) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : {});
  const data = { title: 'Kemy', text: SHARE_MESSAGE, url: SHARE_URL };
  let allowed = typeof n.share === 'function';
  if (allowed && n.canShare) {
    try { allowed = !!n.canShare(data); } catch { allowed = true; }
  }
  if (allowed) {
    try {
      await n.share(data);
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      try {
        await n.share({ title: 'Kemy', text: `${SHARE_MESSAGE} ${SHARE_URL}` });
        return 'shared';
      } catch (e2) {
        if (e2 && e2.name === 'AbortError') return 'cancelled';
      }
    }
  }
  const ok = await copyText(SHARE_URL, n);
  if (ok) {
    if (toast) toast('Link copied!');
    return 'copied';
  }
  if (toast) toast('Copy this link: ' + SHARE_URL);
  return 'failed';
}

export async function saveQrImage(toast) {
  const canvas = await buildCardCanvas();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { if (toast) toast('Couldn’t make the picture'); return false; }
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = 'kemy-qr.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
  if (toast) toast('QR image saved');
  return true;
}

function localToast(msg) {
  let el = document.getElementById('sk-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sk-toast';
    el.className = 'sk-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(localToast.t);
  localToast.t = setTimeout(() => el.classList.remove('on'), 3200);
}

function markup(opts) {
  const home = opts.variant === 'home';
  return `${home ? `<div class="section-head"><h2 id="share-kemy-title">Share Kemy</h2><p>Send the link, or let a friend scan the code. Free games, no ads.</p></div>` : `<p class="sk-back-row">${opts.back ? `<a class="sk-back" href="${opts.back}">← Games</a>` : ''}</p><h1 class="page-title" id="share-kemy-title">Share Kemy</h1><p class="sk-lead">Play Kemy: 10+ free games, no ads! Show this code or send the link.</p>`}
    <div class="sk-card">
      <div class="sk-qr-wrap"><canvas id="sk-qr" role="img" aria-label="QR code that opens Kemy at ${SHARE_URL}"></canvas></div>
      <p class="sk-url"><a href="${SHARE_URL}">${SHARE_URL}</a></p>
      <div class="sk-actions">
        <button class="btn btn-block" type="button" id="sk-share">Share</button>
        <button class="btn btn-ghost btn-block" type="button" id="sk-save">Save QR image</button>
      </div>
      <p class="sk-credit">Written by Lone Keem</p>
    </div>`;
}

export function mountShare(root, opts = {}) {
  if (!root || root.querySelector('#sk-qr')) return;
  const home = opts.variant === 'home';
  root.innerHTML = `<div class="${home ? 'sk-home' : 'sk-page'}">${markup(opts)}</div>`;
  const canvas = root.querySelector('#sk-qr');
  const matrix = qrMatrix(SHARE_URL);
  const toast = opts.toast || localToast;
  let logoPixels = null;
  const draw = () => {
    if (!canvas.isConnected) return;
    try { paintCanvas(canvas, matrix, logoPixels); }
    catch (e) { console.error(e); }
  };
  draw();
  // The first paint can run before the column has its real width. Draw again
  // once layout (and the logo) settle, and if the page is resized.
  requestAnimationFrame(draw);
  loadLogoPixels().then((logo) => { logoPixels = logo; draw(); });
  const column = canvas.closest('.sk-page, .sk-home');
  if (column && typeof ResizeObserver === 'function') {
    let width = 0;
    const watch = new ResizeObserver(() => {
      const next = column.clientWidth;
      if (!next || next === width) return;
      width = next;
      draw();
    });
    watch.observe(column);
  }
  root.querySelector('#sk-share').onclick = () => shareKemy({ toast }).catch(() => toast('Couldn’t share just now'));
  root.querySelector('#sk-save').onclick = () => saveQrImage(toast).catch(() => toast('Couldn’t save the picture'));
}
