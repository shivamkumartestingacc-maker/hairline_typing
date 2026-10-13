/* ── HAIRLINE / TYPE DEFENSE ──────────────────────────────
   Core loop (v0.1):
     · enemies walk in from the right, word over each head
     · there is always a current word; every key — the first included —
       is judged against its next position and consumes it, so the
       input stream never halts
     · correct letter  → hero fires, the letter rides the bullet,
                         on hit the enemy takes 1 damage (its word greys out)
     · wrong letter    → letter marked wrong, enemy fires back (8 HP on
                         hit), and play moves to the next letter anyway
     · word finished   → all positions entered: the enemy falls
     · enemy at the line → it stops and keeps firing at the hero
   Drawing follows lucasmarkes/hairline: plate / hi / edge / mid / lo,
   hairline strokes, plates filled, figures made of lines only.
----------------------------------------------------------- */
(() => {
'use strict';

/* =============== words =============== */
const WORDS_SHORT = ['cat','dog','run','jump','code','type','fast','line','ink','pen','dot','dash','arc','grid','wave','bolt','spark','pixel','laser','robot','storm','cloud','flame','stone','blade','arrow','shield','quest','map','key','lock','star','moon','sun','wind','rain','fire','wolf','bear','fox','owl','elk'];
const WORDS_MID   = ['typing','runner','walker','pencil','paper','planet','rocket','garden','bridge','castle','dragon','knight','sniper','bullet','letter','screen','keyboard','winter','summer','harbor','lantern','meadow','canyon','falcon','viper','cobra','tiger','eagle','comet','orbit','vector','syntax','cursor','button','window','ladder','hammer','anchor','beacon','cipher','delta','echo','flux','glyph','haven','iris','jade','karma','lumen','misty','novel','onyx','prism','quartz','ridge','solar','tulip','umbra','vault','willow','xenon','yield','zephyr','isometric','hairline'];
const WORDS_LONG  = ['adventure','battlefield','champion','dangerous','evergreen','firewall','guardian','labyrinth','moonlight','nightfall','overdrive','paperwork','quicksand','riverbank','storyteller','thunder','umbrella','vagabond','waterfall','yesterday','zigzag','aftermath','blueprint','crossfire','daydream','earthquake','footsteps','gunpowder','headlight','ironwood','jackhammer','keystroke','landmark','mastermind','notebook','outlander','pathfinder','quicksilver','rainmaker','sidewinder','trailhead','uppercut','viewpoint','wanderer','yardstick','zenith','blacksmith','counterpart','drawbridge','elsewhere','framework','grandfather','hemisphere','illustration','journeyman','kindergarten','longbowman','mountaineer','nevertheless','oscilloscope','protagonist','quarterback','rattlesnake','silhouette','transmission','undercurrent','verification','watchtower','extinguisher','yellowhammer','zoetrope'];
const ALL_WORDS = [...WORDS_SHORT, ...WORDS_MID, ...WORDS_LONG];
/* simple lines (phrases) — carried by later enemies; spaces are typed too */
const LINES = ['the sun is hot','i can type fast','type to win','the hero aims well','shoot every letter','the line holds','we march at dawn','a quick red fox','stay on target','the shield is up','run to the line','words become lines','simple lines only','fire on my mark','hold the line','the dawn is near','type the line','we walk in line','aim shoot type','the fox runs fast'];

const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function wordFor(type, wave) {
  const inUse = new Set(G.enemies.map(e => e.word));
  let pool;
  if (type === 'runner') pool = WORDS_SHORT.concat(WORDS_MID.filter(w => w.length <= 6));
  else if (type === 'brute') pool = wave >= 3 ? WORDS_LONG : WORDS_MID.filter(w => w.length >= 6).concat(WORDS_LONG.slice(0, 24));
  else pool = wave <= 1 ? WORDS_MID.filter(w => w.length <= 7) : WORDS_MID.concat(WORDS_LONG.filter(w => w.length <= 9));
  for (let i = 0; i < 24; i++) { const w = pick(pool); if (!inUse.has(w)) return w; }
  return pick(ALL_WORDS);
}

/* =============== dom =============== */
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
/* roundRect fallback for older engines */
if (ctx && !ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    const r = Math.min(6, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}
const stageEl = $('stage'), readoutEl = $('stageReadout');
const hpFill = $('hpFill'), hpText = $('hpText'), hpBarWrap = $('hpBarWrap');
const hudScore = $('hudScore'), hudWave = $('hudWave'), hudKills = $('hudKills'),
      hudAcc = $('hudAcc'), hudWpm = $('hudWpm'), hudStreak = $('hudStreak');
const targetWordEl = $('targetWord'), feedbackEl = $('feedback');
const menuEl = $('menuOverlay'), pauseEl = $('pauseOverlay'), overEl = $('overOverlay');
const waveBanner = $('waveBanner'), hitVig = $('hitVignette');
const btnPause = $('btnPause'), btnSound = $('btnSound'), shieldStatusEl = $('shieldStatus');
const btnHelp = $('btnHelp'), helpPanel = $('helpPanel'), helpBackdrop = $('helpBackdrop');
const mobileInput = $('mobileInput');

/* =============== palette (hairline) =============== */
function palette() {
  const dark = document.body.classList.contains('dark-plate');
  return dark
    ? { plate:'#08090a', hi:'#d0d6e0', edge:'#5b5d64', mid:'#3e3e44', lo:'#29292d', accent:'#ff6369' }
    : { plate:'#ffffff', hi:'#232327', edge:'#a4a4ac', mid:'#c3c3c9', lo:'#e0e0e4', accent:'#e5484d' };
}

/* =============== sound (tiny synth, no assets) ===============
   One explicit, persistent switch: soundOn lives in localStorage and
   every tone runs through a single master gain. OFF suspends the
   AudioContext itself, so nothing — scheduled, delayed or triggered
   from anywhere — can make a sound until the player turns it ON. */
let AC = null, masterGain = null;
let soundOn = true;
try { soundOn = localStorage.getItem('hairline-type-defense-sound') !== 'off'; } catch { /* private mode: default on */ }
function audio() {
  if (!soundOn) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain(); masterGain.gain.value = 0.9;
      masterGain.connect(AC.destination);
    } catch { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) {
  if (!soundOn) return; const ac = audio(); if (!ac || !masterGain) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}
function renderSoundButton() {
  btnSound.textContent = soundOn ? '♪ SOUND: ON' : '♪ SOUND: OFF';
  btnSound.classList.toggle('off', !soundOn);
  btnSound.setAttribute('aria-pressed', String(soundOn));
  btnSound.title = soundOn ? 'Sound is ON — click to mute' : 'Sound is OFF — click to play sound';
}
function setSound(on, announce = true) {
  soundOn = on;
  try { localStorage.setItem('hairline-type-defense-sound', on ? 'on' : 'off'); } catch { /* ignore */ }
  renderSoundButton();
  if (!on) { if (AC && AC.state === 'running') AC.suspend(); }   // hard mute: the context itself sleeps
  else if (announce) { audio(); SFX.word(); }                    // confirmation blip only when turning ON
}
const SFX = {
  shoot()  { tone(760, 170, 0.08, 'square', 0.10); },
  eshoot() { tone(210, 65, 0.14, 'sawtooth', 0.10); },
  hit()    { tone(1250, 900, 0.035, 'square', 0.06); },
  hurt()   { tone(140, 48, 0.22, 'sawtooth', 0.16); tone(90, 40, 0.25, 'triangle', 0.12, 0.02); },
  die()    { tone(520, 60, 0.3, 'square', 0.11); tone(880, 120, 0.22, 'triangle', 0.07, 0.03); },
  word()   { tone(660, 660, 0.07, 'sine', 0.10); tone(990, 990, 0.1, 'sine', 0.10, 0.07); },
  wrong()  { tone(180, 90, 0.12, 'square', 0.09); },
  shield() { tone(520, 520, 0.09, 'sine', 0.10); tone(784, 784, 0.14, 'sine', 0.10, 0.08); },
  block()  { tone(340, 190, 0.09, 'triangle', 0.12); },
  wave()   { tone(440, 440, 0.09, 'sine', 0.09); tone(660, 660, 0.12, 'sine', 0.09, 0.09); },
};

/* =============== state =============== */
const W = 960, H = 420, HERO_X = 138, HERO_GY = 350, LINE_X = 208;
let G;
function freshState() {
  return {
    mode: 'menu',            // menu | playing | paused | over
    time: 0, runTime: 0, lastTs: 0,
    hero: { hp: 100, recoil: 0, flashT: 0, hurtT: 0, muzzleT: 0, deadT: 0, phase: 0 },
    activeId: null,          // the enemy the player has typed onto — chosen by typing, never imposed
    enemies: [], bullets: [], particles: [], floats: [],
    spawnT: 0.35, kills: 0, score: 0, wave: 1,
    correct: 0, total: 0, streak: 0, bestStreak: 0,
    shield: { active: false, cleanWords: 0, flashT: 0 },
    linesIntroduced: false,
    shake: 0, nextId: 1, overT: 0,
  };
}
G = freshState();

/* decorative isometric pillars, hairline Terrain-style, fixed at load */
const PILLARS = [];
for (let i = 0; i < 17; i++) {
  const x = 236 + i * 43 + rand(-6, 6);
  PILLARS.push({ x, gy: 316 + (i % 3) * 7, h: 12 + 34 * Math.abs(Math.sin(i * 1.7)) + rand(0, 8), w: 15 + (i % 4) * 2 });
}
PILLARS.sort((a, b) => a.gy - b.gy);

/* =============== enemies =============== */
const LANES = [ { gy: 322, s: 0.88 }, { gy: 344, s: 0.99 }, { gy: 364, s: 1.09 } ];
function spawnEnemy() {
  const wave = G.wave;
  const r = Math.random();
  const type = G.kills === 0 ? 'walker' : (r < 0.16 + wave * 0.012 ? 'brute' : r < 0.46 ? 'runner' : 'walker');
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  const typeMul = type === 'runner' ? 1.5 : type === 'brute' ? 0.62 : 1;
  const scaleMul = type === 'runner' ? 0.82 : type === 'brute' ? 1.24 : 1;
  /* after a while (wave 3, or 75 seconds in) some walkers carry a simple
     LINE instead of a word — spaces included, typed like any letter */
  const linesUnlocked = wave >= 3 || G.runTime >= 75;
  const isLine = linesUnlocked && type !== 'runner' && Math.random() < 0.34;
  let word = wordFor(type, wave);
  if (isLine) {
    const inUse = new Set(G.enemies.map(e => e.word));
    word = pick(LINES);
    for (let i = 0; i < 24 && inUse.has(word); i++) word = pick(LINES);
    if (!G.linesIntroduced) {
      G.linesIntroduced = true;
      setFeedback('new carriers ahead: <b>LINES</b> — type the whole line, <b>spaces</b> too!', 'good');
    }
  }
  /* a newcomer enters behind everyone already on the field, so the
     march (and the bubble stack) stays in one readable order */
  let spawnX = W + rand(30, 130);
  for (const o of G.enemies) if (o.state === 'alive') spawnX = Math.max(spawnX, o.x + rand(60, 120));
  G.enemies.push({
    id: G.nextId++, type, word, isLine, progress: 0, marks: [], completed: false,
    x: spawnX, gy: lane.gy, s: lane.s * scaleMul,
    speed: (30 + wave * 2.1 + rand(0, 10)) * typeMul * (isLine ? 0.72 : 1),
    phase: rand(0, Math.PI * 2), state: 'alive', deathT: 0,
    flashT: 0, shakeT: 0, kb: 0, attackCd: rand(0.7, 1.2), muzzleT: 0,
    seed: rand(0, 100),
  });
}
const aliveEnemies = () => G.enemies.filter(e => e.state === 'alive');
/* The current word. Once the player has begun a word it stays theirs
   until it is finished. Before that (no word begun), the nearest
   unfinished enemy is shown as the current word — so there is always
   a word in the TARGET box for the key stream to advance through,
   starting from its very first letter, right or wrong. */
function getTarget() {
  if (G.activeId != null) {
    const e = G.enemies.find(en => en.id === G.activeId);
    if (e && e.state === 'alive' && !e.completed) return e;
    G.activeId = null;
  }
  const next = G.enemies
    .filter(e => e.state === 'alive' && !e.completed)
    .sort((a, b) => a.x - b.x)[0];
  if (!next) return null;
  G.activeId = next.id;
  return next;
}

/* =============== pose maths (shared by draw + firing) =============== */
function pose(x, gy, s, facing, phase, walking, aimAngle, recoil) {
  const head = { x, y: gy - 57 * s }, hr = 9 * s;
  const neck = { x, y: head.y + hr * 0.9 };
  const hip = { x: x - facing * 1.5 * s, y: gy - 29 * s };
  const shoulder = { x, y: gy - 43 * s };
  const swing = walking ? Math.sin(phase) * 11 * s : 7 * s;
  const swing2 = walking ? Math.sin(phase + Math.PI) * 11 * s : -6 * s;
  const footA = { x: x + swing, y: gy }, footB = { x: x + swing2, y: gy };
  const kneeA = { x: (hip.x + footA.x) / 2 + facing * 3.5 * s, y: (hip.y + gy) / 2 };
  const kneeB = { x: (hip.x + footB.x) / 2 - facing * 1 * s, y: (hip.y + gy) / 2 };
  const gx = Math.cos(aimAngle), gyv = Math.sin(aimAngle);
  const hand = { x: shoulder.x + gx * 19 * s - recoil * facing, y: shoulder.y + gyv * 19 * s };
  const muzzle = { x: hand.x + gx * 25 * s, y: hand.y + gyv * 25 * s };
  const backHand = { x: shoulder.x - facing * 9 * s, y: shoulder.y + 13 * s };
  const chest = { x, y: gy - 42 * s };
  return { head, hr, neck, hip, shoulder, footA, footB, kneeA, kneeB, hand, muzzle, backHand, chest };
}
function heroPose() {
  const t = getTarget();
  let aim = -0.04;
  if (t) { const tc = { x: t.x, y: t.gy - 42 * t.s }; aim = Math.atan2(tc.y - (HERO_GY - 43), tc.x - HERO_X); }
  return pose(HERO_X, HERO_GY, 1.06, 1, G.hero.phase, false, aim, G.hero.recoil);
}
function enemyPose(e) {
  const hc = { x: HERO_X, y: HERO_GY - 42 };
  const walking = e.x > LINE_X && e.state === 'alive';
  const aim = Math.atan2(hc.y - (e.gy - 43 * e.s), hc.x - e.x);
  return pose(e.x, e.gy, e.s, -1, e.phase, walking, aim, 0);
}

/* =============== fx helpers =============== */
function burst(x, y, n, P, accent = false) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(28, 120);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 22, life: 0, max: rand(0.22, 0.5), len: rand(3, 9), accent });
  }
}
function floatText(x, y, text, kind = '') {
  G.floats.push({ x, y, text, kind, life: 0 });
}
function doShake(n) { G.shake = Math.max(G.shake, n); stageEl.classList.remove('shake'); void stageEl.offsetWidth; stageEl.classList.add('shake'); }

/* =============== combat =============== */
function fireHeroBullet(enemy, ch, isFinal) {
  const hp = heroPose();
  G.hero.recoil = 5; G.hero.muzzleT = 0.07;
  G.bullets.push({ from: 'hero', x: hp.muzzle.x, y: hp.muzzle.y, target: enemy, ch, isFinal, speed: 780, trail: [] });
  SFX.shoot();
}
function fireEnemyBullet(enemy) {
  const ep = enemyPose(enemy);
  enemy.muzzleT = 0.08;
  G.bullets.push({ from: 'enemy', x: ep.muzzle.x, y: ep.muzzle.y, target: null, ch: '', isFinal: false, speed: 560, trail: [] });
  SFX.eshoot();
}

/* Positional typing — the input stream never halts:
     · there is always a current word (the TARGET box): the word being
       typed, or before one has begun, the nearest enemy's word. At a
       word boundary, another enemy's first letter picks that word.
     · EVERY letter — including the very first — is judged against the
       current word's next position and consumes it either way:
           correct → hero fires at the enemy (1 hit, letter greys out)
           wrong   → letter is marked wrong, the enemy fires back,
                     and play moves straight to the next letter.
       e.g. “apple” typed as “appel”: a✓ p✓ p✓, then e✗ (wanted l) and
       l✗ (wanted e) — the 5-letter word is finished after 5 keys.
     · when the last position is entered the word is finished and the
       enemy falls (through the final bullet if that letter was right,
       or on the spot if it was wrong). The next key picks a new word. */
function handleChar(raw) {
  if (G.mode !== 'playing') return;
  const ch = raw.toLowerCase();
  if (!/^[a-z ]$/.test(ch)) return;            // letters, plus space (for lines)
  const field = G.enemies.filter(e => e.state === 'alive' && !e.completed);
  if (!field.length) return;                 // nothing on the field to hit or be hit by
  G.total++;
  let active = getTarget();
  if (!active) return;

  /* Word boundary only: before the first letter of the current word has
     been entered, typing another enemy's first letter picks THAT word
     instead. Once a word has begun, every key belongs to it until it is
     finished — a wrong key is marked wrong and the word moves on. */
  if (active.progress === 0 && ch !== active.word[0]) {
    const other = field
      .filter(e => e !== active && e.progress === 0 && e.word[0] === ch)
      .sort((a, b) => a.x - b.x)[0];
    if (other) { active = other; G.activeId = other.id; }
  }

  /* judge this key against the active word's next position — and
     consume that position whatever happens */
  const expected = active.word[active.progress];
  const isCorrect = ch === expected;
  active.marks.push(isCorrect);
  active.progress++;
  const isFinal = active.progress >= active.word.length;
  const wrongs = active.marks.filter(m => !m).length;
  if (isFinal) { active.completed = true; G.activeId = null; }

  const shown = c => (c === ' ' ? '␣ space' : c);
  if (isCorrect) {
    G.correct++; G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
    fireHeroBullet(active, ch, isFinal);
    addScore(10, active.x, active.gy - 92 * active.s);
    if (isFinal) {
      let shieldMsg = '';
      if (wrongs === 0) {                        // a clean (perfect) word
        /* a clean word also patches the hero up: +2 HP, capped at 100 */
        const healed = Math.min(2, 100 - G.hero.hp);
        if (healed > 0) {
          G.hero.hp += healed;
          floatText(HERO_X + 18, HERO_GY - 104, `+${healed} HP`, 'good');
          shieldMsg += ` <b>+${healed} HP</b>.`;
        }
        G.shield.cleanWords++;
        if (!G.shield.active && G.shield.cleanWords >= 2) {
          G.shield.active = true; G.shield.flashT = 0.45;
          SFX.shield();
          shieldMsg = ' ⬡ <b>SHIELD UP</b> — two clean words in a row! It blocks enemy shots, and falls on your next typo.';
        } else SFX.word();
      } else G.shield.cleanWords = 0;
      setFeedback(`“${active.word}” finished${wrongs ? ` with ${wrongs} miss${wrongs > 1 ? 'es' : ''}` : ' — clean'}! Next word up.${shieldMsg}`, wrongs ? '' : 'good');
    }
    else setFeedback(`<b>${shown(ch)}</b> ✓ — hit inbound · streak ×${G.streak}`, 'good');
  } else {
    /* a typo: the shield — earned or not — falls right here */
    const hadShield = G.shield.active;
    G.shield.active = false; G.shield.cleanWords = 0;
    G.streak = 0;
    active.shakeT = 0.3;
    fireEnemyBullet(active);
    SFX.wrong();
    if (isFinal) {
      setFeedback(`✕ <b>${shown(ch)}</b> (wanted <b>${shown(expected)}</b>) — “${active.word}” finished with ${wrongs} miss${wrongs > 1 ? 'es' : ''}; its last shot is incoming!${hadShield ? ' ⬡ <b>SHIELD DOWN.</b>' : ''}`, 'bad');
      finishEnemy(active);
    } else {
      setFeedback(`✕ <b>${shown(ch)}</b> (wanted <b>${shown(expected)}</b>) — ${active.type} fires back · next: <b>${shown(active.word[active.progress])}</b>${hadShield ? ' · ⬡ <b>SHIELD DOWN</b>' : ''}`, 'bad');
    }
  }
  syncHud(); renderTargetWord();
}

function addScore(n, x, y) {
  const mult = 1 + Math.floor(G.streak / 12);
  const gain = n * mult;
  G.score += gain;
  if (n >= 10 && Math.random() < 0.4) floatText(x, y, `+${gain}`, 'good');
}

/* A word is finished when every letter position has been entered —
   right or wrong — and the enemy falls. (A correct final letter kills
   through its bullet; a wrong final letter finishes it here.) */
function finishEnemy(e) {
  if (!e || e.state !== 'alive') return;
  e.state = 'dying'; e.deathT = 0;
  if (G.activeId === e.id) G.activeId = null;
  G.kills++;
  const bonus = 30 + e.word.length * 5;
  G.score += bonus;
  floatText(e.x, e.gy - 96 * e.s, `${e.word}  +${bonus}`, 'kill');
  burst(e.x, e.gy - 40 * e.s, 18, palette(), false);
  SFX.die();
  checkWave();
  renderTargetWord();
}

function bulletHit(b) {
  const P = palette();
  if (b.from === 'hero') {
    const e = b.target;
    if (!e || e.state !== 'alive') return;
    e.flashT = 0.16; e.kb = 26;
    burst(e.x, e.gy - 42 * e.s, b.isFinal ? 16 : 7, P, false);
    SFX.hit();
    if (b.isFinal) finishEnemy(e);
  } else if (G.shield.active) {
    /* the shield eats the shot — no HP lost, and it holds:
       only a typo brings the shield down */
    G.shield.flashT = 0.3;
    burst(HERO_X + 10, HERO_GY - 42, 8, palette(), false);
    floatText(HERO_X + 26, HERO_GY - 96, '⬡ BLOCKED', 'good');
    SFX.block();
  } else {
    G.hero.hp = Math.max(0, G.hero.hp - 8);
    G.hero.hurtT = 0.3; G.hero.flashT = 0.2;
    burst(HERO_X + 6, HERO_GY - 42, 10, palette(), true);
    floatText(HERO_X + 16, HERO_GY - 96, '−8 HP', 'bad');
    hitVig.classList.remove('on'); void hitVig.offsetWidth; hitVig.classList.add('on');
    doShake(1); SFX.hurt(); syncHud();
    if (G.hero.hp <= 0 && G.mode === 'playing') { G.mode = 'dying'; G.overT = 0; }
  }
  syncHud();
}

function checkWave() {
  const w = Math.floor(G.kills / 8) + 1;
  if (w !== G.wave) {
    G.wave = w;
    waveBanner.textContent = `WAVE ${w}`;
    waveBanner.hidden = false;
    waveBanner.style.animation = 'none'; void waveBanner.offsetWidth; waveBanner.style.animation = '';
    setTimeout(() => { waveBanner.hidden = true; }, 1850);
    SFX.wave(); syncHud();
  }
}

/* =============== update =============== */
function update(dt) {
  G.time += dt;
  const hero = G.hero;
  hero.phase += dt * 2.2;
  hero.recoil *= Math.pow(0.0001, dt); if (hero.recoil < 0.05) hero.recoil = 0;
  hero.muzzleT = Math.max(0, hero.muzzleT - dt);
  hero.flashT = Math.max(0, hero.flashT - dt);
  hero.hurtT = Math.max(0, hero.hurtT - dt);
  G.shield.flashT = Math.max(0, G.shield.flashT - dt);
  G.shake = Math.max(0, G.shake - dt * 3);

  if (G.mode === 'dying') {
    hero.deadT = Math.min(1, hero.deadT + dt * 1.4);
    G.overT += dt;
    stepFx(dt);
    if (G.overT > 0.85) gameOver();
    return;
  }
  if (G.mode !== 'playing') { stepFx(dt); return; }

  G.runTime += dt;

  /* spawning */
  G.spawnT -= dt;
  const cap = Math.min(6, 3 + G.wave);
  if (G.spawnT <= 0 && aliveEnemies().length < cap) {
    spawnEnemy();
    G.spawnT = Math.max(1.05, 2.55 - G.wave * 0.15) * rand(0.75, 1.25);
  }

  /* enemies */
  for (const e of G.enemies) {
    e.flashT = Math.max(0, e.flashT - dt);
    e.shakeT = Math.max(0, e.shakeT - dt);
    e.muzzleT = Math.max(0, e.muzzleT - dt);
    if (e.state === 'dying') { e.deathT += dt / 0.55; continue; }
    e.x += e.kb * dt; e.kb *= Math.pow(0.0001, dt);
    if (e.x > LINE_X) {
      e.x -= e.speed * dt;
      e.phase += dt * (4 + e.speed * 0.09);
      if (e.x < LINE_X) e.x = LINE_X;
    } else {
      /* at the line: keep shooting the hero */
      e.attackCd -= dt;
      if (e.attackCd <= 0) { fireEnemyBullet(e); e.attackCd = 1.35; }
    }
  }
  G.enemies = G.enemies.filter(e => !(e.state === 'dying' && e.deathT >= 1));

  /* bullets */
  for (const b of G.bullets) {
    const tp = b.from === 'hero'
      ? (b.target ? { x: b.target.x, y: b.target.gy - 42 * b.target.s } : { x: b.x + 10, y: b.y })
      : { x: HERO_X + 4, y: HERO_GY - 42 };
    const dx = tp.x - b.x, dy = tp.y - b.y, d = Math.hypot(dx, dy) || 1;
    const step = b.speed * dt;
    b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 5) b.trail.shift();
    if (d <= step + 4) { b.x = tp.x; b.y = tp.y; b.dead = true; bulletHit(b); }
    else { b.x += dx / d * step; b.y += dy / d * step; }
  }
  G.bullets = G.bullets.filter(b => !b.dead);
  stepFx(dt);
}

function stepFx(dt) {
  for (const p of G.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 190 * dt; }
  G.particles = G.particles.filter(p => p.life < p.max);
  for (const f of G.floats) { f.life += dt; f.y -= 26 * dt; }
  G.floats = G.floats.filter(f => f.life < 1.05);
}

/* =============== drawing =============== */
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function setStroke(color, w = 1.2) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

function drawIsoBlock(x, gy, w, h, P) {
  const dx = 9, dy = -6;
  ctx.fillStyle = P.plate; setStroke(P.mid, 1);
  ctx.beginPath(); // front
  ctx.moveTo(x - w / 2, gy); ctx.lineTo(x + w / 2, gy); ctx.lineTo(x + w / 2, gy - h); ctx.lineTo(x - w / 2, gy - h); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); // top
  ctx.moveTo(x - w / 2, gy - h); ctx.lineTo(x - w / 2 + dx, gy - h + dy); ctx.lineTo(x + w / 2 + dx, gy - h + dy); ctx.lineTo(x + w / 2, gy - h); ctx.closePath();
  ctx.fill(); setStroke(P.lo, 1); ctx.stroke();
  ctx.beginPath(); // side
  ctx.moveTo(x + w / 2, gy); ctx.lineTo(x + w / 2 + dx, gy + dy); ctx.lineTo(x + w / 2 + dx, gy - h + dy); ctx.lineTo(x + w / 2, gy - h); ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawStick(p, o, P) {
  /* o: {s, facing, color, type, flash, muzzleT, deadT, isHero} */
  ctx.save();
  if (o.deadT > 0) {
    ctx.translate(p.footA.x, p.footA.y);
    ctx.rotate(-o.facing * o.deadT * 1.35);
    ctx.translate(-p.footA.x, -p.footA.y);
    ctx.globalAlpha = 1 - o.deadT * 0.9;
  }
  /* hero shield: a dashed hairline bubble around the figure */
  if (o.shield) {
    setStroke(o.shieldFlash > 0 ? P.hi : P.edge, o.shieldFlash > 0 ? 1.8 : 1.1);
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(p.head.x + 2, (p.head.y + p.footA.y) / 2 - 2, 37 * o.s, 52 * o.s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = o.shieldFlash > 0 ? P.hi : P.edge;
    ctx.font = '700 7.5px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('SHIELD', p.head.x + 2, p.head.y - 56 * o.s);
    ctx.textAlign = 'left';
  }
  const col = o.flash > 0 ? P.accent : o.color;
  setStroke(col, o.flash > 0 ? 1.9 : 1.45);
  /* legs */
  line(p.hip.x, p.hip.y, p.kneeA.x, p.kneeA.y); line(p.kneeA.x, p.kneeA.y, p.footA.x, p.footA.y);
  line(p.hip.x, p.hip.y, p.kneeB.x, p.kneeB.y); line(p.kneeB.x, p.kneeB.y, p.footB.x, p.footB.y);
  /* torso */
  line(p.neck.x, p.neck.y, p.hip.x, p.hip.y);
  /* back arm */
  line(p.shoulder.x, p.shoulder.y, p.backHand.x, p.backHand.y);
  /* gun arm + rifle */
  line(p.shoulder.x, p.shoulder.y, p.hand.x, p.hand.y);
  setStroke(o.flash > 0 ? P.accent : P.hi, 1.7);
  line(p.hand.x - (p.muzzle.x - p.hand.x) * 0.25, p.hand.y - (p.muzzle.y - p.hand.y) * 0.25, p.muzzle.x, p.muzzle.y);
  line(p.muzzle.x, p.muzzle.y, p.muzzle.x, p.muzzle.y - 4 * o.s); // sight tick
  /* head */
  setStroke(col, 1.45);
  ctx.beginPath(); ctx.arc(p.head.x, p.head.y, p.hr, 0, Math.PI * 2); ctx.stroke();
  /* eye — looks down the aim */
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(p.head.x + o.facing * 3.6 * o.s, p.head.y - 1, 1.15, 0, Math.PI * 2); ctx.fill();
  /* adornments by kind */
  setStroke(col, 1.25);
  if (o.isHero) {           /* hero: headband + tail */
    line(p.head.x - p.hr, p.head.y - 2.5 * o.s, p.head.x + p.hr, p.head.y - 2.5 * o.s);
    line(p.head.x - p.hr, p.head.y - 2.5 * o.s, p.head.x - p.hr - 6 * o.s, p.head.y + 1);
  } else if (o.type === 'runner') {  /* antenna + dot */
    line(p.head.x, p.head.y - p.hr, p.head.x + 4 * o.s, p.head.y - p.hr - 8 * o.s);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.head.x + 4.5 * o.s, p.head.y - p.hr - 9 * o.s, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (o.type === 'brute') {   /* horns + shoulder plate */
    line(p.head.x - 4 * o.s, p.head.y - p.hr + 1, p.head.x - 10 * o.s, p.head.y - p.hr - 5 * o.s);
    line(p.head.x + 4 * o.s, p.head.y - p.hr + 1, p.head.x + 10 * o.s, p.head.y - p.hr - 5 * o.s);
    line(p.shoulder.x - 9 * o.s, p.shoulder.y - 4 * o.s, p.shoulder.x + 9 * o.s, p.shoulder.y - 4 * o.s);
  } else {                            /* walker: single horn */
    line(p.head.x + 2 * o.s, p.head.y - p.hr + 1, p.head.x + 7 * o.s, p.head.y - p.hr - 6 * o.s);
  }
  /* muzzle flash */
  if (o.muzzleT > 0) {
    setStroke(P.hi, 1.3);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, r = 7 * o.s;
      line(p.muzzle.x, p.muzzle.y, p.muzzle.x + Math.cos(a) * r, p.muzzle.y + Math.sin(a) * r);
    }
  }
  ctx.restore();
  return p;
}

/* ── word bubbles: the ACTIVE bubble is laid out first and drawn last,
      so it always sits on top; colliding bubbles are stacked upward
      out of its way instead of covering it. ─────────────────────────── */
const bubbleFont = e => `600 ${e.isLine ? 13 : 15}px ui-monospace, Menlo, Consolas, monospace`;
function bubbleRectFor(e) {
  ctx.font = bubbleFont(e);
  const charW = ctx.measureText('M').width + 1.5;
  const bw = charW * e.word.length + 20, bh = 27;
  return { bx: clamp(e.x - bw / 2, 8, W - bw - 8), by: e.gy - 96 * e.s, bw, bh, charW };
}
function layoutBubbles(target) {
  const placed = [], rects = new Map();
  const ordered = aliveEnemies()
    .sort((a, b) => ((b === target) - (a === target)) || (a.x - b.x)); // target first, then nearest
  for (const e of ordered) {
    const r = bubbleRectFor(e);
    let guard = 0;
    const hits = () => placed.some(q =>
      r.bx < q.bx + q.bw + 5 && r.bx + r.bw + 5 > q.bx && r.by < q.by + q.bh + 9 && r.by + r.bh + 9 > q.by);
    while (hits() && r.by > 8 && guard++ < 8) r.by -= r.bh + 7;   // step up a row
    if (r.by < 8) r.by = 8;
    placed.push(r); rects.set(e.id, r);
  }
  return rects;
}

function drawWordBubble(e, isTarget, P, rect) {
  const s = e.s;
  ctx.save();
  ctx.font = bubbleFont(e);
  if (e.isLine) { ctx.fillStyle = P.edge; ctx.font = '700 7.5px ui-monospace, monospace'; ctx.fillText('— LINE —', rect.bx + 3, rect.by - 5); ctx.font = bubbleFont(e); }
  const { bw, bh, charW } = rect;
  let bx = rect.bx; const by = rect.by;
  if (e.shakeT > 0) bx += rand(-2.5, 2.5);
  /* tail — from the bubble's underside to the head */
  setStroke(isTarget ? P.hi : P.edge, 1);
  ctx.setLineDash([2, 3]);
  line(clamp(e.x, bx + 10, bx + bw - 10), by + bh, e.x, e.gy - 70 * s);
  ctx.setLineDash([]);
  /* target gets an offset plate under it, so it reads as lifted/on top */
  if (isTarget) {
    ctx.fillStyle = P.lo; ctx.strokeStyle = P.edge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx + 3, by + 3, bw, bh, 6); ctx.fill(); ctx.stroke();
  }
  /* plate */
  ctx.fillStyle = P.plate;
  ctx.strokeStyle = e.flashT > 0 ? P.accent : (isTarget ? P.hi : P.edge);
  ctx.lineWidth = isTarget ? 1.5 : 1;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
  /* letters */
  let cx = bx + 10;
  for (let i = 0; i < e.word.length; i++) {
    const ch = e.word[i];
    const wrong = i < e.progress && e.marks[i] === false;
    if (wrong) { ctx.fillStyle = P.accent; }
    else if (i < e.progress) { ctx.fillStyle = P.mid; }
    else if (i === e.progress && isTarget) { ctx.fillStyle = P.hi; }
    else { ctx.fillStyle = P.hi; ctx.globalAlpha = isTarget ? 0.85 : 0.5; }
    ctx.fillText(ch, cx, by + 18.5);
    ctx.globalAlpha = 1;
    if (i < e.progress) { setStroke(wrong ? P.accent : P.mid, 1); line(cx, by + 14, cx + charW - 3, by + 14); }
    if (i === e.progress && isTarget) { setStroke(P.hi, 2); line(cx, by + 22.5, cx + charW - 3, by + 22.5); }
    cx += charW;
  }
  /* hp hairline under bubble = remaining letters */
  const remain = (e.word.length - e.progress) / e.word.length;
  setStroke(P.lo, 3); line(bx + 3, by + bh + 4.5, bx + bw - 3, by + bh + 4.5);
  setStroke(e.flashT > 0 ? P.accent : P.hi, 3); line(bx + 3, by + bh + 4.5, bx + 3 + (bw - 6) * remain, by + bh + 4.5);
  ctx.restore();
}

function draw() {
  const P = palette();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = P.plate; ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 4, rand(-1, 1) * G.shake * 3);

  /* faint dot grid, hairline phosphor-style */
  ctx.fillStyle = P.lo;
  for (let gx = 46; gx < W - 20; gx += 46) for (let gy = 44; gy < 268; gy += 46) {
    ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
  }

  /* background pillars */
  for (const pl of PILLARS) drawIsoBlock(pl.x, pl.gy, pl.w, pl.h, P);

  /* ground: main hairline + isometric ticks */
  setStroke(P.edge, 1.2); line(34, 352, W - 30, 352);
  setStroke(P.lo, 1);
  for (let x = 60; x < W - 40; x += 44) line(x, 352, x - 15, 367);
  setStroke(P.mid, 1); ctx.setLineDash([1, 4]); line(34, 374, W - 30, 374); ctx.setLineDash([]);

  /* hero plinth */
  ctx.fillStyle = P.plate; setStroke(P.edge, 1.1);
  ctx.beginPath();
  ctx.moveTo(HERO_X - 52, 368); ctx.lineTo(HERO_X + 58, 368); ctx.lineTo(HERO_X + 44, 352); ctx.lineTo(HERO_X - 38, 352); ctx.closePath();
  ctx.fill(); ctx.stroke();
  /* firing-line marker */
  setStroke(P.accent, 1); ctx.setLineDash([3, 5]);
  line(LINE_X, 300, LINE_X, 372); ctx.setLineDash([]);
  ctx.fillStyle = P.accent; ctx.font = '9px ui-monospace, monospace';
  ctx.fillText('THE LINE', LINE_X - 18, 292);

  const target = getTarget();

  /* dashed sight-line hero → target */
  if (target && (G.mode === 'playing' || G.mode === 'dying')) {
    const hp = heroPose();
    setStroke(P.edge, 1); ctx.setLineDash([2, 6]);
    line(hp.muzzle.x, hp.muzzle.y, target.x, target.gy - 42 * target.s);
    ctx.setLineDash([]);
    /* target ground ring */
    setStroke(P.hi, 1.1); ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.ellipse(target.x, target.gy + 5, 20 * target.s, 6 * target.s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  /* figures, painted back-to-front by lane */
  const drawList = [...G.enemies].sort((a, b) => a.gy - b.gy);
  let heroDrawn = false;
  const maybeHero = (beforeGy) => {
    if (!heroDrawn && HERO_GY <= beforeGy) {
      const p = heroPose();
      drawStick(p, { s: 1.06, facing: 1, color: G.hero.hurtT > 0 ? P.accent : P.hi, type: 'hero', isHero: true, flash: G.hero.flashT, muzzleT: G.hero.muzzleT, deadT: G.hero.deadT, shield: G.shield.active, shieldFlash: G.shield.flashT }, P);
      heroDrawn = true;
    }
  };
  for (const e of drawList) {
    maybeHero(e.gy);
    const p = enemyPose(e);
    const isT = target === e;
    drawStick(p, {
      s: e.s, facing: -1, type: e.type,
      color: e.state === 'dying' ? P.edge : (isT ? P.hi : P.edge),
      flash: e.flashT, muzzleT: e.muzzleT, deadT: e.state === 'dying' ? e.deathT : 0,
    }, P);
  }
  maybeHero(Infinity);

  /* word bubbles on top of everything — non-targets first, the ACTIVE
     bubble drawn last (top of the stack), over anything still near it */
  const bubbleRects = layoutBubbles(target);
  const bubbleOrder = aliveEnemies().sort((a, b) => (a === target) - (b === target));
  for (const e of bubbleOrder) drawWordBubble(e, target === e, P, bubbleRects.get(e.id));

  /* bullets */
  for (const b of G.bullets) {
    const isHero = b.from === 'hero';
    setStroke(isHero ? P.hi : P.accent, isHero ? 1.4 : 1.6);
    for (let i = 1; i < b.trail.length; i++) {
      ctx.globalAlpha = i / b.trail.length * 0.4;
      line(b.trail[i - 1].x, b.trail[i - 1].y, b.trail[i].x, b.trail[i].y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = isHero ? P.hi : P.accent;
    ctx.beginPath(); ctx.arc(b.x, b.y, isHero ? 2.1 : 2.5, 0, Math.PI * 2); ctx.fill();
    if (isHero && b.ch) {
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillStyle = P.hi;
      ctx.fillText(b.ch, b.x - 3, b.y - 8);
    }
  }

  /* particles: little hairline shards */
  for (const p of G.particles) {
    const a = Math.atan2(p.vy, p.vx), lifeK = 1 - p.life / p.max;
    setStroke(p.accent ? P.accent : P.hi, 1.2);
    ctx.globalAlpha = lifeK;
    line(p.x, p.y, p.x - Math.cos(a) * p.len, p.y - Math.sin(a) * p.len);
    ctx.globalAlpha = 1;
  }

  /* floating score text */
  ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = 1 - f.life / 1.05;
    ctx.fillStyle = f.kind === 'bad' ? P.accent : P.hi;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';

  /* menu-mode caption on the plate */
  if (G.mode === 'menu') {
    ctx.fillStyle = P.edge; ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('fig. 01 — hero at rest · press START, then type', 40, 404);
  }
  ctx.restore();
}

/* =============== HUD / DOM sync =============== */
let feedbackTimer = 0;
function setFeedback(html, kind = '') {
  feedbackEl.innerHTML = html;
  feedbackEl.className = 'console-feedback mono ' + kind;
  clearTimeout(feedbackTimer);
  if (kind) feedbackTimer = setTimeout(() => { feedbackEl.className = 'console-feedback mono'; }, 2600);
}
function syncHud() {
  const hp = G.hero.hp;
  hpFill.style.width = hp + '%';
  hpFill.classList.toggle('low', hp <= 30);
  hpText.textContent = hp;
  hpBarWrap.setAttribute('aria-valuenow', hp);
  hudScore.textContent = G.score.toLocaleString();
  hudWave.textContent = G.mode === 'menu' ? '—' : G.wave;
  hudKills.textContent = G.kills;
  hudAcc.textContent = G.total ? Math.round(G.correct / G.total * 100) + '%' : '100%';
  const mins = G.runTime / 60;
  hudWpm.textContent = mins > 0.04 ? Math.round((G.correct / 5) / mins) : 0;
  const mult = 1 + Math.floor(G.streak / 12);
  hudStreak.textContent = `×${G.streak}${mult > 1 ? ` · ${mult}× pts` : ''}`;
  shieldStatusEl.textContent = G.shield.active
    ? 'SHIELD UP · falls on a typo'
    : `◇ SHIELD OFF · clean words ${Math.min(G.shield.cleanWords, 2)}/2`;
  shieldStatusEl.classList.toggle('on', G.shield.active);
  const t = getTarget();
  readoutEl.textContent = G.mode === 'playing' && t
    ? `${t.isLine ? 'line' : 'target'} “${t.word}” · ${t.progress}/${t.word.length} · wave ${G.wave}`
    : G.mode === 'playing' ? `waiting for the next word · wave ${G.wave}`
    : G.mode === 'paused' ? 'paused' : G.mode === 'over' ? 'hero down' : 'rest';
}
function renderTargetWord() {
  const t = getTarget();
  if (!t) { targetWordEl.classList.remove('phrase'); targetWordEl.innerHTML = '<span class="tw-empty">— waiting for the next word —</span>'; syncHud(); return; }
  targetWordEl.classList.toggle('phrase', !!t.isLine);
  targetWordEl.innerHTML = [...t.word].map((ch, i) => {
    const glyph = ch === ' ' ? '␣' : ch;              // spaces are typed too — show them
    return i < t.progress ? `<span class="${t.marks[i] === false ? 'wronged' : 'done'}">${glyph}</span>`
      : i === t.progress ? `<span class="cur">${glyph}</span>`
      : `<span class="todo">${glyph}</span>`;
  }).join('');
  syncHud();
}

/* =============== flow =============== */
function startGame() {
  G = freshState();
  G.mode = 'playing';
  menuEl.hidden = true; overEl.hidden = true; pauseEl.hidden = true;
  btnPause.disabled = false; btnPause.textContent = 'Ⅱ PAUSE';
  G.spawnT = 2.4;                          // breathing room before the third walker
  spawnEnemy(); spawnEnemy();
  G.enemies[1].x = W + 260;               // stagger the second walker
  waveBanner.textContent = 'WAVE 1'; waveBanner.hidden = false;
  setTimeout(() => { waveBanner.hidden = true; }, 1850);
  setFeedback('type straight through the <b>current word</b> — wrong letters count, but never block you.', 'good');
  audio(); SFX.wave();
  renderTargetWord(); syncHud();
}
function gameOver() {
  G.mode = 'over';
  btnPause.disabled = true;
  const acc = G.total ? Math.round(G.correct / G.total * 100) : 100;
  const mins = G.runTime / 60, wpm = mins > 0.04 ? Math.round((G.correct / 5) / mins) : 0;
  $('finalStats').innerHTML = `
    <div><span class="cap">Score</span><b>${G.score.toLocaleString()}</b></div>
    <div><span class="cap">Enemies down</span><b>${G.kills}</b></div>
    <div><span class="cap">Wave reached</span><b>${G.wave}</b></div>
    <div><span class="cap">Accuracy</span><b>${acc}%</b></div>
    <div><span class="cap">Speed</span><b>${wpm} wpm</b></div>
    <div><span class="cap">Best streak</span><b>×${G.bestStreak}</b></div>`;
  overEl.hidden = false;
  setFeedback('the hero is down — press <b>PLAY AGAIN</b> or <kbd>Enter</kbd>', 'bad');
}
function togglePause(force) {
  if (G.mode === 'playing' || (force === true && G.mode === 'paused')) {
    if (G.mode === 'playing') { G.mode = 'paused'; pauseEl.hidden = false; btnPause.textContent = '▶ RESUME'; }
  } else if (G.mode === 'paused') {
    G.mode = 'playing'; pauseEl.hidden = true; btnPause.textContent = 'Ⅱ PAUSE';
  }
  syncHud();
}

/* help panel: opening it mid-run pauses; closing resumes if it paused us */
let helpOpen = false, helpPausedGame = false;
function openHelp() {
  if (helpOpen) return;
  helpOpen = true;
  helpPausedGame = G.mode === 'playing';
  if (helpPausedGame) togglePause();
  helpPanel.hidden = false; helpBackdrop.hidden = false;
  btnHelp.setAttribute('aria-expanded', 'true');
  $('btnHelpClose').focus({ preventScroll: true });
}
function closeHelp() {
  if (!helpOpen) return;
  helpOpen = false;
  helpPanel.hidden = true; helpBackdrop.hidden = true;
  btnHelp.setAttribute('aria-expanded', 'false');
  if (helpPausedGame && G.mode === 'paused') togglePause();
  helpPausedGame = false;
  btnHelp.focus({ preventScroll: true });
}

/* =============== main loop =============== */
function frame(ts) {
  const dt = Math.min(0.05, G.lastTs ? (ts - G.lastTs) / 1000 : 0.016);
  G.lastTs = ts;
  if (G.mode !== 'paused') update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => { if (G.mode === 'playing') syncHud(); }, 400);

/* =============== input =============== */
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (helpOpen) { e.preventDefault(); closeHelp(); return; }
    if (G.mode === 'playing' || G.mode === 'paused') { e.preventDefault(); togglePause(); }
    return;
  }
  if (helpOpen) return;
  if (e.key === 'Enter') {
    if (G.mode === 'menu') { e.preventDefault(); startGame(); }
    else if (G.mode === 'over') { e.preventDefault(); startGame(); }
    return;
  }
  if (G.mode !== 'playing') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.activeElement === mobileInput) return;   // the input event handles it
  if (e.key.length === 1 && /[a-zA-Z ]/.test(e.key)) { e.preventDefault(); handleChar(e.key); }
});
mobileInput.addEventListener('input', () => {
  const v = mobileInput.value;
  mobileInput.value = '';
  for (const ch of v) handleChar(ch);
});
window.addEventListener('blur', () => { if (G.mode === 'playing') togglePause(); });

btnHelp.addEventListener('click', openHelp);
$('btnHelpClose').addEventListener('click', closeHelp);
helpBackdrop.addEventListener('click', closeHelp);
$('btnStart').addEventListener('click', startGame);
$('btnAgain').addEventListener('click', startGame);
$('btnResume').addEventListener('click', () => togglePause());
btnPause.addEventListener('click', () => { if (G.mode === 'playing' || G.mode === 'paused') togglePause(); });
$('btnRestart').addEventListener('click', startGame);
btnSound.addEventListener('click', e => {
  setSound(!soundOn);
  e.currentTarget.blur();   /* never leave the toggle focused: Space/Enter
                               during play must not flip it back by accident */
});
/* dark mode (the hairline dark plate), remembered between visits */
const btnTheme = $('btnTheme');
function renderThemeButton() {
  const dark = document.body.classList.contains('dark-plate');
  btnTheme.textContent = dark ? '☀ LIGHT MODE' : '☾ DARK MODE';
  btnTheme.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btnTheme.setAttribute('aria-pressed', String(dark));
}
try { if (localStorage.getItem('hairline-type-defense-theme') === 'dark') document.body.classList.add('dark-plate'); } catch { /* ignore */ }
renderThemeButton();
btnTheme.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark-plate');
  try { localStorage.setItem('hairline-type-defense-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  renderThemeButton();
});
$('btnKeyboard').addEventListener('click', () => {
  if (G.mode === 'menu' || G.mode === 'over') startGame();
  mobileInput.classList.add('live');
  mobileInput.focus({ preventScroll: true });
});

/* no button keeps focus after a click, so Space/Enter while playing
   can never re-trigger a toolbar control (the old stray-toggle bug) */
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));

renderSoundButton();
renderTargetWord(); syncHud();
})();
