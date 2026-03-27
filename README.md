# Hamester Run (3-lane vertical runner)

## Security / API keys

This game is **static** (HTML, CSS, JavaScript only). **There is no API key in this repo** and nothing to “unlock” in the code.

If you add analytics, a backend, or other services later:

- Keep real keys in **environment variables** or **server-side config**, not in files you commit.
- Use a **`.env`** file locally if a tool needs it; this folder’s **`.gitignore`** ignores `.env` and common credential filenames so they stay off GitHub and out of zip uploads.

Never put private keys in `game.js`, `index.html`, or any file shipped to the browser unless the provider documents it as a **public** client id (still follow their restrictions).

## Run it

Open `index.html` in your browser:

- Finder → `Desktop` → `webgame` → `hamster-runner` → double-click `index.html`

Put your player sprite at **`hamster-runner/art/hamester.png`** (or `art/hamster.png` as a fallback name). Until the image loads, the game draws the simple vector hamster.

Other art in **`hamster-runner/art/`**: `background.png`, `sunflower_seed.png`, `carrot.png`, `popcorn.png`, `meat.png`, `candy.png`, `icecream.png`, `chocolate.png`, `redheart.png`, barriers `rocks.png`, `tree.png`, `bush.png`, `cat.png` (optional; emojis / vector fallback if missing).

### Canvas background (why it might look unchanged)

The game loads the **first file that exists**, in this order: `art/background.png` → `background.jpg` → `background.jpeg` → `background.webp`.

If **none** of those files are in `art/`, you get the **plain dark blue** fallback — that is not a bug in scaling.

- **Name & location**: Same folder as `index.html`: `hamster-runner/art/background.png` (lowercase name avoids issues on Linux servers).
- **Formats**: PNG, JPEG, or WebP are fine.
- **Size / aspect**: The canvas is **420×720** (portrait, ~7∶12). Any resolution works; the image is scaled with **`cover`** (fills the canvas, may crop sides or top/bottom). To show the **whole** image with bars, in `game.js` set `BACKGROUND_FIT` to `"contain"` instead of `"cover"`.
- **Opening as a file**: Use **`http://localhost`** (e.g. `npx serve hamster-runner`) if a browser blocks local images; paths are relative to `index.html`.

## Controls

- Move: Left/Right arrows or A/D
- Pause: Space
- Restart: R
- Mobile: tap left/right side of the game

## Rules

- **10 hearts** (hidden counter — you’ll see **-1** float up when hit); bad items remove **1 heart**; red **heart pickup** restores **1 heart** (not counted toward stage food)
- Good food / heart pickup: short **squash** animation; on damage, **“-1”** floats up from the hamster for about a second
- **10 stages** with different food targets to advance:
  - Stages **1–2**: **10** foods each (10 total → stage 2, 20 total → stage 3)
  - Stages **3–5**: **20** foods each (40 / 60 / 80 total to reach stages 4–6)
  - Stages **6–8**: **40** foods each (120 / 160 / 200 total to reach stages 7–9)
  - Stage **9**: **50** foods ( **250** total → stage 10)
  - Stage **10**: **no food goal** — keep playing until you run out of hearts
- After you complete a stage goal, the game **pauses 3 seconds** with a **3…2…1** countdown, then the next stage begins
- **Barriers** (rock, tree, bush, cat) are outline-only hazards—same damage as other bad items
