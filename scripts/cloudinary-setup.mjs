#!/usr/bin/env node
// Creates (or updates) the UNSIGNED Cloudinary upload presets used by the app:
//   lks_user_uploads (posts), lks_stories (24h stories), lks_avatars (profile pictures).
// Run on the box only. Credentials come from the environment and are never written anywhere:
//   CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... node scripts/cloudinary-setup.mjs <cloud_name> [--dry-run]
// The preset:
//   * unsigned: browsers upload directly with just the cloud name + preset name
//   * folder lks/user-uploads, random unique public ids, no overwrite
//   * allowed formats mp4, mov, webm, jpg, jpeg, png, heic, webp
//   * eager async transformations that MUST match VIDEO_T / POSTER_T in js/media-config.js:
//       video  -> c_limit,h_1920,w_1920/vc_h264,q_auto  (.mp4, H.264, capped at 1080p)
//       poster -> so_1,c_limit,h_1920,w_1920/q_auto     (.jpg frame at 1 s)
//     (free plan: videos over 40 MB can only be transformed eagerly/asynchronously)
// File size caps are enforced by the free plan itself (images 10 MB, videos 100 MB) and by the
// client (js/media-config.js LIMITS). Unsigned clients can't delete assets: when a post is
// deleted, its Cloudinary file stays until an admin cleans up with the Admin API (server-side).
const [cloud, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry-run');
const key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
if (!cloud || !/^[a-z0-9_-]+$/.test(cloud)) { console.error('usage: node scripts/cloudinary-setup.mjs <cloud_name> [--dry-run]'); process.exit(1); }
if (!key || !secret) { console.error('Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the environment.'); process.exit(1); }

const VIDEO_T = 'c_limit,h_1920,w_1920/vc_h264,q_auto';
const POSTER_T = 'so_1,c_limit,h_1920,w_1920/q_auto';
const base = {
  unsigned: 'true',
  use_filename: 'false',
  unique_filename: 'true',
  overwrite: 'false'
};
const PRESETS = [
  { name: 'lks_user_uploads', ...base, folder: 'lks/user-uploads', allowed_formats: 'mp4,mov,webm,jpg,jpeg,png,heic,webp',
    eager: `${VIDEO_T}/mp4|${POSTER_T}/jpg`, eager_async: 'true', tags: 'lks_user' },
  // Stories: same formats + eager versions as posts, own folder (old ones can be bulk-deleted by folder).
  { name: 'lks_stories', ...base, folder: 'lks/stories', allowed_formats: 'mp4,mov,webm,jpg,jpeg,png,heic,webp',
    eager: `${VIDEO_T}/mp4|${POSTER_T}/jpg`, eager_async: 'true', tags: 'lks_story' },
  // Avatars: the app already crops + resizes to a 512px JPEG; images only, small files.
  { name: 'lks_avatars', ...base, folder: 'lks/avatars', allowed_formats: 'jpg,jpeg,png,webp',
    eager: 'c_fill,h_512,w_512/f_auto,q_auto', eager_async: 'true', tags: 'lks_avatar' }
];
const api = `https://api.cloudinary.com/v1_1/${cloud}/upload_presets`;
const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
const call = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { Authorization: auth, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? new URLSearchParams(body) : undefined });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, j };
};
console.log('Presets:', PRESETS);
if (DRY) process.exit(0);
for (const settings of PRESETS) {
  const NAME = settings.name;
  const existing = await call('GET', `${api}/${NAME}`);
  const { name, ...rest } = settings;
  const r = existing.ok ? await call('PUT', `${api}/${NAME}`, rest) : await call('POST', api, settings);
  if (!r.ok) { console.error('Cloudinary error', NAME, r.status, r.j?.error?.message || r.j); process.exit(1); }
  console.log(existing.ok ? 'Updated' : 'Created', 'preset', NAME);
}
