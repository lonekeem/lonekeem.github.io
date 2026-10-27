// "The Sheriff of Lone Keem" is rated 13+. One check for every entry point (series page, player, For You cards,
// Explore / studio tiles, the Lone Keem Studio theater). It uses Kemy's trusted age (safety.js viewerAge(): the
// birthday saved once at sign-up, which only a moderator can change, plus the mod "under 13" flag), never a local
// "I'm 13+" self-confirm: under 13 and unknown age (signed out / no birthday yet) both see the friendly card instead.
import { viewerAge } from './safety.js';

export const SHERIFF_MIN_AGE = 13;
export const sheriffOk = () => { const a = viewerAge(); return a !== null && a >= SHERIFF_MIN_AGE; };
// same look as Kemy's other 13+ cards (.age-big + page-title, css/app.css)
export function sheriffAgeCard() {
  const a = viewerAge();
  const why = a === null ? 'Sign in with an account that has a birthday showing you are 13 or older to watch it.' : 'It will unlock here when you turn 13.';
  return `<section class="card pad center age-gate sheriff-age" data-sheriff-age><div class="age-big" aria-hidden="true">13+</div><h1 class="page-title">This show is for ages 13+</h1><p><b>The Sheriff of Lone Keem</b> is rated 13+. ${why}</p><p class="muted">Lots of family films are playing at Lone Keem Studio in Kemy World.</p><a class="btn btn-sm" href="#/watch">Back to Kemy</a></section>`;
}
