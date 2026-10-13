# HAIRLINE — Type Defense

A stick-figure typing shooter drawn in the illustration language of
[lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) — isometric
line figures on a plate, drawn with the hairline palette
(`plate · hi · edge · mid · lo`), a ~0.9px stroke, plates filled, figures made
of lines only. One accent colour (red) is added, for incoming damage only.

![style: light plate, hairline strokes, stick hero vs. word-carrying enemies]

## The game (v0.1 — core loop)

- Enemies (**runner / walker / brute**) march in from the right, each with a
  **word over its head**. There is always a **current word** (in the TARGET
  box): normally the nearest enemy's — at the start of a word, typing
  another enemy's first letter makes that word current instead. Your
  current target is drawn in the darkest ink, with a dashed sight-line from
  the hero's rifle and a dashed ring under its feet. **Its bubble is laid
  out first and drawn last — always on top**; any bubble that would cover
  it is stacked a row upward, and the same word is mirrored in the console
  below the battlefield.
- The page itself is kept minimal: top bar, HUD, battlefield, typing console.
  Everything explanatory — how to play, enemy legend, controls, credit —
  lives behind the **? HELP** tab in the top bar (opening it mid-run pauses;
  closing resumes).
- **Type the word — the stream never halts.** Every key is judged against
  the active word's next position and *consumes* it: a **correct letter**
  makes the hero fire (the letter rides the bullet, hits, greys out,
  1 damage); a **wrong letter** is marked red and the enemy fires back,
  but play moves straight to the next letter. So `apple` typed as `appel`
  is `app` = 3 hits + 2 misses, word finished. This includes the first
  letter: for current word `zephyr`, typing `g` marks position 1 wrong
  and moves the cursor to `e` — it never waits for the correct letter.
- **Finish the word → the enemy falls** (score bonus, shard burst, fall
  animation). Each enemy shot that lands costs the hero **8 HP** and
  resets the streak.
- An enemy that reaches **THE LINE** stops there and keeps shooting the hero.
- **Clean-word heal & shield:** every word finished **with no typo** heals
  the hero **+2 HP** (capped at 100). Finish **two in a row** and a shield rises
  around the hero (HUD: `SHIELD UP · falls on a typo`). While up, enemy
  shots are blocked for **0 HP**. The **first typo brings it down**
  immediately; earn it again with two more clean words.
- **Lines:** from wave 3 (or 75 s in), some walkers/brutes carry a simple
  **line** instead of a word (`— LINE —` tag, slower walk). Type the whole
  line — **spaces are characters too**, shown as `␣` in the console.
- **Waves:** every 8 kills starts a new wave — faster feet, faster spawns,
  longer words, more brutes. Score has a streak multiplier (every 12-streak
  raises it). HUD tracks HP, score, wave, kills, accuracy, WPM, streak.
- `Esc` / Pause button pauses · `Enter` starts/restarts · the **⌨ TYPE HERE**
  button opens a touch keyboard for mobile. Sound is tiny WebAudio synth
  (no assets) behind one persistent **♪ SOUND: ON/OFF** switch (saved in
  localStorage; OFF suspends the audio context, so nothing can leak a
  sound). **☾ DARK MODE** toggles the hairline light/dark palettes
  (also remembered).

## Run it

No build step, no dependencies — plain HTML/CSS/canvas JS:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

(or open `index.html` from disk, or use any static server / GitHub Pages.)

## Files

| file | what |
|---|---|
| `index.html` | page, HUD, overlays (menu / pause / game over), how-it-works cards |
| `styles.css` | hairline palette, plate discipline, layout |
| `game.js` | the whole game: word pools, spawning/waves, typing combat, canvas stick-figure renderer, synth SFX |

## Deliberately left open (awaiting the next rules)

Difficulty knobs, enemy behaviours, power-ups/special words, hero abilities,
scoring changes, boss rules… — the loop above is built to be extended.
Tell me the next rules and I'll wire them in.

## Credit

Visual language inspired by **hairline** by Lucas Marques (MIT) —
<https://github.com/lucasmarkes/hairline>. This game re-draws stick figures
in that style by hand on canvas; it does not vendor the hairline library.
