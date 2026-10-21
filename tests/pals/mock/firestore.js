// 🧪 In-memory Firestore mock for shop tests. Enforces the two rules that matter for rapid buying:
// wallet/diamond buys must deduct from the CURRENT balance (paid == old - new), and pet docs need 1 s between updates.
// Writes land after a random 40-400 ms "network" delay. No real database is touched.
export const DB = new Map(); export const LOG = [];
const lat = () => new Promise((r) => setTimeout(r, 40 + Math.random() * 360));
const TS = { __ts: 1 }; export const serverTimestamp = () => TS; export const increment = (n) => ({ __inc: n }); export const deleteField = () => ({ __del: 1 });
export const doc = (db, ...p) => ({ path: p.join('/') }); export const collection = (db, ...p) => ({ path: p.join('/'), col: 1 });
export const query = (c) => c; export const where = () => ({}); export const limit = () => ({}); export const onSnapshot = () => () => {};
const snap = (path) => { const d = DB.get(path); return { exists: () => !!d, data: () => (d ? JSON.parse(JSON.stringify(d)) : undefined), id: path.split('/').pop() }; };
export async function getDoc(r) { await lat(); return snap(r.path); }
export async function getDocs(c) { await lat(); const docs = [...DB.keys()].filter((k) => k.startsWith(c.path + '/') && k.split('/').length === c.path.split('/').length + 1).map((k) => ({ id: k.split('/').pop(), ref: { path: k }, data: () => DB.get(k) })); return { docs }; }
const deny = (m) => { const e = new Error('Missing or insufficient permissions. ' + m); e.code = 'permission-denied'; throw e; };
function apply(ops) { const now = Date.now();
  for (const o of ops) { const old = DB.get(o.path), nd = { ...(o.merge && old ? old : {}), ...(o.kind === 'update' ? old : {}), ...o.data };
    for (const k in nd) { if (nd[k] === TS) nd[k] = now; else if (nd[k] && nd[k].__del) delete nd[k]; }
    if (o.kind === 'update' && /pal\/(wallet|diamonds)$/.test(o.path) && 'paid' in o.data && o.data.paid > 0) { const f = o.path.endsWith('wallet') ? 'coins' : 'd'; if (o.data.paid !== old[f] - nd[f]) deny('stale balance'); }
    if (o.kind === 'update' && /\/pets\//.test(o.path) && old && old.updatedAt && now - old.updatedAt < 1000) deny('pet saved < 1 s ago');
    o.nd = nd; }
  for (const o of ops) DB.set(o.path, o.nd); }
export async function setDoc(r, data) { await lat(); apply([{ kind: 'set', path: r.path, data }]); }
export async function updateDoc(r, data) { await lat(); apply([{ kind: 'update', path: r.path, data }]); }
export async function deleteDoc(r) { await lat(); DB.delete(r.path); }
export function writeBatch() { const ops = []; return { set: (r, data) => ops.push({ kind: 'set', path: r.path, data }), update: (r, data) => ops.push({ kind: 'update', path: r.path, data }), delete: (r) => ops.push({ kind: 'del', path: r.path }), commit: async () => { await lat(); apply(ops.filter((o) => o.kind !== 'del')); } }; }
