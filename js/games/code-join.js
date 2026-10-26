// Room codes: one shared "Join with code" box and "Copy code" button for every online game.
// Friend games live in games/{CODE} (Ludo, Trivia, Star Cards, Chess, Pool, board games) or palGames/{CODE} (Pal Games).
export const ROOM_CODE = /^[A-Z0-9]{6}$/;
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newRoomCode = () => Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
const maxSeats = (g, pal) => pal ? 2 : g.type === 'ludo' ? Math.max(2, Math.min(4, +g.mode || 4)) : g.type === 'rush' ? 4 : g.type === 'trivia' ? 8 : g.type === 'starcards' ? 6 : 2;
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
const fail = (m) => { const e = new Error(m); e.friendly = true; return e; };

export function codeFormHtml(id = 'g-joincode', label = 'Join with code') {
  return `<form class="g-code g-joincode" data-joincode><label class="g-joincode-l" for="${id}">${label}</label><input id="${id}" maxlength="7" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code from your friend"><button class="btn btn-sm" type="submit">Join</button></form>`;
}
export function codeBoxHtml(gid) {
  return ROOM_CODE.test(gid) ? `<div class="g-room g-room-code"><p class="muted small">Room code · friends type it in “Join with code”</p><div class="g-roomcode">${gid}</div><button type="button" class="btn btn-sm btn-ghost" data-copy-code="${gid}">📋 Copy code</button></div>` : '';
}
// Look a code up and say, in kid-friendly words, why it can't be joined. Returns { hash, note } to go to.
export async function checkCode({ db, getDoc, doc, uid }, raw) {
  const c = cleanCode(raw);
  if (c.length !== 6) throw fail('Room codes are 6 letters and numbers, like ABC123.');
  let s = await getDoc(doc(db, 'games', c)); let pal = false;
  if (!s.exists()) { s = await getDoc(doc(db, 'palGames', c)).catch(() => null); pal = true; }
  if (!s || !s.exists()) throw fail(`No room with code ${c}. Check the letters and try again.`);
  const g = s.data(); const ps = g.players || []; const hash = (pal ? '#/games/pals/' : '#/game/') + c;
  if (uid && ps.includes(uid)) return { hash };
  if (g.status === 'done') throw fail(g.endReason === 'cancelled' ? 'That room was closed. Ask your friend for a new code.' : 'That game already ended. Ask your friend for a new code.');
  if (g.status === 'active') { if (pal) throw fail('That game already started. Ask your friend for a new code.'); return { hash, note: 'That game already started. You can watch it.' }; }
  if (g.invitee && g.invitee !== uid) throw fail('That game is saved for someone else.');
  if (ps.length >= maxSeats(g, pal)) throw fail('That room is full. Ask your friend to make a new one.');
  const hb = ms((g.hb || {})[g.host]); const last = Math.max(hb, ms(g.updatedAt), ms(g.createdAt));
  if (last && Date.now() - last > (hb ? 15 : 120) * 60000) throw fail('That room has expired. Ask your friend for a new code.');
  return { hash };
}
// Wire every [data-joincode] form under root. opts: { db, getDoc, doc, uid: () => uid, toast, needAuth: () => bool }
export function wireCodeForms(root, opts) {
  root.querySelectorAll('[data-joincode]').forEach((f) => {
    const inp = f.querySelector('input');
    inp.oninput = () => { const v = cleanCode(inp.value); if (inp.value !== v) inp.value = v; };
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = f.querySelector('button'); if (btn.disabled) return;
      if (opts.needAuth && !opts.needAuth()) return;
      btn.disabled = true;
      try { const r = await checkCode({ ...opts, uid: opts.uid() }, inp.value); if (r.note) opts.toast(r.note); location.hash = r.hash; }
      catch (er) { opts.toast(er.friendly ? er.message : 'Couldn’t check that code. Try again.'); }
      finally { btn.disabled = false; }
    };
  });
}
// One page-wide listener for every "Copy code" button.
let copyWired = false;
export function wireCopyCode(toast) {
  if (copyWired) return; copyWired = true;
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-copy-code]'); if (!b) return;
    const c = b.dataset.copyCode;
    try { await navigator.clipboard.writeText(c); toast(`Code ${c} copied`); } catch { prompt('Copy this code:', c); }
  });
}
