// Display names for players under 13. A fixed list, so a child cannot type a real name.
export const ADJ = ['Sunny', 'Happy', 'Brave', 'Kind', 'Calm', 'Swift', 'Cosy', 'Gold', 'Lucky', 'Bright', 'Gentle', 'Merry', 'Soft', 'Tiny', 'Cool'];
export const ANIM = ['Panda', 'Puppy', 'Fox', 'Otter', 'Bunny', 'Koala', 'Tiger', 'Dolphin', 'Owl', 'Star', 'Bear', 'Duck', 'Frog', 'Lion', 'Wolf'];

export function safeNameOk(n) {
  const p = String(n || '').trim().split(' ');
  return p.length === 2 && ADJ.includes(p[0]) && ANIM.includes(p[1]);
}

export function rollName() {
  return ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + ANIM[Math.floor(Math.random() * ANIM.length)];
}

export function nameOptionsHtml(current) {
  const cur = safeNameOk(current) ? String(current).trim() : rollName();
  let html = '';
  for (const a of ADJ) {
    for (const b of ANIM) {
      const n = a + ' ' + b;
      html += `<option value="${n}"${n === cur ? ' selected' : ''}>${n}</option>`;
    }
  }
  return html;
}
