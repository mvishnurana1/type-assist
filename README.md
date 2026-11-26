# Type Assist

A small, friendly typing trainer for people who find typing hard. It shows one big character at a time, times how quickly you type it, and keeps a running score.

Built with Next.js (App Router), React and TypeScript.

## Run it

You need [Node.js](https://nodejs.org) 20.9 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To build the static site and preview it locally:

```bash
npm run build     # writes static files to ./out
npm run preview   # serves ./out at http://localhost:3000
```

## Deploy to GitHub Pages

Deployment is automatic. `.github/workflows/deploy.yml` builds the site and publishes it on every push to `main`.

**One-time setup:** on GitHub, go to the repo's **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.

After that:

```bash
git add .
git commit -m "Deploy"
git push
```

Watch progress in the repo's **Actions** tab. You can also redeploy without a new commit: open the **Deploy to GitHub Pages** workflow and click **Run workflow**. The site goes live at:

**https://mvishnurana1.github.io/type-assist/**

The `/type-assist` URL prefix is set automatically from the repo name (via `PAGES_BASE_PATH` in `next.config.ts`). It still works if you rename the repo or add a custom domain.

## Modes

| Mode | Characters | Score multiplier |
|---|---|---|
| **Easy** | Home row letters (A S D F G H J K L) | ×1 |
| **Medium** | All 26 letters | ×1.5 |
| **Hard** | Letters, numbers 0–9 and symbols such as `! @ # $ % ^ & * ( ) - _ = + [ ] { } ; : ' " , . < > / ? \ | ` ~` | ×2 |

In Hard mode, each symbol also shows its name (for example "backtick" or "vertical bar"), so small or look-alike characters are easy to recognise. The guide tells you which Shift key to hold: always the one on the opposite hand from the finger doing the typing.

## How it helps

- **One character at a time:** large and high-contrast, in Atkinson Hyperlegible, a font designed for low-vision readers. The font is bundled with the app, so it works offline.
- **Keyboard guide:** a full on-screen keyboard, colour-coded by finger. It highlights the key to press, plus the Shift key when one is needed, and says which finger to use.
- **Help when you're stuck:** if you hesitate for more than 2.5 seconds or press the wrong key, the right key pulses and the finger hint appears. Turn off *Always show guide* to rely on memory, with this as a safety net.
- **Adaptive practice:** characters you're slow on or tend to miss come up more often. They're listed under the keyboard.
- **Touch friendly:** you can tap the on-screen keys. Tap Shift first for a symbol.

## Scoring

Each correct character earns:

| Part | Points |
|---|---|
| Speed | 100 for 0.3 s or faster, dropping to a minimum of 10 at about 2.7 s. Characters that need Shift get an extra 0.4 s. |
| First-try bonus | Full speed points if you get it right first time, half if you missed first |
| Streak bonus | +2 per character in your current streak, up to +40 |
| Mode multiplier | The total is multiplied by ×1, ×1.5 or ×2 depending on the mode |

The scoreboard also shows the time for your last character, your average time, characters per minute, accuracy and your current streak. Each round ends with a summary of your trouble characters. Your personal best for each mode and round length is saved in your browser.

## Controls

| Key | Action |
|---|---|
| `Space` | Start / pause / resume |
| `Esc` | Pause |
| Any character | Answer. Letters count in upper or lower case; symbols and numbers must match exactly. |

The game also pauses automatically if you switch to another window or tab.

The keyboard guide uses the US QWERTY layout. On other layouts (UK, AZERTY etc.) some symbols are on different keys. The game still accepts whichever key produces the right character.

## Project layout

```
app/
  layout.tsx        root layout, font and metadata
  page.tsx          home page
  globals.css       all styling (light and dark mode, reduced-motion support)
components/
  TypeAssist.tsx    the game screen: scoreboard, modes, character display, summary
  Keyboard.tsx      on-screen keyboard guide
lib/
  game.ts           modes, scoring, adaptive character picking, game reducer (pure)
  keyboard.ts       QWERTY layout, finger map, Shift rules, character names
  storage.ts        settings and personal bests in localStorage
.github/workflows/
  deploy.yml        builds and publishes to GitHub Pages on push to main
```
