// Gallery files are copied into memory before Cloudinary XHR.
// Run: node tests/safety/upload-bytes.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileInMemory, chunkInMemory, UNREADABLE_PICK } from '../../js/media-config.js';

const bytes = (buf) => [...new Uint8Array(buf)];

const src = new File([new Uint8Array([1, 2, 3, 4, 5])], 'clip.mp4', { type: 'video/mp4' });
const copy = await fileInMemory(src, src.name);
assert.notEqual(copy, src);
assert.equal(copy instanceof File, true);
assert.equal(copy.name, 'clip.mp4');
assert.equal(copy.type, 'video/mp4');
assert.deepEqual(bytes(await copy.arrayBuffer()), [1, 2, 3, 4, 5]);

let reads = 0;
const fading = {
  name: 'gallery.mp4',
  type: 'video/mp4',
  async arrayBuffer() {
    reads += 1;
    if (reads > 1) throw new Error('net::ERR_UPLOAD_FILE_CHANGED');
    return new Uint8Array([9, 8, 7, 6]).buffer;
  }
};
const held = await fileInMemory(fading, fading.name);
assert.equal(reads, 1);
assert.deepEqual(bytes(await held.arrayBuffer()), [9, 8, 7, 6]);
assert.equal(reads, 1, 'a later read must use the copy, not the gallery file');

const part = await chunkInMemory(src, 1, 4);
assert.equal(part instanceof Blob, true);
assert.equal(part instanceof File, false);
assert.equal(part.type, 'video/mp4');
assert.deepEqual(bytes(await part.arrayBuffer()), [2, 3, 4]);

const gone = {
  type: 'video/mp4',
  slice() { return { arrayBuffer: () => Promise.reject(new Error('NotReadableError')) }; }
};
await assert.rejects(() => chunkInMemory(gone, 0, 3), (e) => {
  assert.equal(e.message, UNREADABLE_PICK);
  assert.equal(e.userMessage, UNREADABLE_PICK);
  assert.equal(/network/i.test(e.message), false);
  return true;
});
await assert.rejects(() => fileInMemory({ arrayBuffer: () => Promise.reject(new Error('gone')), name: 'v.mp4', type: 'video/mp4' }, 'v.mp4'), (e) => e.userMessage === UNREADABLE_PICK);

const root = new URL('../../', import.meta.url);
const text = (p) => readFileSync(new URL(p, root), 'utf8');
const create = text('js/create.js');
const works = text('js/works.js');
const comments = text('js/richcomments.js');
const avatar = text('js/avatar-editor.js');
assert.match(create, /file = await fileInMemory\(file, file\.name \|\| 'snap'\)/);
assert.match(create, /fileInMemory\(f, f\.name \|\| 'upload'\)/);
assert.match(create, /chunkInMemory\(f, start, end\)/);
assert.match(works, /fileInMemory\(file, file\.name \|\| 'upload'\)/);
assert.match(works, /chunkInMemory\(file, s, e\)/);
assert.match(comments, /fileInMemory\(blob, 'comment\.jpg'\)/);
assert.match(avatar, /fileInMemory\(file, file\.name \|\| 'avatar\.jpg'\)/);
assert.match(text('sw.js'), /const CACHE = 'lks-v282'/);

console.log('PASS upload bytes');
