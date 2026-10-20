// Rules tests: owner/admin (verified lillykemoy1@gmail.com) buys without a balance; normal users still can't.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore "node tests/pals/admin-unlimited-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-admin-inf', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0; const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 200)); } };
const day = Math.floor(Date.now() / 864e5), past = Timestamp.fromMillis(Date.now() - 60000);
await env.withSecurityRulesDisabled(async (c) => { const d = c.firestore();
  await setDoc(doc(d, 'config/palShop'), { prices: { hat: 400, cookie: 5 }, kinds: { hat: 'wear', cookie: 'snack', z_foam: 'zweapon' }, deals: [{}], dprices: { z_foam: 80 }, v: 1 });
  for (const u of ['boss', 'kid']) {
    await setDoc(doc(d, `users/${u}/pal/wallet`), { coins: 0, total: 0, day, earned: {}, src: '', last: past, lastBuy: '', paid: 0, buyAt: past, room: [], updatedAt: past });
    await setDoc(doc(d, `users/${u}/pal/diamonds`), { d: 0, total: 0, day, today: 0, last: past, lastBuy: '', paid: 0, buyAt: past, updatedAt: past });
  }
});
const ADM = env.authenticatedContext('boss', { email: 'lillykemoy1@gmail.com', email_verified: true }).firestore();
const FAKE = env.authenticatedContext('kid', { email: 'lillykemoy1@gmail.com', email_verified: false }).firestore();
const KID = env.authenticatedContext('kid').firestore();
const coinBuy = (db, u, id, n = 1) => { const b = writeBatch(db);
  b.update(doc(db, `users/${u}/pal/wallet`), { lastBuy: id, paid: 0, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(db, `users/${u}/inv/${id}`), { n, at: serverTimestamp() }); return b.commit(); };
const diaBuy = (db, u, id) => { const b = writeBatch(db);
  b.update(doc(db, `users/${u}/pal/diamonds`), { lastBuy: id, paid: 0, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(db, `users/${u}/inv/${id}`), { n: 1, at: serverTimestamp() }); return b.commit(); };
await ok('admin buys a 400★ hat with 0 coins (balance unchanged)', assertSucceeds(coinBuy(ADM, 'boss', 'hat')));
await ok('admin buys a snack', assertSucceeds(coinBuy(ADM, 'boss', 'cookie', 1)));
await ok('admin buys 💎 item with 0 diamonds', assertSucceeds(diaBuy(ADM, 'boss', 'z_foam')));
await ok('admin cannot buy an unknown item', assertFails(coinBuy(ADM, 'boss', 'nope')));
await ok('admin still cannot set coins directly', assertFails(writeBatch(ADM).update(doc(ADM, 'users/boss/pal/wallet'), { coins: 999999, updatedAt: serverTimestamp() }).commit()));
await ok('admin cannot buy into another user inventory', assertFails(coinBuy(ADM, 'kid', 'hat')));
await ok('normal user cannot buy with 0 coins (paid 0)', assertFails(coinBuy(KID, 'kid', 'hat')));
await ok('normal user cannot buy 💎 with 0 diamonds', assertFails(diaBuy(KID, 'kid', 'z_foam')));
await ok('unverified admin-email user cannot buy free', assertFails(coinBuy(FAKE, 'kid', 'hat')));
await ok('normal user cannot fake a paid purchase without coins', assertFails((() => { const b = writeBatch(KID);
  b.update(doc(KID, 'users/kid/pal/wallet'), { coins: 0, lastBuy: 'hat', paid: 400, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(KID, 'users/kid/inv/hat'), { n: 1, at: serverTimestamp() }); return b.commit(); })()));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'users/kid/pal/wallet'), { coins: 500, total: 500, day, earned: {}, src: '', last: past, lastBuy: '', paid: 0, buyAt: past, room: [], updatedAt: past }); });
await ok('normal user with coins still buys normally (deducted)', assertSucceeds((() => { const b = writeBatch(KID);
  b.update(doc(KID, 'users/kid/pal/wallet'), { coins: 100, lastBuy: 'hat', paid: 400, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(KID, 'users/kid/inv/hat'), { n: 1, at: serverTimestamp() }); return b.commit(); })()));
await env.cleanup(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
