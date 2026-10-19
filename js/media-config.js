// Lone Keem Studios - photo / video upload config (Cloudinary, free plan).
// ---------------------------------------------------------------------------
// THIS IS THE ONLY FILE TO EDIT TO SWITCH UPLOADS ON (plus the matching line in
// firestore.rules). `scripts/set-cloud-name.sh <cloud_name>` updates both.
//
//  * cloudName     - your Cloudinary "cloud name" (public, safe to commit).
//  * uploadPreset  - an UNSIGNED upload preset (public by design). It is created by
//                    scripts/cloudinary-setup.mjs with: folder lks/user-uploads, allowed
//                    formats mp4,mov,webm,jpg,jpeg,png,heic,webp, and eager async
//                    transformations that match VIDEO_T / POSTER_T below.
//
// NEVER put the Cloudinary API key or API secret in this file or anywhere in the repo.
// The browser only needs the cloud name + unsigned preset name.
// ---------------------------------------------------------------------------
export const CLOUDINARY = {
  cloudName: 'REPLACE_WITH_CLOUD_NAME', // <-- PLACEHOLDER: set to the real cloud name
  uploadPreset: 'lks_user_uploads',    // unsigned preset (see scripts/cloudinary-setup.mjs)
  folder: 'lks/user-uploads'           // enforced by the preset; informational here
};

// Client-side limits (Cloudinary free plan caps: images 10 MB, videos 100 MB).
export const LIMITS = {
  maxVideoSeconds: 60,
  maxVideoMB: 100,
  maxImageMB: 10,
  captionMax: 2000 // same as the existing text post limit
};

export const VIDEO_EXT = ['mp4', 'mov', 'webm'];
export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];

// Delivery transformations. The video + poster strings MUST stay identical to the eager
// transformations in the upload preset: on the free plan, videos over 40 MB can't be
// transformed on the fly, so playback relies on the pre-generated (eager) versions.
// Video is delivered as H.264 MP4 capped at 1080p (long side 1920) so it plays everywhere;
// f_auto can't be pre-generated eagerly, so it's used for images only.
export const VIDEO_T = 'c_limit,h_1920,w_1920/vc_h264,q_auto';
export const POSTER_T = 'so_1,c_limit,h_1920,w_1920/q_auto';
export const IMAGE_T = 'c_limit,h_1920,w_1920/f_auto,q_auto';
export const THUMB_T = 'c_fill,g_auto,h_640,w_480/f_auto,q_auto';

export const uploadsReady = () =>
  !!(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset && !/^REPLACE_/.test(CLOUDINARY.cloudName));

export const uploadEndpoint = () =>
  `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloudName)}/auto/upload`;

export const deliveryBase = () => `https://res.cloudinary.com/${CLOUDINARY.cloudName}/`;

// Build the URLs saved on the post from Cloudinary's upload response.
export function deliveryUrls(r) {
  const base = deliveryBase();
  const v = r.version ? `v${r.version}/` : '';
  if (r.resource_type === 'video') {
    return {
      mediaType: 'video',
      mediaUrl: `${base}video/upload/${VIDEO_T}/${v}${r.public_id}.mp4`,
      posterUrl: `${base}video/upload/${POSTER_T}/${v}${r.public_id}.jpg`
    };
  }
  return {
    mediaType: 'image',
    mediaUrl: `${base}image/upload/${IMAGE_T}/${v}${r.public_id}`,
    posterUrl: `${base}image/upload/${THUMB_T}/${v}${r.public_id}`
  };
}
