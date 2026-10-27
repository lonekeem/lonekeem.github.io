# Lone Keem Studio songs

Put one `<key>.mp3` and one `<key>.json` (lyrics) here per song, then add one line to
`js/world/theater-songs.js`. Lyrics format (same as `assets/lyrics/*.json`):

```json
{ "lines": [ { "t": 12.4, "e": 15.9, "line": "First line of the song" } ] }
```

`t` = start second, `e` = end second (optional), `line` = the words shown on the big screen.
Only songs Keem sends. The list ships empty (the screen says "Now Showing: Coming Soon").
