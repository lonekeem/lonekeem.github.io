// Friendly public-chat phrases for players under 13 (or whose age we don't know).
// 13+ players still type their own words, and the safety filter still applies.
export const SAFETY_NOTE = "For safety, links and contact info aren't allowed";
export const PHRASE_NOTE = 'Pick a phrase to chat.';

export const PHRASES = [
  'Good game!',
  'Want to race?',
  'Nice car!',
  'Follow me!',
  'Thanks!',
  'Hi!',
  'Bye!',
  'Wanna play?',
  'Hello!',
  'Nice shot!',
  'Lets go!',
  'Wait for me!',
  'GG!',
  'Nice one!',
  'Well played!',
  '😂',
  '😍',
  '😮',
  '🥳',
  '👍',
  '💜',
  '🔥',
  '⭐',
  '😎',
  '🤩',
  '🙌',
  '👏',
  '👋',
  '🎉'
];

export const phraseOnly = () => window.kemyPhraseOnly !== false;
// Phrases only because there is no birthday on file yet; unlockTyping() asks for it (js/safety.js).
export const BIRTHDAY_NOTE = 'Want to type your own words? Add your birthday';
export const needsBirthday = () => !!(phraseOnly() && window.kemyNeedsBirthday && window.kemyNeedsBirthday());
export const unlockTyping = () => (window.kemyUnlockTyping ? window.kemyUnlockTyping() : Promise.resolve(false));
export const isPhrase = (t) => PHRASES.includes(String(t || ''));
