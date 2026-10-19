# Share a video into Kemy from another app

`manifest.webmanifest` has a **Web Share Target** (`share_target`, POST multipart, field `media` for
video files, plus title/text/url). On Android, once Kemy is installed (Chrome "Install app" or the Play
Store app), Kemy appears in the share sheet of CapCut, InShot, Gallery, Google Photos and other apps.

How it works: the share arrives as a POST to `./share-target`; `sw.js` keeps the file in the `kemy-share`
cache and opens `app.html#/new/movie?shared=1`. The "Share a movie" form picks the file up (or a shared
YouTube link), fills in the title, and deletes the cached copy.

Limits: uploads are up to 10 minutes / 100 MB. Bigger files show a message suggesting an (unlisted)
YouTube link instead, with a button that switches the form to the YouTube field.

**Play Store app (TWA):** the Android wrapper must declare the share target too, otherwise Kemy won't
appear in the share sheet of the Play Store install. With Bubblewrap, add to `twa-manifest.json`:

```json
"shareTarget": {
  "action": "/share-target",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": { "title": "title", "text": "text", "url": "url",
              "files": [{ "name": "media", "accept": ["video/*"] }] }
}
```

then `bubblewrap update` and rebuild/upload the app. (Not done from here: the Android build folder is
left untouched.) The installed PWA picks up the manifest change on its own after the next update check.
