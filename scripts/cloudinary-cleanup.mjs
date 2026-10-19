#!/usr/bin/env node
// Kemy media cleanup (admin, local only). Deletes Cloudinary files that no post or profile uses any more.
// The Cloudinary API secret never leaves this machine: it's read from the environment, never printed,
// and this script is not loaded by the website. Firestore is read with the public web API (posts and
// profiles are public), so no Firebase credentials are needed.
//
// Usage (dry run first, it only lists):
//   bash -c 'set -a; source ~/.config/lks/cloudinary.env; set +a; node scripts/cloudinary-cleanup.mjs'
//   ... node scripts/cloudinary-cleanup.mjs --delete            # actually delete the orphans it listed
//   ... node scripts/cloudinary-cleanup.mjs --delete <url|public_id> ...   # delete specific files (e.g. a deleted post's media)
// Options: --min-age-hours=24 (skip fresh uploads that may still be mid-post), --story-days=3, --snap-days=7
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'zfmeldgm';
const KEY = process.env.CLOUDINARY_API_KEY, SECRET = process.env.CLOUDINARY_API_SECRET;
if (!KEY || !SECRET) { console.error('Missing CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET. Source ~/.config/lks/cloudinary.env first.'); process.exit(1); }
const AUTH = 'Basic ' + Buffer.from(KEY + ':' + SECRET).toString('base64');
const API = `https://api.cloudinary.com/v1_1/${CLOUD}`;
const FS = 'https://firestore.googleapis.com/v1/projects/lone-keem-studios/databases/(default)/documents';
const WEB_KEY = 'AIzaSyCF3hTcGkjpYb_4k-35R-qYcHsDcOR9yoY'; // public Firebase web key (already in js/firebase-init.js)
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.split('=')[1]) : d; };
const DELETE = args.includes('--delete');
const targets = args.filter((a) => !a.startsWith('--'));
const minAge = opt('min-age-hours', 24) * 3600e3, storyAge = opt('story-days', 3) * 864e5, snapAge = opt('snap-days', 7) * 864e5;

const cld = async (method, path) => { const r = await fetch(API + path, { method, headers: { Authorization: AUTH } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Cloudinary ${r.status}: ${j.error?.message || ''}`); return j; };
// public_id from a delivery URL: drop transformations and version, then the extension
const idFrom = (s) => { const m = String(s).match(/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:.*?\/)?v\d+\/(.+?)(?:\.[a-z0-9]{2,4})?(?:[?#].*)?$/i); return m ? { type: m[1], id: m[2] } : null; };

async function del(type, ids) {
  for (let i = 0; i < ids.length; i += 100) {
    const q = ids.slice(i, i + 100).map((x) => 'public_ids[]=' + encodeURIComponent(x)).join('&');
    const j = await cld('DELETE', `/resources/${type}/upload?${q}&invalidate=true`);
    for (const [k, v] of Object.entries(j.deleted || {})) console.log(`  ${v.padEnd(9)} ${type} ${k}`);
  }
}

if (targets.length) { // explicit files
  const byType = { image: [], video: [] };
  for (const t of targets) { const x = idFrom(t); if (x) byType[x.type].push(x.id); else { byType.image.push(t); byType.video.push(t); } }
  if (!DELETE) { console.log('Would delete:', JSON.stringify(byType), '\nAdd --delete to do it.'); process.exit(0); }
  for (const t of ['image', 'video']) if (byType[t].length) await del(t, byType[t]);
  process.exit(0);
}

// 1. every Cloudinary URL referenced by posts and profiles
const used = new Set();
const walk = (v) => { if (!v) return; if (v.stringValue) { const x = idFrom(v.stringValue); if (x) used.add(x.id); } if (v.mapValue) Object.values(v.mapValue.fields || {}).forEach(walk); if (v.arrayValue) (v.arrayValue.values || []).forEach(walk); };
for (const col of ['posts', 'users']) {
  let token = '', n = 0;
  do {
    const r = await fetch(`${FS}/${col}?pageSize=300&key=${WEB_KEY}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    const j = await r.json(); if (!r.ok) throw new Error(`Firestore ${col} ${r.status}: ${j.error?.message || ''}`);
    for (const d of j.documents || []) { n++; Object.values(d.fields || {}).forEach(walk); }
    token = j.nextPageToken || '';
  } while (token);
  console.log(`Read ${n} ${col}`);
}
console.log(`${used.size} media files are in use.`);

// 2. list Cloudinary files and pick orphans
const orphans = { image: [], video: [] }; const now = Date.now(); let bytes = 0;
for (const type of ['image', 'video']) {
  let cursor = '';
  do {
    const j = await cld('GET', `/resources/${type}/upload?prefix=lks/&max_results=500${cursor ? '&next_cursor=' + cursor : ''}`);
    for (const r of j.resources || []) {
      const age = now - Date.parse(r.created_at), id = r.public_id;
      let orphan = false;
      if (id.startsWith('lks/stories/')) orphan = age > storyAge;          // stories expire after 24h
      else if (id.startsWith('lks/snaps/')) orphan = age > snapAge;        // view-once snaps
      else if (/^lks\/(user-uploads|songs|avatars)\//.test(id)) orphan = age > minAge && !used.has(id);
      if (orphan) { orphans[type].push(id); bytes += r.bytes || 0; console.log(`  orphan ${type} ${id} ${(r.bytes / 1048576).toFixed(1)}MB ${r.created_at}`); }
    }
    cursor = j.next_cursor || '';
  } while (cursor);
}
const total = orphans.image.length + orphans.video.length;
console.log(`${total} orphaned files, ${(bytes / 1048576).toFixed(1)} MB.`);
if (!DELETE) { if (total) console.log('Dry run. Add --delete to remove them.'); process.exit(0); }
for (const t of ['image', 'video']) if (orphans[t].length) await del(t, orphans[t]);
console.log('Done.');
