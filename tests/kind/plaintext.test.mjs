// node tests/kind/plaintext.test.mjs — modded-keyboard clean-up + kind-words filter
import assert from 'node:assert/strict';
import { plainText, isFancy } from '../../js/plaintext.js';
import { badWord, sneakyWord } from '../../js/kindguard.js';
const eq = (a, b) => assert.equal(plainText(a), b, JSON.stringify(a));
eq('𝐡𝐞𝐥𝐥𝐨 𝘸𝘰𝘳𝘭𝘥 𝓼𝓬𝓻𝓲𝓹𝓽 𝔣𝔯𝔞𝔨 𝕕𝕠𝕦𝕓𝕝𝕖', 'hello world script frak double');
eq('ｈｅｌｌｏ', 'hello'); eq('ⓗⓔⓛⓛⓞ', 'hello'); eq('🅷🅴🅻🅻🅾', 'hello'); eq('🄷🄴🄻🄻🄾', 'HELLO'); eq('ʜᴇʟʟᴏ', 'hello'); eq('ʰᵉˡˡᵒ', 'hello');
eq('h\u200Be\u200Cl\u2060lo\uFEFF', 'hello'); eq('\u202Eolleh\u202C', 'olleh'); eq('h\u3164i', 'hi');
eq('h̷̛̤e̸̗l̵l̴o̶', 'hello');
eq('hеllо', 'hello'); // Cyrillic е, о inside a Latin word
// real languages + emoji survive
for (const t of ['Привет, как дела?', 'Καλημέρα', 'こんにちは', '你好', 'नमस्ते', 'مرحبا', 'café naïve', '👨‍👩‍👧 ❤️ 👍🏽 1️⃣', 'Ça va? ¿Qué tal?']) assert.equal(plainText(t), t, t);
assert.ok(!isFancy('normal text 😀'));
// filter on normalized text
for (const t of ['𝐟𝐮𝐜𝐤', 'ｓｈｉｔ', 'ⓑⓘⓣⓒⓗ', 'ѕhіt', 's\u200Bh\u200Bi\u200Bt', 'ꜱʜɪᴛ', 's̷h̸i̵t̴']) assert.ok(badWord(t), t);
for (const t of ['f u c k', 'sh1t', 'fuuuuck', 'b.i.t.c.h', '𝐟 𝐮 𝐜 𝐤']) assert.ok(badWord(t) || sneakyWord(t), t);
for (const t of ['hello friend', 'Привет', 'class assignment', '𝐡𝐢 𝐭𝐡𝐞𝐫𝐞']) assert.ok(!badWord(t) && !sneakyWord(t), t);
console.log('plaintext tests passed');
