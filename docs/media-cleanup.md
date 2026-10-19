# Deleting Cloudinary media (admin)

Kemy runs on the free Firebase Spark plan with no server, and Cloudinary deletes need the API secret.
The secret must never ship in the website, so media deletion is a **local admin script**:
`scripts/cloudinary-cleanup.mjs`. It reads `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` from
`~/.config/lks/cloudinary.env` and never prints them. Firestore is read through the public web API (posts and profiles are public).

```bash
# Dry run: list orphaned files (not used by any post or profile)
bash -c 'set -a; source ~/.config/lks/cloudinary.env; set +a; node scripts/cloudinary-cleanup.mjs'
# Delete those orphans
bash -c 'set -a; source ~/.config/lks/cloudinary.env; set +a; node scripts/cloudinary-cleanup.mjs --delete'
# Delete specific files (delivery URLs or public IDs)
bash -c 'set -a; source ~/.config/lks/cloudinary.env; set +a; node scripts/cloudinary-cleanup.mjs --delete "<url>" ...'
```

Rules for orphans:
- `lks/user-uploads`, `lks/songs` and `lks/avatars`: orphaned when no post or profile references them and they're older than `--min-age-hours` (24 by default).
- `lks/stories`: deleted after `--story-days` (3 by default). Stories expire after 24 hours.
- `lks/snaps`: deleted after `--snap-days` (7 by default).

**In the app:** when the admin deletes a post that has Cloudinary media, a dialog shows the exact `--delete` command for that post's files, with a Copy button.
For a full account removal request (sent by email), run the orphan sweep after the user deletes their account.
