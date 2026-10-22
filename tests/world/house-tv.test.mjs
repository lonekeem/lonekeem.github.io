// House TV: full-length YouTube, saved list, and the chat/TV split.
// YouTube links are allowed in homes/{plot}.radio only. kidSafe still blocks https:// in chat.
import { readFileSync } from 'node:fs';
import { ytId, ytWatchUrl, ytEmbedSrc, radioLinkOk, canonicalLink, PREVIEW_NOTE, YT_MAX, parseYtList, serYtList, ytListOk, radioKeep, playKeyOf, safeTitle } from '../../js/world/house-tv.js';

let pass = 0, fail = 0;
const ok = (n, cond) => { if (cond) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n); } };
const ID = 'jNQXAC9IVRw';
const timed = 'https://www.youtube.com/watch?v=' + ID + '&t=30s&start=12';

ok('timed watch url is still the full video id', ytId(timed) === ID);
ok('canonical url drops the timer', canonicalLink(timed) === ytWatchUrl(ID) && !ytWatchUrl(ID).includes('t=') && !canonicalLink(timed).includes('start='));
ok('shorts, youtu.be, music and embed ids', ytId('https://youtu.be/' + ID + '?t=15') === ID && ytId('https://www.youtube.com/shorts/' + ID) === ID && ytId('https://music.youtube.com/watch?v=' + ID) === ID && ytId('https://www.youtube-nocookie.com/embed/' + ID + '?start=30&end=60') === ID);
ok('discord and a bare https link are not tv links', !radioLinkOk('https://discord.gg/nope') && !radioLinkOk('https://example.com/watch?v=' + ID));
ok('spotify and apple still count as radio links', radioLinkOk('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT') && radioLinkOk('https://music.apple.com/us/album/example/1234567890'));

const on = ytEmbedSrc(ID, { autoplay: true, origin: 'https://lonekeem.github.io' });
const off = ytEmbedSrc(ID, { origin: 'https://lonekeem.github.io' });
ok('embed is playsinline and has no end or start', on.includes('playsinline=1') && off.includes('playsinline=1') && !on.includes('end=') && !on.includes('start=') && !off.includes('end='));
ok('autoplay only after a tap', on.includes('autoplay=1') && !off.includes('autoplay=') && on.startsWith('https://www.youtube-nocookie.com/embed/' + ID + '?'));

const items = [{ id: ID, title: 'Me at the zoo' }, { id: 'M7lc1UVf-VE', title: '  Demo\nvideo  ' }, { id: 'dQw4w9WgXcQ', title: 'https://discord.gg/no' }];
const ser = serYtList(items);
ok('list roundtrip keeps order and cleans titles', ser === ID + '\tMe at the zoo\nM7lc1UVf-VE\tDemo video\ndQw4w9WgXcQ\tYouTube\n' && JSON.stringify(parseYtList(ser).map((x) => x.title)) === JSON.stringify(['Me at the zoo', 'Demo video', 'YouTube']));
ok('saved list matches the rules shape', ytListOk(ser));
ok('a link title is not stored', safeTitle('https://discord.gg/no') === 'YouTube' && !ytListOk(ID + '\thttps://discord.gg/no\n'));
const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i).padStart(11, 'a'), title: 'YouTube' }));
ok('list stops at 20', serYtList(many).split('\n').filter(Boolean).length === YT_MAX);

const prev = { k: 'link', url: timed, list: ser };
ok('turning the tv off remembers the youtube link and the list', JSON.stringify(radioKeep(prev, { k: 'off' })) === JSON.stringify({ k: 'off', url: ytWatchUrl(ID), list: ser }));
ok('kemy radio keeps the last youtube link', radioKeep(prev, { k: 'kemy', t: 2, s: 10 }).url === ytWatchUrl(ID) && radioKeep(prev, { k: 'kemy', t: 2, s: 10 }).list === ser);
ok('rename does not change the playback key', playKeyOf(prev) === playKeyOf({ ...prev, list: serYtList(parseYtList(ser).reverse()) }) && playKeyOf(prev) === 'link|' + ID);
ok('spotify link does not go through the youtube player key', playKeyOf({ k: 'link', url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' }).startsWith('link|https://open.spotify.com/'));
ok('preview note is the exact sentence', PREVIEW_NOTE === 'Spotify & Apple Music play 30-sec previews unless signed in to your own paid account');

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const kid = rules.slice(rules.indexOf('function kidSafe'), rules.indexOf('function kidSafe') + 500);
ok('chat filter still blocks https links', kid.includes('https?://') && !kid.includes('youtube'));
ok('park chat still uses kidSafe', rules.includes('kidSafe(pp().say)'));
ok('tv rules allow a youtube list and not a new home field', rules.includes("r.keys().hasOnly(['k', 'url', 't', 's', 'list'])") && rules.includes('youtube') && rules.includes("hasOnly(['owner', 'name', 'style', 'garage', 'at', 'open', 'inv', 'invN', 'radio', 'decor', 'cars'])"));
ok('a youtube url would be blocked by the chat filter', /https?:\/\/|www\./i.test('https://www.youtube.com/watch?v=' + ID) && radioLinkOk('https://www.youtube.com/watch?v=' + ID));

const homes = readFileSync(new URL('../../js/world/homes.js', import.meta.url), 'utf8');
const keepAt = homes.indexOf('.kh-radio.dock.yt-keep');
const keep = homes.slice(keepAt, homes.indexOf('.kh-note-btn{', keepAt));
ok('youtube minimize stays a 2px in-viewport sliver', keep.includes('width:2px!important') && keep.includes('height:2px!important') && keep.includes('opacity:.01!important') && keep.includes('position:fixed!important') && keep.includes('visibility:visible!important') && keep.includes('display:block!important') && !keep.includes('display:none') && !keep.includes('-9999'));
ok('spotify minimize still parks far off-screen', homes.includes('left:-9999px!important') && homes.includes("'-9999px'"));
ok('a hidden youtube frame is told to keep playing', homes.includes('onStateChange') && homes.includes('playVideo') && homes.includes('nudgeYt'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
