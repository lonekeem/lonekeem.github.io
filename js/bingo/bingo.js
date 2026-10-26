// Pal Bingo — cozy 75-ball rooms. Lazy-loaded from the arcade and the Bingo Hall.
// Stars are prizes for playing (the shared daily win cap). Nothing here is a wager or a purchase.
// Written by Lone Keem.
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, query, where, orderBy, limit, serverTimestamp }
  from '../fsq.js';
import { sfx } from '../games/sfx.js';
import { masterVol, sfxVol } from '../volume.js';
import { watchGameRotate } from '../rotate.js';
import {
  BOTS, LUCKY_BALLS, PATTERN_NAME, ballsFor, bingoCall, cardFor, cardMiss, cardSlots, dayKey, letterOf,
  botReactMs, levelOf, luckyRound, markedWin, masksFor, PICK_IDS, PICK_NAME, pickSeed, roomPick, roomPattern, roundAt, roundSeed, weekId
} from './logic.js';

const CSS = `.pb{max-width:1040px;margin:0 auto;padding:10px 10px 24px;color:#2b1d55;font-family:Inter,system-ui,sans-serif}
.pb-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.pb-top h1{font-size:1.25rem;margin:0;flex:1}
.pb-top a,.pb-ico{border:0;background:#fff;border-radius:12px;min-width:40px;height:40px;display:grid;place-items:center;text-decoration:none;color:inherit;font-weight:800}
.pb h1 small{display:block;font-weight:600;font-size:.72rem;opacity:.7}
.pb-hero{width:100%;height:140px;border-radius:18px;display:block;background:#7dd3fc;overflow:hidden}
.pb-banner svg{width:100%;height:140px;display:block}
.pb-note{font-size:.8rem;background:#fff6d8;border-radius:12px;padding:8px 10px;margin:8px 0}
.pb-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.pb-row button,.pb-row a{border:0;border-radius:14px;padding:10px 12px;font-weight:800;background:#6b4fd6;color:#fff;text-decoration:none}
.pb-row .alt{background:#fff;color:#2b1d55}
.pb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pb-box{background:#fff;border-radius:16px;padding:10px}
.pb-box h2{font-size:.95rem;margin:0 0 6px}
.pb-xp{height:10px;background:#efe7ff;border-radius:99px;overflow:hidden;margin-top:4px}.pb-xp i{display:block;height:100%;background:#ffb31a}
.pb-lock{opacity:.45}
.pb code{font-weight:800;letter-spacing:.12em}
.pb-meta{display:flex;justify-content:space-between;gap:8px;font-weight:800;font-size:.9rem}
.pb-meta .lucky{color:#a15c00}
.pb-cards{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.pb-card{background:#fff;border-radius:14px;padding:8px;flex:none;border:3px solid transparent}
.pb-card.one{border-color:#ffd34d;box-shadow:0 0 16px #ffd34d}
.pb-card.win{border-color:#6b4fd6}
.pb-cell{border:0;border-radius:8px;background:#f6f1ff;color:inherit;font-weight:800;position:relative}
.pb-cell.got{animation:pbStamp .28s ease-out}
.pb-powers{display:flex;gap:6px;flex-wrap:wrap}.pb-powers button{border:0;border-radius:12px;padding:8px 10px;font-weight:800;background:#fff}
.pb-chat{display:flex;gap:6px;flex-wrap:wrap}.pb-chat button{border:0;border-radius:999px;background:#fff;padding:6px 10px;font-weight:800}
.pb-live{position:fixed;inset:0;z-index:70;isolation:isolate;box-sizing:border-box;width:100%;height:100dvh;max-width:none;max-height:100dvh;margin:0;display:flex;flex-direction:column;gap:6px;overflow:hidden;border-radius:0;padding:max(6px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));color:#1e293b;background:#7dd3fc}
.pb-scene{position:absolute;inset:0;z-index:0;pointer-events:none}
.pb-scene svg{width:100%;height:100%;display:block}
.pb-live>*:not(.pb-scene){position:relative;z-index:1}
.pb-hud{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"stat left tools" "balls balls balls";align-items:center;gap:4px 8px;margin-bottom:4px}
.pb-stat{grid-area:stat;z-index:2;min-width:92px;background:linear-gradient(#4c1d95,#1e1b4b);color:#fff;border:3px solid #fbbf24;border-radius:14px;padding:4px 8px;box-shadow:0 3px 0 #b45309;font-weight:900;line-height:1.25}
.pb-stat div{display:flex;align-items:center;gap:4px}
.pb-calls{display:contents}
.pb-left{grid-area:left;color:#fff;font-weight:900;text-shadow:0 2px 0 #0369a1;font-size:.95rem;text-align:center}
.pb-tools{grid-area:tools}
.pb-last{grid-area:balls;display:flex;gap:6px;justify-content:center;align-items:center;min-height:68px;padding:6px 0 2px;overflow:hidden}
.pb-orb{width:46px;height:46px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;line-height:.9;text-shadow:0 1px 0 rgba(0,0,0,.25);box-shadow:inset -4px -5px 0 rgba(0,0,0,.16),0 3px 0 rgba(0,0,0,.18);flex:none;position:relative}
.pb-orb small{font-size:10px;line-height:1}
.pb-orb.now{width:58px;height:58px;font-size:18px;box-shadow:inset -4px -5px 0 rgba(0,0,0,.16),0 3px 0 rgba(0,0,0,.18)}
.pb-orb.now::after{content:"";position:absolute;inset:-6px;border-radius:50%;background:conic-gradient(from -90deg,#fff var(--pb-wait,100%),rgba(255,255,255,.28) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));pointer-events:none}
.pb-orb.cB{background:radial-gradient(circle at 32% 28%,#fff,#fb7185 42%,#be123c)}
.pb-orb.cI{background:radial-gradient(circle at 32% 28%,#fff,#d8b4fe 42%,#7e22ce)}
.pb-orb.cN{background:radial-gradient(circle at 32% 28%,#fff,#67e8f9 42%,#0e7490)}
.pb-orb.cG{background:radial-gradient(circle at 32% 28%,#fff,#86efac 42%,#15803d)}
.pb-orb.cO{background:radial-gradient(circle at 32% 28%,#fff,#fdba74 42%,#c2410c)}
.pb-tools{display:flex;gap:6px;align-items:center;flex:none}
.pb-live .pb-round,.pb-live #k-rot.in-tools{width:44px;height:44px;min-width:44px;border-radius:50%;border:3px solid #fff;background:#7c3aed;color:#fff;font:900 18px/1 Inter,system-ui,sans-serif;box-shadow:0 3px 0 #5b21b6;padding:0;display:grid;place-items:center}
.pb-stage{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}
.pb-main{min-width:0}
.pb-live .pb-meta{color:#0f172a;background:rgba(255,255,255,.82);border-radius:12px;padding:4px 8px;font-size:.82rem;align-items:center}
.pb-opts{margin-left:auto;font-size:.75rem}
.pb-opts summary{font-weight:800;cursor:pointer;list-style:none;min-height:32px;display:inline-flex;align-items:center}
.pb-opts summary::-webkit-details-marker{display:none}
.pb-opts .pb-auto{display:flex;margin-top:4px}
.pb-live .pb-cards{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px}
.pb-live .pb-card{flex:0 0 min(100%,440px);scroll-snap-align:center;border:4px solid #fbbf24;border-radius:18px;padding:6px 6px 8px;box-shadow:0 6px 0 #d97706;background:#fff;min-width:0}
.pb-live .pb-card.one{box-shadow:0 0 0 3px #fff,0 0 0 6px #fde047,0 6px 0 #d97706}
.pb-live .pb-card.win{box-shadow:0 0 0 3px #fff,0 0 0 6px #7c3aed,0 6px 0 #5b21b6}
.pb-head{display:grid;grid-template-columns:repeat(5,1fr);text-align:center;font-weight:900;font-size:clamp(18px,4.2vw,28px);line-height:1.1;margin-bottom:2px}
.pb-head span:nth-child(1){color:#e11d48}.pb-head span:nth-child(2){color:#9333ea}.pb-head span:nth-child(3){color:#0891b2}.pb-head span:nth-child(4){color:#16a34a}.pb-head span:nth-child(5){color:#ea580c}
.pb-grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:3px}
.pb-live .pb-cell{width:100%;min-height:44px;aspect-ratio:1;font-size:clamp(16px,4vw,24px);font-weight:900;color:#1e293b;background:var(--paper,#fff)}
.pb-card.wash0{--wash:#fbcfe8;--paper:#fff7fb}.pb-card.wash1{--wash:#a7f3d0;--paper:#f0fdf4}.pb-card.wash2{--wash:#bfdbfe;--paper:#f8fbff}.pb-card.wash3{--wash:#fde68a;--paper:#fffbeb}
.pb-grid5 .pb-cell:nth-child(10n+1),.pb-grid5 .pb-cell:nth-child(10n+3),.pb-grid5 .pb-cell:nth-child(10n+5),.pb-grid5 .pb-cell:nth-child(10n+7),.pb-grid5 .pb-cell:nth-child(10n+9){background:var(--wash)}
.pb-grid5 .pb-cell:nth-child(5n+1){--stamp:#fb7185;--stamp2:#be123c}
.pb-grid5 .pb-cell:nth-child(5n+2){--stamp:#d8b4fe;--stamp2:#7e22ce}
.pb-grid5 .pb-cell:nth-child(5n+3){--stamp:#67e8f9;--stamp2:#0e7490}
.pb-grid5 .pb-cell:nth-child(5n+4){--stamp:#86efac;--stamp2:#15803d}
.pb-grid5 .pb-cell:nth-child(5n+5){--stamp:#fdba74;--stamp2:#c2410c}
.pb-live .pb-cell.got::before{content:'';position:absolute;inset:3px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0,var(--stamp) 46%,var(--stamp2));box-shadow:inset 0 -3px 0 rgba(0,0,0,.16)}
.pb-live .pb-cell.free::before,.pb-live .pb-cell.star::before{background:radial-gradient(circle at 32% 28%,#fff,#fde047 42%,#f59e0b)}
.pb-live .pb-cell span{position:relative;z-index:1}
.pb-cell.pb-shake{animation:pbShake .32s ease}
.pb-live .pb-cell.free span{color:#b45309;font-size:1.3em}
.pb-boardwrap{background:#1e1b4b;border-radius:16px;border:3px solid #312e81;padding:6px;max-height:220px;overflow:auto}
.pb-live .pb-board{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin:0;font-size:11px}
.pb-col{display:flex;flex-direction:column;gap:1px;text-align:center;font-weight:800}
.pb-col h3{margin:0 0 2px;font-size:15px;color:var(--c,#fff)}
.pb-col i{font-style:normal;color:#94a3b8;border-radius:4px;min-height:14px}
.pb-col i.on{color:#1e1b4b;background:var(--c);font-weight:900}
.pb-col.cB{--c:#fb7185}.pb-col.cI{--c:#d8b4fe}.pb-col.cN{--c:#67e8f9}.pb-col.cG{--c:#86efac}.pb-col.cO{--c:#fdba74}
.pb-names{font-weight:800;font-size:.8rem;color:#14532d;min-height:1em;text-shadow:0 1px 0 rgba(255,255,255,.6)}
.pb-extra{display:flex;flex-wrap:nowrap;gap:6px;align-items:center;overflow-x:auto}
.pb-chat{flex-wrap:nowrap}
.pb-auto{font-weight:800;font-size:.85rem;background:rgba(255,255,255,.88);border-radius:999px;padding:4px 8px}
.pb-peek{margin:0;font-weight:800;background:#fff6d8;border-radius:10px;padding:6px 8px}
.pb-dock{flex:none;z-index:4;display:flex;gap:8px;align-items:center;padding:6px;border-radius:16px;background:rgba(240,253,244,.94)}
body:has(.pb-live) .toast{bottom:168px}
.pb-dock .pb-powers{flex:1;min-width:0}
.pb-dock .pb-powers button,.pb-dock .pb-powers span{background:#fff;border-radius:12px;padding:8px 10px;font-weight:800}
.pb-dock [data-bingo]{flex:1.4;min-height:56px;border:0;border-radius:16px;background:linear-gradient(#fde047,#f59e0b);color:#7c2d12;font-weight:900;font-size:26px;letter-spacing:.04em;box-shadow:0 5px 0 #b45309}
.pb-dock [data-bingo]:disabled{opacity:.55}
.pb-floats{font-weight:800;min-height:1em}
.pb-live>.pb-callout,.pb-live>.pb-ready{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:5;display:grid;place-items:center;text-align:center;pointer-events:none}
.pb-live>.pb-callout[hidden],.pb-live>.pb-ready[hidden]{display:none}
.pb-callout *,.pb-ready *{pointer-events:none}
.pb-live>.pb-win{position:fixed;z-index:80}
.pb-callout[hidden],.pb-ready[hidden]{display:none}
.pb-callout .pb-orb{width:112px;height:112px;font-size:40px}
.pb-callout .pb-orb small{font-size:18px}
.pb-callout .pb-orb::after{display:none}
.pb-ready b{font-size:72px;line-height:.9;color:#fff;text-shadow:0 4px 0 #0369a1}
.pb-ready span{font-weight:900;color:#fff;text-shadow:0 2px 0 #0369a1}
@media (orientation:landscape){
  .pb-hud{grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-areas:"stat left balls tools"}
  .pb-left{text-align:left;white-space:nowrap}
  .pb-last{min-height:52px;padding:0}
  .pb-live .pb-stage{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,210px);align-items:stretch;overflow:hidden}
  .pb-live .pb-main{min-height:0;overflow:auto;display:flex;flex-direction:column}
  .pb-live .pb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));overflow:visible;scroll-snap-type:none}
  .pb-live .pb-card{flex:none;width:auto}
  .pb-boardwrap{max-height:none;height:100%;overflow:auto}
}
@media (orientation:landscape) and (max-height:520px){
  .pb-live{gap:4px;padding:4px max(4px,env(safe-area-inset-right)) 4px max(4px,env(safe-area-inset-left))}
  .pb-hud{margin-bottom:0}
  .pb-orb{width:36px;height:36px;font-size:12px}
  .pb-orb.now{width:44px;height:44px;font-size:14px}
  .pb-last{min-height:48px}
  .pb-live .pb-meta{padding:2px 6px;font-size:.72rem}
  .pb-live .pb-cell{min-height:0;aspect-ratio:auto;height:clamp(22px,7.4dvh,36px);font-size:14px}
  .pb-head{font-size:16px;margin-bottom:0}
  .pb-chat button{padding:4px 8px}
  .pb-dock{padding:4px}
  .pb-dock [data-bingo]{min-height:44px;font-size:22px}
  .pb-boardwrap{max-height:none}
}
.pb-win{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(28,14,58,.42);pointer-events:none}
.pb-win[hidden]{display:none}.pb-win b{font-size:64px;color:#ffd34d;text-shadow:0 6px 0 #7a4fd0;animation:pbPop .35s ease-out}
.pb-win p{margin:0;text-align:center;font-weight:800;color:#fff;text-shadow:0 2px 0 #2b1d55}
.pb-win span{position:absolute;font-size:22px;animation:pbFly 1s ease-out forwards}
.pb-break{background:#e8fff1;border-radius:12px;padding:8px 10px}
@keyframes pbStamp{from{transform:scale(1.4) rotate(-8deg)}to{transform:none}}@keyframes pbPop{from{transform:scale(.4)}to{transform:none}}
@keyframes pbFly{to{transform:translateY(-80px);opacity:0}}
@keyframes pbShake{0%,100%{transform:none}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
@keyframes pbIn{from{transform:translate(-50%,-50%) scale(.5)}to{transform:translate(-50%,-50%) scale(1)}}
.pb-callout,.pb-ready{animation:pbIn .28s ease-out}
@media (orientation:landscape) and (max-height:520px){.pb-hero{height:120px}}
.pb-ban{position:fixed;left:50%;top:max(70px,10vh);transform:translateX(-50%);z-index:86;display:flex;align-items:center;gap:14px;padding:12px 18px 12px 14px;border-radius:22px;background:linear-gradient(135deg,#7a4fd0,#3fa9ff);color:#fff;box-shadow:0 10px 28px rgba(43,29,85,.35),inset 0 0 0 3px rgba(255,255,255,.35);pointer-events:none;animation:pbBan 3s ease-in-out forwards;max-width:calc(100vw - 24px)}
.pb-ban small{display:block;font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.9}
.pb-ban b{display:block;font-size:clamp(26px,7.5vw,40px);line-height:1;font-weight:900;text-shadow:0 3px 0 rgba(43,29,85,.45);white-space:nowrap}
.pb-mini{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;width:78px;height:78px;flex:none;padding:5px;border-radius:12px;background:#fff}
.pb-mini i{border-radius:3px;background:#e9e1fb}.pb-mini i.on{background:#ff7ab8;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18)}
@keyframes pbBan{0%{opacity:0;transform:translate(-50%,-30px) scale(.8)}10%{opacity:1;transform:translate(-50%,0) scale(1.04)}16%{transform:translate(-50%,0) scale(1)}88%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-14px)}}
@media (prefers-reduced-motion:reduce){.pb-cell.got,.pb-win b,.pb-orb.now,.pb-cell.pb-shake,.pb-callout,.pb-ready{animation:none}.pb-ban{animation:pbBanCalm 3s step-end forwards}}
@keyframes pbBanCalm{100%{opacity:0}}
.pb-pick{position:fixed;inset:0;z-index:110;display:grid;place-items:center;background:rgba(28,14,58,.55);padding:12px}
.pb-pickc{width:min(460px,100%);max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#2b1d55;border-radius:22px;padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.35)}
.pb-pickc h2{margin:0 0 2px}.pb-picks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
.pb-picks button{display:flex;align-items:center;gap:8px;text-align:left;border:3px solid #e9e1fb;border-radius:16px;background:#faf7ff;padding:8px;font:800 14px Inter,system-ui,sans-serif;color:#2b1d55;cursor:pointer}
.pb-picks button.on{border-color:#7a4fd0;background:#efe6ff}.pb-picks .pb-mini{width:46px;height:46px;padding:3px;gap:2px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px #e9e1fb}
.pb-picks button:first-child{grid-column:1/-1}
.pb-shelf{font-size:22px;letter-spacing:2px}`;

const SCENE = `<svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="pbSkyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#bae6fd"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient><linearGradient id="pbGrassG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#15803d"/></linearGradient></defs><rect width="800" height="480" fill="url(#pbSkyG)"/><circle cx="110" cy="68" r="34" fill="#fde047"/><circle cx="98" cy="56" r="10" fill="#fffbeb" opacity=".85"/><ellipse cx="250" cy="78" rx="48" ry="16" fill="#fff"/><ellipse cx="286" cy="70" rx="30" ry="14" fill="#fff"/><ellipse cx="560" cy="96" rx="54" ry="16" fill="#fff" opacity=".95"/><ellipse cx="400" cy="440" rx="480" ry="130" fill="url(#pbGrassG)"/><path d="M20 392c90-34 130 28 210 4s130-40 210 6 150-28 220 8" fill="none" stroke="#38bdf8" stroke-width="18" stroke-linecap="round"/><path d="M20 392c90-34 130 28 210 4s130-40 210 6 150-28 220 8" fill="none" stroke="#e0f2fe" stroke-width="6" stroke-linecap="round"/><g><rect x="64" y="248" width="16" height="72" rx="4" fill="#92400e"/><polygon points="72,146 14,268 130,268" fill="#166534"/><polygon points="72,188 32,268 112,268" fill="#4ade80"/></g><g><rect x="700" y="228" width="18" height="84" rx="4" fill="#92400e"/><polygon points="709,118 640,248 778,248" fill="#14532d"/><polygon points="709,168 662,248 756,248" fill="#22c55e"/></g><g fill="#fbcfe8"><circle cx="190" cy="404" r="7"/><circle cx="178" cy="412" r="5"/><circle cx="202" cy="412" r="5"/></g><circle cx="190" cy="404" r="2.5" fill="#f59e0b"/><g fill="#fde68a"><circle cx="360" cy="424" r="6"/><circle cx="350" cy="432" r="4"/><circle cx="370" cy="432" r="4"/></g><circle cx="360" cy="424" r="2" fill="#ea580c"/><g fill="#fff"><circle cx="630" cy="412" r="6"/><circle cx="620" cy="420" r="4"/><circle cx="640" cy="420" r="4"/></g><circle cx="630" cy="412" r="2" fill="#f59e0b"/></svg>`;

const PHRASES = ['👋', '😄', '🎉', '⭐', 'Nice!', 'Good luck!'];
const DAUBERS = [{ id: 'ink', name: 'Ink', lv: 1, c: '#6b4fd6' }, { id: 'star', name: 'Star', lv: 2, c: '#e7a318' }, { id: 'heart', name: 'Heart', lv: 3, c: '#ff6fae' }, { id: 'crown', name: 'Crown', lv: 5, c: '#3aa0e0' }];
const THEMES = [{ id: 'cozy', name: 'Cozy', lv: 1 }, { id: 'meadow', name: 'Meadow', lv: 2 }, { id: 'night', name: 'Night', lv: 4 }, { id: 'lucky', name: 'Lucky', lv: 6 }];
const POWNAME = { free: 'Free daub', double: 'Double stars', peek: 'Peek next' };
const FRESH = 25000;

function css() { if (document.getElementById('pb-css')) return; const s = document.createElement('style'); s.id = 'pb-css'; s.textContent = CSS; document.head.appendChild(s); }
const gameLabel = (p) => (p === 'mix' ? 'Mix' : p === 'line' ? 'Normal bingo' : PATTERN_NAME[p] || 'Bingo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let audio = null;
let saidReady = -1, saidBall = -1, saidCount = '', calloutUntil = 0, voicePick = null;
function hookVoices() {
  const s = window.speechSynthesis;
  if (!s || hookVoices.done) return;
  hookVoices.done = 1;
  // Fallback only (the caller normally plays recorded clips). Prefer the nicest English voice the phone has.
  const pick = () => {
    let list = [];
    try { list = s.getVoices() || []; } catch { list = []; }
    const en = list.filter((v) => /^en/i.test(v.lang));
    const score = (v) => (/premium/i.test(v.name) ? 60 : 0) + (/enhanced/i.test(v.name) ? 50 : 0) + (/natural|neural/i.test(v.name) ? 45 : 0)
      + (/samantha|ava|allison|susan|zoe|karen|serena|google us|aria|jenny|zira/i.test(v.name) ? 20 : 0) + (/^en(-|_)?US/i.test(v.lang) ? 8 : 0)
      + (v.localService ? 2 : 0) - (/compact|eloquence|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|albert|jester|organ|superstar|wobble/i.test(v.name) ? 80 : 0);
    voicePick = en.sort((a, b) => score(b) - score(a))[0] || null;
  };
  try { s.addEventListener('voiceschanged', pick); } catch { /* old webkit */ }
  pick();
}
// Recorded caller clips (assets/audio/bingo, made offline with Piper TTS). Fetched only once a bingo game starts.
const CLIP_DIR = 'assets/audio/bingo/';
const clipBuf = new Map(), clipLoad = new Map();
let clipSrc = null, clipQ = [], clipEpoch = 0;
const clipVol = () => { try { return Math.max(0, Math.min(1, masterVol() * sfxVol())); } catch { return 1; } };
function actx() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  return audio;
}
function loadClip(name) {
  if (clipLoad.has(name)) return clipLoad.get(name);
  const c = actx();
  const pr = !c || !window.fetch ? Promise.resolve(null) : fetch(CLIP_DIR + name + '.mp3')
    .then((r) => { if (!r.ok) throw new Error('clip ' + r.status); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => { const q = c.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); }))
    .then((buf) => { clipBuf.set(name, buf); return buf; })
    .catch(() => { clipLoad.delete(name); clipBuf.delete(name); return null; });
  clipLoad.set(name, pr);
  return pr;
}
function preloadClips() {
  if (preloadClips.done) return; preloadClips.done = 1;
  const names = ['get-ready', '3', '2', '1', 'bingo', 'winner'];
  for (let n = 1; n <= 75; n++) names.push('bingo'[Math.floor((n - 1) / 15)] + n);
  let i = 0;
  const next = () => { if (i < names.length) loadClip(names[i++]).then(next); };
  for (let k = 0; k < 4; k++) next(); // a few at a time so the game stays snappy
}
function stopClip() { clipQ = []; clipEpoch++; try { clipSrc && clipSrc.stop(); } catch { /* already done */ } clipSrc = null; }
function playClips(names, fallback) {
  if (sfx.muted) return;
  const c = actx(), v = clipVol();
  if (v <= 0) return;
  if (!c || names.some((n) => !clipBuf.has(n))) { names.forEach(loadClip); sayParts(fallback); return; }
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ }
  stopClip();
  clipQ = names.slice();
  const ep = clipEpoch;
  const step = () => {
    if (ep !== clipEpoch || sfx.muted) return;
    const n = clipQ.shift(); if (!n) { clipSrc = null; return; }
    try {
      if (c.state === 'suspended') c.resume();
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = clipBuf.get(n); g.gain.value = v; src.connect(g).connect(c.destination);
      src.onended = () => setTimeout(step, 120);
      clipSrc = src; src.start();
    } catch { sayParts(fallback); }
  };
  step();
}
function unlockVoice() {
  // iOS: wake WebAudio inside the Play tap so recorded calls can play later, then start fetching the clips.
  const c = actx();
  if (c) {
    try {
      if (c.state === 'suspended') c.resume();
      const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0);
    } catch { /* ignore */ }
  }
  preloadClips();
  const s = window.speechSynthesis;
  if (!s || !window.SpeechSynthesisUtterance) return;
  hookVoices();
  try {
    s.resume();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0.01; u.rate = 1; u.lang = 'en-US';
    s.speak(u);
  } catch { /* speech isn't available here */ }
}
function sayParts(parts) {
  const s = window.speechSynthesis;
  if (sfx.muted || !s || !window.SpeechSynthesisUtterance) return;
  hookVoices();
  try {
    s.cancel();
    parts.forEach((text) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9; u.pitch = 1.05; u.lang = (voicePick && voicePick.lang) || 'en-US';
      if (voicePick) u.voice = voicePick;
      s.speak(u);
    });
  } catch { /* skip the caller if the browser refuses */ }
}
function hush() { stopClip(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { /* ignore */ } }
function chirp() {
  if (sfx.muted) return;
  try {
    audio = actx(); if (!audio) return;
    const t = audio.currentTime;
    [494, 740].forEach((f, i) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.07, t + i * 0.07 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.18); o.connect(g).connect(audio.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2); });
  } catch { /* no audio */ }
}

export function openBingo(ctx, q = {}) {
  if (!ctx.requireAuth()) return;
  css();
  const { main, db, toast, friendlyError } = ctx;
  const uid = ctx.S.user.uid;
  const prof = ctx.S.profile || {};
  const myName = String(prof.displayName || 'Pal').slice(0, 50);
  const myCol = String(prof.color || '#b26bff').slice(0, 20);
  const fast = q.fast === '1';
  const SK = 'kemy-bingo-v1-' + uid;
  let prog = {}; try { prog = JSON.parse(localStorage.getItem(SK) || '{}'); } catch { prog = {}; }
  prog = { xp: 0, daubs: 0, days: 0, day: '', gift: '', powers: [], dauber: 'ink', theme: 'cozy', auto: false, autoOff: 0, cards: 1, stickers: { b: [], p: [] }, ch: null, ...prog };
  if (!prog.stickers) prog.stickers = { b: [], p: [] };
  const persist = () => { try { localStorage.setItem(SK, JSON.stringify(prog)); } catch { /* full */ } };
  if (!prog.autoOff) { prog.auto = false; prog.autoOff = 1; persist(); }
  const lv = () => levelOf(prog.xp);
  const slots = () => cardSlots(lv());
  let econ = null;
  async function prize(n, why) {
    try {
      if (!econ) { const { createEconomy } = await import('../pals/economy.js'); econ = createEconomy(db, uid); }
      const g = await econ.earn('win', Math.max(1, Math.min(25, n | 0)));
      if (g) toast(`+${g} ⭐ ${why}`);
      else if (!prize.capped) { prize.capped = 1; toast('Today’s prize stars are full. You can keep playing just for fun.'); }
      return g || 0;
    } catch (e) { console.warn('bingo prize', e); return 0; }
  }
  const today = dayKey();
  let gifted = false;
  if (prog.day !== today) {
    prog.days = (prog.days | 0) + 1; prog.day = today; prog.gift = today;
    prog.ch = { day: today, daub: 0, rounds: 0, wins: 0, got: {} }; persist(); gifted = true;
  }
  const ch = () => { if (!prog.ch || prog.ch.day !== today) prog.ch = { day: today, daub: 0, rounds: 0, wins: 0, got: {} }; return prog.ch; };
  const session0 = Date.now(); let broke = false;
  let dead = false, mode = 'lobby', roomId = '', room = null, seats = [], unsubR = null, unsubS = null, hb = 0;
  let claim = 0, emo = 0, lastSeat = 0, seatQ = Promise.resolve();
  let daubed = new Set(), frees = new Map(), paidRound = -1, peekUntil = 0, doubleOn = false, missUntil = 0, winUntil = 0, winText = '';
  let seenBall = -1, tickN = 0, drum = 0, botShown = -1, lastRound = -1, botCache = { key: '', plan: null }, ge = null, seenEmo = new Map();
  const arm = () => { if (!dead) watchGameRotate(); };

  function grantCh() {
    const c = ch(), goals = { daub: ['Daub 50 numbers', 50], wins: ['Win 1 round', 1], rounds: ['Play 2 rounds', 2] };
    for (const [k, [label, goal]] of Object.entries(goals)) {
      if ((c[k] || 0) >= goal && !c.got[k]) { c.got[k] = 1; prog.xp += 10; persist(); prize(8, 'for “' + label + '”'); toast('Challenge complete: ' + label); }
    }
  }
  function addDaubs(n) {
    const prev = Math.floor(prog.daubs / 12); prog.daubs += n; prog.xp += n; const next = Math.floor(prog.daubs / 12);
    if (next > prev && prog.powers.length < 3) { const id = ['free', 'double', 'peek'][(next - 1) % 3]; prog.powers.push(id); toast('Power-up earned: ' + POWNAME[id]); }
    ch().daub += n; persist(); grantCh();
  }
  function stickerBall(n) { if (!LUCKY_BALLS.includes(n) || prog.stickers.b.includes(n)) return; prog.stickers.b.push(n); persist(); toast('Sticker: ball ' + n); }
  function stickerPat(id) { if (prog.stickers.p.includes(id)) return; prog.stickers.p.push(id); persist(); }

  function clock() {
    if (!room || !room.start || !room.start.toMillis) return null;
    return roundAt(room.start.toMillis(), Date.now(), fast);
  }
  function writeSeat(extra) {
    if (!roomId || dead) return seatQ;
    const body = { name: myName, col: myCol, n: Math.min(slots(), Math.max(1, prog.cards | 0)), claim, emo, at: serverTimestamp(), ...extra };
    if (extra && 'claim' in extra) claim = extra.claim;
    if (extra && 'emo' in extra) emo = extra.emo;
    seatQ = seatQ.then(async () => {
      const wait = 2200 - (Date.now() - lastSeat); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (dead || !roomId) return;
      await setDoc(doc(db, 'bingoRooms', roomId, 'seats', uid), { name: myName, col: myCol, n: body.n, claim, emo, at: serverTimestamp() });
      lastSeat = Date.now();
    }).catch((e) => console.warn('bingo seat', e && e.code));
    return seatQ;
  }
  function dropSeat() {
    clearInterval(hb); hb = 0; if (unsubR) unsubR(); if (unsubS) unsubS(); unsubR = unsubS = null;
    const id = roomId; roomId = ''; room = null; seats = [];
    if (id) deleteDoc(doc(db, 'bingoRooms', id, 'seats', uid)).catch(() => {});
  }
  async function ensure(id, pub, pick) {
    const ref = doc(db, 'bingoRooms', id);
    const s = await getDoc(ref); if (s.exists()) return;
    const seed = pub ? 1 + Math.floor(Math.random() * 1e9) : pickSeed(Math.random() * 1999000, pick || 'line');
    try { await setDoc(ref, { host: uid, code: id, pub: !!pub, seed, start: serverTimestamp() }); }
    catch (e) { const again = await getDoc(ref); if (!again.exists()) throw e; }
  }
  async function freshCount(id) {
    try {
      const s = await getDocs(collection(db, 'bingoRooms', id, 'seats')); const now = Date.now();
      return s.docs.filter((d) => { const at = d.data().at; return at && at.toMillis && now - at.toMillis() < FRESH; }).length;
    } catch { return 0; }
  }
  function listen(id) {
    preloadClips();
    dropSeat(); roomId = id; mode = 'hall'; daubed = new Set(); frees = new Map(); seenBall = -1; botShown = -1; claim = 0; emo = 0;
    paintHall();
    unsubR = onSnapshot(doc(db, 'bingoRooms', id), (s) => { room = s.exists() ? s.data() : null; });
    unsubS = onSnapshot(collection(db, 'bingoRooms', id, 'seats'), (s) => {
      const now = Date.now();
      seats = s.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at && d.data().at.toMillis ? d.data().at.toMillis() : 0 })).filter((x) => now - x.at < FRESH || x.id === uid);
      seats.forEach((x) => { if (!seenEmo.has(x.id)) { seenEmo.set(x.id, x.emo || 0); return; } if (seenEmo.get(x.id) === (x.emo || 0) || x.id === uid) return; seenEmo.set(x.id, x.emo || 0); onEmo(x); });
    });
    writeSeat({});
    hb = setInterval(() => writeSeat({}), 8000);
  }
  function onEmo(x) {
    const host = main.querySelector('.pb-floats'); if (!host) return;
    if (x.emo >= 100) { ge && ge.recv(x.id, x.emo, x.name); return; }
    const el = document.createElement('b'); el.textContent = (PHRASES[(x.emo || 1) - 1] || '⭐') + ' ' + x.name; host.appendChild(el); setTimeout(() => el.remove(), 2400);
  }
  async function joinPublic() {
    unlockVoice();
    try {
      for (const id of ['hall', 'hall2', 'hall3']) {
        await ensure(id, true);
        if (await freshCount(id) < 20) { listen(id); return; }
      }
      toast('Public halls are full. Try a private room with friends.');
    } catch (e) { console.warn('bingo room', e && (e.code || e.message)); toast(friendlyError ? friendlyError(e) : 'Could not open the hall'); }
  }
  function pickGame() {
    document.querySelectorAll('.pb-pick').forEach((e) => e.remove());
    const box = document.createElement('div'); box.className = 'pb-pick'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Pick a game');
    const mini = (id) => { const m = id === 'mix' ? null : id === 'line' ? masksFor('line')[2] : masksFor(id)[0]; return `<span class="pb-mini" aria-hidden="true">${Array.from({ length: 25 }, (_, i) => `<i class="${m ? (m[i] ? 'on' : '') : (i % 6 === 0 || i % 4 === 0 && i % 24 ? 'on' : '')}"></i>`).join('')}</span>`; };
    box.innerHTML = `<div class="pb-pickc"><h2>Pick a game</h2><p class="pb-note">Everyone in your room plays this every round.</p><div class="pb-picks">${PICK_IDS.map((id, i) => `<button type="button" class="${i ? '' : 'on'}" data-pick="${id}">${mini(id)}<b>${esc(PICK_NAME[id])}</b></button>`).join('')}</div><div class="pb-row"><button type="button" class="alt" data-pk="x">Cancel</button><button type="button" data-pk="go">Make room</button></div></div>`;
    let pick = 'line'; document.body.appendChild(box);
    box.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => { pick = b.dataset.pick; box.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('on', x === b)); });
    box.querySelector('[data-pk=x]').onclick = () => box.remove();
    box.querySelector('[data-pk=go]').onclick = () => { box.remove(); makePrivate(pick); };
  }
  async function makePrivate(pick) {
    unlockVoice();
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id = '';
    for (let i = 0; i < 5; i++) id += A[Math.floor(Math.random() * A.length)];
    try { await ensure(id, false, pick); listen(id); toast('Room code ' + id + ' · ' + gameLabel(pick || 'line')); } catch (e) { toast(friendlyError ? friendlyError(e) : 'Could not make a room'); }
  }
  async function joinCode(raw) {
    unlockVoice();
    const id = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (id.length < 4) { toast('Codes look like ABCDE'); return; }
    const s = await getDoc(doc(db, 'bingoRooms', id));
    if (!s.exists() || s.data().pub) { toast('No private room with that code'); return; }
    listen(id);
  }

  function roster() {
    const humans = seats.filter((s) => s.id === uid || Date.now() - s.at < FRESH);
    const me = humans.find((s) => s.id === uid) || { id: uid, name: myName };
    const others = humans.filter((s) => s.id !== uid).slice(0, 9);
    const bots = humans.length >= 6 ? [] : BOTS.slice(0, Math.min(6, 6 - humans.length));
    return [me, ...others, ...bots].slice(0, 10);
  }
  function paintLobby() {
    mode = 'lobby'; const slotsN = slots(), lvN = lv();
    const c = ch();
    const goals = [['daub', 'Daub 50 numbers', 50], ['wins', 'Win 1 round', 1], ['rounds', 'Play 2 rounds', 2]];
    main.innerHTML = `<section class="pb theme-${esc(prog.theme)}" style="--daub:${esc((DAUBERS.find((d) => d.id === prog.dauber) || DAUBERS[0]).c)}">
      <div class="pb-top"><a href="#/arcade" aria-label="Back to arcade">←</a><h1>Pal Bingo ⭐<small>Cozy 75-ball rooms</small></h1><div data-k-rot></div><button class="pb-ico" type="button" data-mute aria-label="Sound">${sfx.muted ? '🔇' : '🔊'}</button></div>
      <div class="pb-hero pb-banner" aria-hidden="true">${SCENE}</div>
      <p class="pb-note">⭐ Stars are prizes for playing, with a daily cap. No shop, no bets, no real money.</p>
      ${gifted ? '<p class="pb-note">Welcome in. Here’s a small prize for showing up today — missing a day never takes anything away.</p>' : ''}
      <div class="pb-box"><b>Level ${lvN}</b> · Play days ${prog.days | 0}<div class="pb-xp"><i style="width:${(prog.xp % 30) / 30 * 100}%"></i></div></div>
      <div class="pb-row"><button type="button" data-pub>Join a public hall</button><button type="button" data-priv>Private room</button></div>
      <form class="pb-row" data-code><input aria-label="Room code" maxlength="5" placeholder="Friend code" autocapitalize="characters" autocomplete="off" style="border-radius:12px;border:0;padding:10px;font-weight:800;width:8rem"><button class="alt" type="submit">Join</button></form>
      <div class="pb-grid">
        <div class="pb-box"><h2>Cards</h2><div class="pb-row">${[1, 2, 3, 4].map((n) => `<button type="button" class="${n === Math.min(prog.cards, slotsN) ? '' : 'alt'} ${n > slotsN ? 'pb-lock' : ''}" data-cards="${n}">${n}${n > slotsN ? ' 🔒' : ''}</button>`).join('')}</div><p class="pb-note">More cards unlock as you play. Never for sale.</p></div>
        <div class="pb-box"><h2>Dauber &amp; card</h2><div class="pb-row">${DAUBERS.map((d) => `<button type="button" class="${prog.dauber === d.id ? '' : 'alt'} ${lvN < d.lv ? 'pb-lock' : ''}" data-daub="${d.id}" ${lvN < d.lv ? 'disabled' : ''}>${esc(d.name)}</button>`).join('')}</div><div class="pb-row">${THEMES.map((t) => `<button type="button" class="${prog.theme === t.id ? '' : 'alt'} ${lvN < t.lv ? 'pb-lock' : ''}" data-theme="${t.id}" ${lvN < t.lv ? 'disabled' : ''}>${esc(t.name)}</button>`).join('')}</div></div>
      </div>
      <div class="pb-box"><h2>Today’s challenges</h2><ul>${goals.map(([k, label, goal]) => `<li>${c.got && c.got[k] ? '✅' : '▫️'} ${esc(label)} (${Math.min(goal, c[k] || 0)}/${goal})</li>`).join('')}</ul><p class="pb-note">A new set each day you visit. Skipping a day just starts fresh.</p></div>
      <details class="pb-box"><summary><b>Sticker book</b></summary><p>Balls: ${LUCKY_BALLS.map((n) => prog.stickers.b.includes(n) ? n : '·').join(' ')}</p><p>Patterns: ${['line', 'corners', 'x', 'heart', 'star', 'crown', 'blackout'].map((id) => prog.stickers.p.includes(id) ? PATTERN_NAME[id] : '·').join(' · ')}</p></details>
      <div class="pb-box"><h2>Trophy shelf</h2>${(() => { const t = prog.trophies || {}; const n = (t.g | 0) + (t.s | 0) + (t.b | 0); return n ? `<p class="pb-shelf">🥇 ${t.g | 0} · 🥈 ${t.s | 0} · 🥉 ${t.b | 0}</p>` : '<p class="pb-note">Win a round to earn your first trophy. Faster wins earn gold!</p>'; })()}</div>
      <div class="pb-box"><h2>This week</h2><div data-week>Loading…</div><p><a href="#/scores/bingo?tab=week">Full weekly board</a></p></div>
      <p class="pb-note">Each ball waits a few seconds so you can find it and tap it. Power-ups (free daub, double stars, peek) are earned by playing, not bought. Chat is quick phrases and emotes only.</p>
      <div class="pb-break" data-break hidden>You’ve been playing a while. A break is nice too — come back whenever you like.</div>
    </section>`;
    main.querySelector('[data-mute]').onclick = () => { sfx.muted = !sfx.muted; paintLobby(); };
    main.querySelector('[data-pub]').onclick = () => joinPublic();
    main.querySelector('[data-priv]').onclick = () => pickGame();
    main.querySelector('[data-code]').onsubmit = (e) => { e.preventDefault(); joinCode(e.target.querySelector('input').value); };
    main.querySelectorAll('[data-cards]').forEach((b) => b.onclick = () => { const n = +b.dataset.cards; if (n > slots()) { toast('Play a little more to unlock another card'); return; } prog.cards = n; persist(); paintLobby(); });
    main.querySelectorAll('[data-daub]').forEach((b) => b.onclick = () => { prog.dauber = b.dataset.daub; persist(); paintLobby(); });
    main.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { prog.theme = b.dataset.theme; persist(); paintLobby(); });
    if (gifted) prize(5, 'for visiting today');
    gifted = false;
    weekBoard(); arm(); breakNote();
  }
  async function weekBoard() {
    const el = main.querySelector('[data-week]'); if (!el) return;
    try {
      const s = await getDocs(query(collection(db, 'leaderboard'), where('game', '==', 'bingo'), where('wk', '==', weekId()), orderBy('wkScore', 'desc'), limit(5)));
      const rows = s.docs.map((d) => d.data());
      el.innerHTML = rows.length ? `<ol>${rows.map((r) => `<li>${esc(r.name)} · ${r.wkScore | 0} pts</li>`).join('')}</ol>` : '<p>No wins yet this week. Yours could be first.</p>';
    } catch { if (el) el.textContent = 'The weekly board will show wins once a few rounds are in.'; }
  }
  function roomPeople() {
    const humans = seats.filter((s) => s.id === uid || Date.now() - s.at < FRESH);
    if (!humans.some((s) => s.id === uid)) humans.unshift({ id: uid, name: myName });
    return humans.slice(0, 10);
  }
  function paintHall() {
    const dcol = (DAUBERS.find((d) => d.id === prog.dauber) || DAUBERS[0]).c;
    main.innerHTML = `<section class="pb pb-live theme-${esc(prog.theme)}" style="--daub:${esc(dcol)}">
      <div class="pb-scene">${SCENE}</div>
      <div class="pb-hud">
        <div class="pb-stat"><div data-stars>⭐ …</div><div data-count aria-label="Players in this room">👤 01</div></div>
        <div class="pb-calls"><div class="pb-left" data-left>75 balls left</div><div class="pb-last" data-last aria-label="Last called balls"></div></div>
        <div class="pb-tools"><div data-k-rot></div><button class="pb-round" type="button" data-mute aria-label="Sound">${sfx.muted ? '🔇' : '🔊'}</button><button class="pb-round" type="button" data-leave aria-label="Close">✕</button></div>
      </div>
      <div class="pb-stage"><div class="pb-main">
        <div class="pb-meta"><span data-pat>Pattern</span><span data-time></span><span data-code></span><details class="pb-opts"><summary>Options</summary><label class="pb-auto"><input type="checkbox" data-auto ${prog.auto ? 'checked' : ''}> Auto-daub</label></details></div>
        <p class="pb-peek" data-peek hidden></p>
        <div class="pb-cards" data-cards></div>
        <div class="pb-names" data-names></div>
        <div class="pb-extra">
          <div class="pb-chat" aria-label="Quick chat">${PHRASES.map((p, i) => `<button type="button" data-say="${i}">${esc(p)}</button>`).join('')}</div>
          <div class="pb-floats"></div>
        </div>
        <div class="pb-break" data-break hidden>You’ve been playing a while. A break is nice too — come back whenever you like.</div>
      </div><aside class="pb-boardwrap" aria-label="Called numbers 1 to 75"><div class="pb-board" data-grid></div></aside></div>
      <div class="pb-dock"><div class="pb-powers" data-pow></div><button type="button" data-bingo>BINGO!</button></div>
      <div class="pb-ready" data-ready hidden><b data-ready-n>3</b><span>Get ready</span></div>
      <div class="pb-callout" data-callout hidden><b class="pb-orb" data-callball></b></div>
      <div class="pb-win" data-win hidden><div><b>BINGO!</b><p data-wint></p></div></div>
    </section>`;
    main.querySelector('[data-leave]').onclick = () => { dropSeat(); paintLobby(); };
    main.querySelector('[data-mute]').onclick = () => { sfx.muted = !sfx.muted; if (sfx.muted) hush(); paintHall(); };
    main.querySelector('[data-auto]').onchange = (e) => { prog.auto = e.target.checked; persist(); };
    main.querySelector('[data-bingo]').onclick = () => pressBingo();
    main.querySelectorAll('[data-say]').forEach((b) => b.onclick = () => { const i = +b.dataset.say; float(PHRASES[i] + ' you'); writeSeat({ emo: i + 1 }); });
    main.querySelector('[data-cards]').onclick = (e) => { const btn = e.target.closest('[data-k]'); if (!btn) return; tapCell(btn.dataset.k); };
    arm();
  }
  function float(text) { const host = main.querySelector('.pb-floats'); if (!host) return; const el = document.createElement('b'); el.textContent = text; host.appendChild(el); setTimeout(() => el.remove(), 2400); }
  function liveRound() {
    const ck = clock(); if (!ck || !room) return null;
    const seed = roundSeed(room.seed || 1, ck.round);
    const balls = ballsFor(seed); const pat = roomPattern(room, ck.round); const masks = masksFor(pat);
    const called = new Set(balls.slice(0, ck.called));
    const n = Math.min(slots(), Math.max(1, prog.cards | 0));
    const cards = Array.from({ length: n }, (_, i) => cardFor(seed, uid, i));
    return { ck, seed, balls, pat, masks, called, cards };
  }
  function tapCell(key) {
    const st = liveRound(); if (!st || !st.ck.live) return;
    const [ci, k] = key.split(':').map(Number); const card = st.cards[ci]; if (!card) return;
    const n = card[k]; if (k === 12) return;
    if (st.called.has(n)) { if (!daubed.has(n)) { daubed.add(n); addDaubs(1); stickerBall(n); sfx.play('place'); } return; }
    if (prog.powers.includes('free') && !frees.has(ci)) { frees.set(ci, k); prog.powers.splice(prog.powers.indexOf('free'), 1); persist(); sfx.play('star'); toast('Free daub placed'); return; }
    const btn = main.querySelector(`[data-k="${key}"]`);
    if (btn) { btn.classList.remove('pb-shake'); void btn.offsetWidth; btn.classList.add('pb-shake'); }
  }
  function usePower(id) {
    const i = prog.powers.indexOf(id); if (i < 0) return; const st = liveRound(); if (!st) return;
    if (id === 'peek') { prog.powers.splice(i, 1); peekUntil = Date.now() + 8000; persist(); return; }
    if (id === 'double') { prog.powers.splice(i, 1); doubleOn = true; persist(); toast('Your next win prize is doubled'); return; }
    if (id === 'free') {
      let best = null, bm = 99;
      st.cards.forEach((card, ci) => { if (frees.has(ci)) return; const miss = cardMiss(card, st.called, st.masks, -1); if (miss < bm && miss > 0) { bm = miss; best = { card, ci }; } });
      if (!best) { toast('Nothing to daub on the pattern right now'); return; }
      const cell = best.card.findIndex((n, k) => k !== 12 && !st.called.has(n) && st.masks.some((m) => m[k]));
      if (cell < 0) return; frees.set(best.ci, cell); prog.powers.splice(i, 1); persist(); sfx.play('star');
    }
  }
  function pressBingo() {
    const st = liveRound(); if (!st || !st.ck.live) { toast('Wait for the next round'); return; }
    let win = false, one = false, needMark = false;
    st.cards.forEach((card, ci) => {
      const free = frees.has(ci) ? frees.get(ci) : -1;
      const miss = cardMiss(card, st.called, st.masks, free);
      if (miss === 0 && markedWin(card, daubed, st.masks, free)) win = true;
      else if (miss === 0) needMark = true;
      else if (miss === 1) one = true;
    });
    if (needMark && !win) { toast('Stamp the called numbers first'); return; }
    if (!win) { missUntil = Date.now() + 1600; sfx.play('lose'); toast(one ? 'So close — one number away' : 'Not yet. Keep going!'); return; }
    // one win per round: a second tap used to re-run the prize box (extra diamonds, and a racing wallet write the rules reject)
    if (paidRound === st.ck.round) { toast('You already have BINGO this round. Next round soon!'); return; }
    const C = st.ck.called;
    const bot = botPlan(st);
    const earlier = seats.some((s) => s.id !== uid && s.claim > 0 && s.claim < C) || !!(bot && st.ck.t >= bot.tPress);
    claim = C; writeSeat({ claim: C });
    const lucky = luckyRound(st.ck.round);
    let stars = earlier ? 5 : (lucky ? 18 : 12);
    if (!earlier && doubleOn) stars = Math.min(25, stars * 2);
    doubleOn = false;
    let starP = Promise.resolve(-1);
    if (paidRound !== st.ck.round) { paidRound = st.ck.round; starP = prize(stars, earlier ? 'for a bingo' : 'for winning the round'); prog.xp += 20; ch().rounds += 1; if (!earlier) ch().wins = (ch().wins | 0) + 1; stickerPat(st.pat); persist(); grantCh(); dispatchEvent(new CustomEvent('kemy:xp', { detail: { n: 12 } })); import('../leaderboard.js').then((m) => m.recordScore('bingo', { r: earlier ? 'l' : 'w', pts: stars })).catch(() => {}); }
    winText = earlier ? 'You got BINGO too!' : (lucky ? 'Lucky Star win!' : 'You won this round!');
    winUntil = Date.now() + 8000; sfx.play('win'); playClips(['bingo', 'winner'], ['Bingo!', 'We have a winner!']); const trophy = earlier ? '' : trophyFor(st.pat, C); if (trophy) { prog.trophies = { g: 0, s: 0, b: 0, ...(prog.trophies || {}) }; prog.trophies[trophy] += 1; persist(); }
    winParty(stars, earlier ? 'You got it too!' : (lucky ? 'Lucky Star win!' : 'You win!'), { starP, boxP: winBox(earlier ? 1 : lucky ? 5 : 3), trophy, sticker: PATTERN_NAME[st.pat] });
  }
  // big "this round's pattern" banner with a mini card of the shape to cover (~3 s)
  function showBanner(pat) {
    document.querySelectorAll('.pb-ban').forEach((e) => e.remove());
    const m = pat === 'line' ? masksFor('line')[2] : (masksFor(pat)[0] || []);
    const el = document.createElement('div'); el.className = 'pb-ban'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="pb-mini" aria-hidden="true">${Array.from({ length: 25 }, (_, i) => `<i class="${m[i] ? 'on' : ''}"></i>`).join('')}</div><div><small>${room && !room.pub && roomPick(room) !== 'mix' ? 'Room game · ' : ''}${pat === 'line' ? 'Any line: across, down or diagonal' : 'Cover this shape'}</small><b>${esc(pat === 'line' ? 'Normal bingo' : (PATTERN_NAME[pat] || 'Bingo'))}</b></div>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 3100);
  }
  // full-screen stadium party with the player's own Pal dancing (module loaded only on a win)
  let party = null, bannerRound = -1, diaW = null, diaQ = Promise.resolve();
  // speed trophy: gold / silver / bronze by how many balls were called (bigger shapes get more time)
  const SPEED = { line: [16, 26], corners: [24, 38], x: [34, 48], heart: [38, 52], star: [36, 50], crown: [36, 50], blackout: [56, 66] };
  function trophyFor(pat, called) { const [g, sv] = SPEED[pat] || SPEED.line; return called <= g ? 'g' : called <= sv ? 's' : 'b'; }
  // the prize box: Kemy diamonds first (same diamond wallet + server caps as Pal Zombie Survival, plus a small bingo
  // day cap), bonus stars when bingo diamonds are done for today. Infinity Pass shows ∞.
  const DIA_DAY = 15;
  async function winBox(n) {
    try {
      const d = prog.dia && prog.dia.day === today ? prog.dia : (prog.dia = { day: today, n: 0 });
      const amt = Math.min(n, DIA_DAY - (d.n | 0));
      if (amt > 0) {
        if (!diaW) { const { createDiamonds } = await import('../pals/armory.js'); diaW = createDiamonds(db, uid); }
        const w = await diaW.get(true); if (w.admin) return { inf: true };
        d.n = (d.n | 0) + amt; persist();
        // one diamond save at a time (the wallet allows one save per 45 s, so a quick second win just waits its turn)
        const job = diaQ.then(() => diaW.earnRun(amt)).catch((e) => { console.warn('bingo diamonds', e && (e.code || e.message)); return 0; })
          .then((got) => { if (got < amt) { d.n = Math.max(0, (d.n | 0) - (amt - got)); persist(); } if (dead || !got) return got; if (slow) toast(`💎 ${got} Diamonds saved!`); return got; });
        diaQ = job; let slow = false;
        const got = await Promise.race([job, new Promise((r) => setTimeout(() => r(-1), 2500))]);
        if (got === -1) { slow = true; return { dia: amt, slow: true }; }
        if (got > 0) return { dia: got };
      }
      const b = await prize(3, 'bonus prize'); return { stars: b, capped: !b };
    } catch (e) { console.warn('bingo box', e && (e.code || e.message)); return { capped: true }; }
  }
  function winParty(stars, title, extra = {}) {
    import('./celebrate.js').then((m) => { if (dead) return; party = m; m.celebrate({ ...extra, stars, title, muted: sfx.muted, ctx: actx(), vol: clipVol(), getPal: () => import('../pals/core.js').then((c) => c.getActivePal(db, uid)).catch(() => null), onClose: () => { winUntil = 0; } }); }).catch(() => {});
  }
  function botPlan(st) {
    const humans = seats.filter((s) => Date.now() - s.at < FRESH).length || 1;
    const key = st.seed + ':' + st.pat + ':' + humans + ':' + (fast ? 1 : 0);
    if (botCache.key === key) return botCache.plan;
    let plan = null;
    if (humans < 6) {
      const n = Math.min(6, 6 - humans);
      for (let i = 0; i < n; i++) {
        const c = bingoCall(st.seed, BOTS[i].id, 1, st.pat);
        if (!c) continue;
        const tPress = st.ck.ready + (c - 1) * st.ck.call + botReactMs(st.seed, BOTS[i].id, fast);
        if (!plan || tPress < plan.tPress) plan = { ball: c, tPress, name: BOTS[i].name };
      }
    }
    botCache = { key, plan }; return plan;
  }
  function syncCards(st) {
    const host = main.querySelector('[data-cards]'); if (!host) return;
    const sig = st.ck.round + ':' + st.cards.length;
    if (host.dataset.sig !== sig) {
      host.dataset.sig = sig; host.dataset.fresh = '1'; daubed = new Set([0]); frees = new Map();
      host.innerHTML = st.cards.map((card, ci) => `<div class="pb-card wash${ci % 4}" data-ci="${ci}"><div class="pb-head" aria-hidden="true"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div><div class="pb-grid5">${card.map((n, k) => `<button type="button" class="pb-cell${k === 12 ? ' free got' : ''}" data-k="${ci}:${k}"${k === 12 ? ' aria-label="Free"' : ''}><span>${k === 12 ? '★' : n}</span></button>`).join('')}</div></div>`).join('');
    }
    if (prog.auto) {
      let added = 0; const fresh = host.dataset.fresh === '1';
      st.cards.forEach((card) => card.forEach((n) => { if (n && st.called.has(n) && !daubed.has(n)) { daubed.add(n); added++; if (!fresh) stickerBall(n); } }));
      if (fresh) host.dataset.fresh = ''; else if (added) addDaubs(added);
    }
    if (st.ck.live) host.dataset.played = String(st.ck.round);
    host.querySelectorAll('.pb-card').forEach((cardEl) => {
      const ci = +cardEl.dataset.ci; const card = st.cards[ci]; const free = frees.has(ci) ? frees.get(ci) : -1;
      const miss = cardMiss(card, st.called, st.masks, free);
      cardEl.classList.toggle('one', miss === 1 && st.ck.live); cardEl.classList.toggle('win', miss === 0 && st.ck.live);
      cardEl.querySelectorAll('.pb-cell').forEach((cell, k) => {
        const on = k === free || (k !== 12 && daubed.has(card[k]));
        const was = cell.classList.contains('got');
        cell.classList.toggle('got', on || k === 12); cell.classList.toggle('star', k === free);
        if (on && !was) { cell.classList.remove('got'); void cell.offsetWidth; cell.classList.add('got'); }
      });
    });
  }
  function tick() {
    if (dead) return;
    tickN++;
    if (mode === 'lobby') return;
    const st = liveRound();
    if (!st) return;
    if (st.ck.round !== lastRound) { lastRound = st.ck.round; botShown = -1; saidReady = -1; saidBall = -1; saidCount = ''; seenBall = -1; }
    if (st.ck.phase === 'ready' && st.ck.live && saidReady !== st.ck.round) { saidReady = st.ck.round; playClips(['get-ready'], ['Get ready!']); }
    if (st.ck.live && bannerRound !== st.ck.round) { bannerRound = st.ck.round; showBanner(st.pat); }
    if (st.ck.phase === 'ready' && st.ck.live && st.ck.count && saidCount !== st.ck.round + ':' + st.ck.count) { saidCount = st.ck.round + ':' + st.ck.count; playClips([String(st.ck.count)], [String(st.ck.count)]); }
    if (seenBall !== st.ck.called) {
      const fresh = seenBall >= 0 || (st.ck.called > 0 && st.ck.nextIn > st.ck.call - 1600);
      if (fresh && st.ck.called > seenBall && st.ck.live && st.ck.phase !== 'ready') {
        chirp(); sfx.play('pop');
        const n = st.balls[st.ck.called - 1];
        if (saidBall !== st.ck.called) { saidBall = st.ck.called; playClips([letterOf(n).toLowerCase() + n], [letterOf(n) + '...', String(n)]); showCallout(n); }
      }
      seenBall = st.ck.called;
    }
    const readyEl = main.querySelector('[data-ready]');
    if (readyEl) {
      const show = st.ck.live && st.ck.phase === 'ready';
      readyEl.hidden = !show;
      if (show) { const b = readyEl.querySelector('[data-ready-n]'); if (b) b.textContent = st.ck.count ? String(st.ck.count) : 'Get ready'; }
    }
    const callout = main.querySelector('[data-callout]');
    if (callout) callout.hidden = calloutUntil <= Date.now() || (st.ck.phase === 'ready');
    const last = main.querySelector('[data-last]');
    if (last) {
      const nums = st.balls.slice(Math.max(0, st.ck.called - 5), st.ck.called).reverse();
      const sig = nums.join(',');
      if (last.dataset.sig !== sig) { last.dataset.sig = sig; last.innerHTML = nums.map((n, i) => { const L = letterOf(n); return `<b class="pb-orb c${L}${i === 0 ? ' now' : ''}"><small>${L}</small>${n}</b>`; }).join(''); }
      const now = last.querySelector('.now');
      if (now && st.ck.call) {
        const span = st.ck.called === 0 ? st.ck.ready : st.ck.call;
        const frac = span ? Math.max(0, Math.min(1, st.ck.nextIn / span)) : 0;
        now.style.setProperty('--pb-wait', Math.round(frac * 100) + '%');
      }
    }
    const leftEl = main.querySelector('[data-left]');
    if (leftEl) leftEl.textContent = !st.ck.live ? 'Next round' : st.ck.phase === 'ready' ? 'Get ready…' : `${75 - st.ck.called} balls left`;
    const patEl = main.querySelector('[data-pat]'); if (patEl) patEl.innerHTML = `${PATTERN_NAME[st.pat]}${luckyRound(st.ck.round) ? ' · <span class="lucky">Lucky Star</span>' : ''}`;
    const timeEl = main.querySelector('[data-time]'); if (timeEl) { const s = Math.ceil(st.ck.left / 1000); timeEl.textContent = st.ck.live ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Next round soon'; }
    const codeEl = main.querySelector('[data-code]'); if (codeEl) { const priv = !(room && room.pub); codeEl.textContent = !priv ? 'Public hall · Normal bingo' : 'Code ' + roomId + (room ? ' · ' + gameLabel(roomPick(room)) : '') + ' · 📋 Copy';
      // private rooms: tap the code to copy it for friends ("Friend code" box in the lobby)
      if (priv) { codeEl.setAttribute('role', 'button'); codeEl.style.cursor = 'pointer'; codeEl.title = 'Copy room code'; codeEl.onclick = () => { navigator.clipboard?.writeText(roomId).then(() => toast('Code copied: ' + roomId), () => toast('Code: ' + roomId)); }; } else { codeEl.removeAttribute('role'); codeEl.onclick = null; } }
    const people = roomPeople();
    const countEl = main.querySelector('[data-count]'); if (countEl) countEl.textContent = '👤 ' + String(people.length).padStart(2, '0');
    const namesEl = main.querySelector('[data-names]'); if (namesEl) namesEl.textContent = people.map((p) => p.name).join(' · ');
    const starsEl = main.querySelector('[data-stars]');
    if (starsEl && tickN % 4 === 0) { const w = window.kemyWallet && window.kemyWallet.walletState && window.kemyWallet.walletState(); starsEl.textContent = !w || w.c == null ? '⭐ …' : (w.admin ? '⭐ ∞' : '⭐ ' + w.c); }
    const grid = main.querySelector('[data-grid]');
    if (grid) {
      if (!grid.dataset.built) {
        const cols = [[], [], [], [], []];
        for (let n = 1; n <= 75; n++) cols[Math.floor((n - 1) / 15)].push(n);
        grid.innerHTML = 'BINGO'.split('').map((L, i) => `<div class="pb-col c${L}"><h3>${L}</h3>${cols[i].map((n) => `<i data-n="${n}">${n}</i>`).join('')}</div>`).join('');
        grid.dataset.built = '1';
      }
      const key = st.ck.round + ':' + st.ck.called;
      if (grid.dataset.key !== key) { grid.dataset.key = key; grid.querySelectorAll('i').forEach((el) => el.classList.toggle('on', st.called.has(+el.dataset.n))); }
    }
    const peek = main.querySelector('[data-peek]');
    if (peek) { const show = peekUntil > Date.now() && st.ck.called < 75; peek.hidden = !show; if (show) { const n = st.balls[st.ck.called]; peek.textContent = 'Next ball: ' + letterOf(n) + n; } }
    const pow = main.querySelector('[data-pow]');
    if (pow && tickN % 8 === 0) pow.innerHTML = prog.powers.length ? prog.powers.map((id) => `<button type="button" data-pow="${id}">${POWNAME[id]}</button>`).join('') : '<span>Play to earn a power-up</span>';
    syncCards(st);
    const one = st.cards.some((card, ci) => cardMiss(card, st.called, st.masks, frees.has(ci) ? frees.get(ci) : -1) === 1);
    if (one && st.ck.live && st.ck.nextIn < 800 && drum < 3) { drum++; sfx.play('tick'); } if (!one) drum = 0;
    const bot = botPlan(st);
    if (bot && st.ck.t >= bot.tPress && st.ck.live && botShown !== st.ck.round) { botShown = st.ck.round; float(bot.name + ' called BINGO!'); sfx.play('star'); playClips(['bingo'], ['Bingo!']); }
    const cardHost = main.querySelector('[data-cards]');
    if (!st.ck.live && cardHost && cardHost.dataset.played === String(st.ck.round) && paidRound !== st.ck.round && daubed.size > 1) { paidRound = st.ck.round; ch().rounds += 1; persist(); prize(3, 'for playing the round'); grantCh(); }
    const win = main.querySelector('[data-win]');
    if (win) { win.hidden = winUntil <= Date.now() || !!document.querySelector('.pbs'); const t = win.querySelector('[data-wint]'); if (t) t.textContent = winText; if (!win.hidden && !win.dataset.fx) { win.dataset.fx = '1'; for (let i = 0; i < 14; i++) { const s = document.createElement('span'); s.textContent = '⭐'; s.style.left = (10 + Math.random() * 80) + '%'; s.style.top = (30 + Math.random() * 30) + '%'; win.appendChild(s); } } if (win.hidden) delete win.dataset.fx; }
    breakNote();
    const go = main.querySelector('[data-bingo]'); if (go) go.disabled = !st.ck.live;
    if (!window.__pbTest && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) window.__pbTest = { win: (o) => winParty(12, 'You win!', { starP: Promise.resolve(12), boxP: Promise.resolve({ dia: 3 }), trophy: 'g', sticker: 'Any line', ...(o || {}) }), banner: (p) => showBanner(p || st.pat), box: (n) => winBox(n || 3), trophyFor };
    window.__pb = { ready: st.ck.live && st.cards.some((card, ci) => cardMiss(card, st.called, st.masks, frees.has(ci) ? frees.get(ci) : -1) === 0), live: st.ck.live, celeb: winUntil > Date.now(), called: st.ck.called, round: st.ck.round, pat: st.pat, bots: roster().filter((p) => String(p.id).startsWith('bot-')).length, seats: seats.length, room: roomId };
  }
  function breakNote() {
    const el = main.querySelector('[data-break]'); if (!el) return;
    if (!broke && Date.now() - session0 > 45 * 60 * 1000) broke = true;
    el.hidden = !broke;
  }
  const onPow = (e) => { const b = e.target.closest && e.target.closest('[data-pow]'); if (b && mode === 'hall') usePower(b.dataset.pow); };
  main.addEventListener('click', onPow);
  paintLobby();
  const loop = () => { if (dead) return; try { tick(); } catch (e) { console.warn('bingo', e); } };
  const iv = setInterval(loop, 200);
  const onHash = () => { if (!location.hash.startsWith('#/arcade/bingo')) stop(); };
  addEventListener('hashchange', onHash);
  function showCallout(n) {
    const el = main.querySelector('[data-callout]'); if (!el) return;
    const ball = el.querySelector('[data-callball]');
    const L = letterOf(n);
    if (ball) { ball.className = 'pb-orb c' + L; ball.innerHTML = `<small>${L}</small>${n}`; }
    calloutUntil = Date.now() + 1700; el.hidden = false;
  }
  function stop() { dead = true; if (party) party.closeCelebration(); document.querySelectorAll('.pb-ban').forEach((e) => e.remove()); clearInterval(iv); removeEventListener('hashchange', onHash); main.removeEventListener('click', onPow); hush(); dropSeat(); window.__pb = null; window.__pbTest = null; }
  return { destroy: stop };
}
