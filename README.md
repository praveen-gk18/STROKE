# Stroke — Tactile Learning Arcade

**Live:** https://stroke-f4op.onrender.com  
**Health:** https://stroke-f4op.onrender.com/api/health  
**Repo:** https://github.com/praveen-gk18/STROKE. (two dots intentional, GitHub also serves as `/STROKE`)

Stroke is a discovery-first, adaptive learning game for Maths, Science, and Coding. It runs entirely in the browser with no sign-in required, and offers optional cloud sync via a private recovery key (no OAuth, no passwords stored server-side). The site is a static HTML/CSS/JS arcade with a tiny Node.js API that serves the game and syncs progress.

> **Design:** Deep navy `#101b29`, cream `#f6f2e6`, mint `#adf075`, yellow `#f4d36c`, coral `#ff9e9c`, lavender `#b8a4ef`, sky `#90cce9`. Thick 3px borders, hard 6-10px offset shadows, rounded 20-28px corners, bold editorial typography. No glassmorphism, no blur panels. Tabs for subjects to reduce congestion, 3D canvases render in front of UI with Front toggle.

---

## ✨ Features

### Learning Experience
- **Discovery-first onboarding:** 3-step intro, placement optional to start
- **Adaptive quests:** Maths (algebra, geometry, calculus, statistics, trigonometry), Science (physics, chemistry, biology, astronomy), Coding (basics, algorithms, data structures) – difficulty adjusts to level
- **Per-topic progress:** level, XP, completed count, progress rings
- **Placement questions:** 4 quick questions to set starting level, skippable
- **Game mechanics:** XP, streaks (daily), hearts (lose on wrong, regen), coins, mistake notebook (last 100), flashcards (auto from correct answers), analytics (total, correct %, by topic, daily)

### Maths
- **Graph Visualizer:** Type any JS expression `Math.sin(x)`, `x*x`, `Math.log(Math.abs(x)+1)` – canvas 2D grid, axes, live plot, range controls
- **Interactive models:** Pythagoras visual proof (sliders a/b), Unit Circle & Sine Wave (theta slider), Quadratic Explorer (a/b/c), Derivative Visualizer (f and f')

### Science – Three.js Labs
- **Periodic Table:** 118 elements from `public/data/elements.json`, colour-coded by category, keyboard accessible, click → atom viewer
- **Atom Viewer:** Three.js nucleus + electron shells (2,8,18,32...), orbiting electrons, OrbitControls (drag orbit, scroll zoom), ResizeObserver, Reload 3D & Front toggle (pushes UI to back, 3D to front z-index 9999)
- **Molecule Explorer:** Water, Methane, CO2, Benzene, DNA fragment – spheres + cylinders, spin toggle, explode/assemble, orbit
- **Solar System Explorer:** 8 planets scaled, sun + stars + orbit lines, planet select, toggle orbits, gravity lab (F=G*m1*m2/r², jump height ∝1/g), rocket launch lab (fuel, thrust, escape velocity), orbit comparison chart (log period vs distance), planet missions

### Coding
- **Code Arena:** 5 missions (Hello, Sum Array, FizzBuzz, Orbit Period, Prime Check), starter code, hints, difficulty badges, runs in **time-limited Web Worker** (2s timeout, no DOM), test results, XP/coins on pass, Reload button

### Hub Previews
- 3 playable previews in Explore tab: Graph, Atom (2D canvas), Code (console.log) – try before committing

### Sync & PWA
- **Opt-in cloud sync:** Manage sync → Generate cryptographically random recovery key (`stroke_` + 32 bytes base64url, 256-bit), copy, restore on another device, warning that anyone with key can access progress
- **API:** Same-origin relative `/api`, no localhost calls from hosted site, 409 on stale revision to avoid overwriting newer cloud progress
- **PWA:** `manifest.webmanifest`, `sw.js` caches static assets, **does NOT cache `/api`** (network-only, no-store), installable, offline

### UX – Arcade
- Tabs: Explore, Maths, Science, Coding, Labs – reduces congestion
- Thick borders, hard shadows, colour-blocked cards (cream/mint/yellow/coral/lavender/sky)
- Hover lifts -2px, pressed +2px, focus 4px solid sky, loading spinner, success mint, error coral
- `prefers-reduced-motion` disables transitions, high-contrast AAA (cream on navy 15:1), keyboard accessible, skip-link

---

## 🧱 Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| **Runtime** | Node.js 20+ (ESM) | Required, modern |
| **Server** | Express 4.21 | Static serve + API, minimal |
| **DB** | PostgreSQL via `pg` 8.13 + file fallback `server/data/progress.json` | Production needs persistent storage, dev uses file |
| **Frontend** | Vanilla HTML/CSS/JS, no build step | Fast, no bundler, same-origin |
| **3D** | Three.js 0.160.0 vendored `public/vendor/three.module.js` + OrbitControls | Local, no CDN, MIT |
| **Code Execution** | Web Worker + Blob URL | Safe, time-limited |
| **PWA** | Service Worker + Web Manifest | Offline, installable |
| **Testing** | `node --test` | Built-in, no extra deps |
| **Deploy** | Render Blueprint `render.yaml` (web + db) | IaC, auto DATABASE_URL injection |

**No frontend build step** – `public/` is served as-is.

---

## 🏗 Architecture

```
Browser (public/)
  ├─ index.html – hero, tabs-bar, layout (left/main/right), modals
  ├─ css/main.css – arcade system: navy/cream/mint/yellow/coral/lavender/sky, thick borders, hard shadows
  ├─ css/sync.css – sync UI arcade
  ├─ js/app.js – progress (localStorage), onboarding, hubs/topics/quests, XP/streak/hearts/coins, tabs lazy-init, sync UI
  ├─ js/sync.js – recovery key gen (crypto.getRandomValues), apiGet/PutProgress (relative /api), 409 handling, UI
  ├─ js/maths.js – graph visualizer (canvas 2D), interactive models
  ├─ js/science.js – periodic table, atom/molecule/solar Three.js, WebGL check, waitForVisible, ResizeObserver, Front toggle
  ├─ js/codeArena.js – missions, Worker creation, tests
  ├─ data/elements.json – 118 elements + LICENSE
  └─ vendor/three.module.js + OrbitControls.js + THREE-LICENSE

Server (server/)
  ├─ index.js – Express: json limit 300kb, GET /api/health (no-store), auth middleware Bearer, GET/PUT /api/progress, static public/, fallback index.html
  └─ storage.js – hashRecoveryKey SHA-256, getStorageType, initStorage (requires DATABASE_URL in production), getProgressByHash, saveProgressByHash with optimistic concurrency (expRev 0 creates rev 1, else check curRev, 409 on stale), file fallback with atomic write, _clearAllForTests

Infra
  ├─ render.yaml – web service stroke-web (build npm ci, start npm start, health /api/health, NODE_ENV=production, DATABASE_URL fromDatabase stroke-db) + database stroke-db
  └─ package.json – engines node >=20, scripts start/dev/test
```

**Request flow:**
1. Browser loads `/` → Express serves `public/index.html`
2. `app.js` loads progress from `localStorage` (migrates from legacy keys `learnquest_progress`)
3. User plays → `saveProgress()` → localStorage + debounced `Sync.push()` if enabled
4. `Sync.push()` → `PUT /api/progress` with `Authorization: Bearer <key>` + `{data, revision}`
5. Server hashes key `SHA-256`, checks `progress` table/file, compares revision, returns new revision or 409
6. Other device → `GET /api/progress` with same key → receives data+revision → replaces local
7. Service Worker intercepts fetch: `/api/*` → network-only, no cache; static → cache-first

**Storage abstraction:**
- If `DATABASE_URL` set → `pg Pool`, `CREATE TABLE IF NOT EXISTS progress(key_hash PK, data JSONB, revision INT, updated_at TIMESTAMPTZ)`, `FOR UPDATE` lock for concurrency
- Else → `server/data/progress.json` (ignored by Git), atomic write via tmp+rename
- Production: `NODE_ENV=production` without `DATABASE_URL` → `throw` and `process.exit(1)` – prevents ephemeral disk use

---

## 📁 File Structure

```
public/index.html
public/css/main.css          # arcade redesign, tabs, z-index front logic
public/css/sync.css
public/js/app.js             # main game + tabs + lazy 3D init
public/js/sync.js            # cloud sync
public/js/maths.js           # graph + models
public/js/science.js         # periodic + atom + molecule + solar (robust)
public/js/codeArena.js       # runnable missions
public/data/elements.json    # 118 elements
public/data/LICENSE
public/vendor/three.module.js
public/vendor/OrbitControls.js
public/vendor/THREE-LICENSE
public/manifest.webmanifest
public/sw.js                 # no /api cache
server/index.js
server/storage.js
server/storage.test.js
render.yaml
package.json
package-lock.json
.gitignore
README.md
```

---

## 🔌 Backend API

- `GET /api/health` → `{status:'ok', storage:'postgres'|'file', timestamp, uptime, version}` – `Cache-Control: no-store`
- `GET /api/progress` – Requires `Authorization: Bearer <recovery-key>` – 401 if missing/invalid, 404 if none, 200 `{data, revision, updatedAt}` – no-store
- `PUT /api/progress` – Requires Bearer, body `{data: object, revision: number}` – validates shape, size ~250KB, 400 on invalid, 413 if >300kb, 409 `{error, currentRevision, currentData}` on stale, 200 `{ok, revision: newRev}` – no-store, stores only SHA-256 hash

**Auth:** `hashRecoveryKey(key)` → hex SHA-256, server never stores raw key.

**Concurrency:** Optimistic – client sends expected revision, server checks `currentRevision === expected`, else 409. Creation requires `revision 0` or undefined → creates rev 1.

---

## 🔄 Frontend Sync

- Local-first: game works without sign-in, progress in `localStorage` (`stroke_progress` + legacy `learnquest_progress`)
- Opt-in: Manage sync → `generateRecoveryKey()` → 32 random bytes → base64url → `stroke_...` → stored in `localStorage`
- Push: `Sync.push(localData)` → `PUT` with stored revision
- Pull: `Sync.pull()` → `GET` → if remote rev > local, shows conflict UI – never silently overwrites newer cloud progress
- Restore: paste key on other device → `apiGetProgress(key)` → preview → apply → replaces local
- Relative URLs: `fetch('/api/progress')`, never localhost
- Warning: "Anyone with key can access that learner's progress. Treat like password."

---

## 🎮 Game Design

- Onboarding: discovery-first, 3 steps, placement optional (4 questions)
- Adaptive: level = floor(xp/50)+1 per topic, quests rotate
- Confidence: low/mid/high buttons stored in analytics
- Hearts: -1 on wrong, regen after 5s if 0
- Coins: +2 on correct, +5 on code mission
- Mistake notebook + flashcards auto, 100 max, click to reveal
- Analytics: total, correct %, by topic, daily

---

## 🧪 Three.js Labs – Robustness

- `isWebGLAvailable()` check – fallback 2D canvas if no WebGL
- `waitForVisible(el)` – waits up to 2.5s for tab to become visible before creating renderer (fixes blank when hidden)
- `ResizeObserver` + `window resize` → `renderer.setSize`, `camera.aspect`
- Front toggle: `.canvas-wrap.front` z-index 9999, dims other cards `.front-behind`
- Reload 3D buttons for atom/molecule/solar – destroys and re-inits
- OrbitControls optional – try/catch, still renders without

---

## 💻 Code Arena

- Missions: hello, sum, fizzbuzz, orbit, prime – prompt, starter, tests, hint
- Worker: `new Blob([workerCode])` → `URL.createObjectURL` → `new Worker`, 2s timeout, `onmessage` results, `onerror`
- Checks: `JSON.stringify` or custom `check` function

---

## 📱 PWA

- `manifest.webmanifest` – name Stroke, start_url /, standalone, icons data URI
- `sw.js` – `CACHE_NAME stroke-v2`, `STATIC_ASSETS` list, install → cache, activate → delete old, fetch → if `/api/` → network-only 503 fallback, else cache-first then network, navigate fallback to `/index.html`

---

## 💻 Run Locally

Requires Node 20+

```bash
npm ci
npm start
# open http://localhost:3000
# live: https://stroke-f4op.onrender.com
```

To use Postgres locally:
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/stroke npm start
```

Tests:
```bash
npm test
# 8 tests: hash, null, create rev 0→1, update, 409 stale, validation, undefined rev, production requires DB
```

---

## 🚀 Deploy to Render – Live

**Live:** https://stroke-f4op.onrender.com

1. Push to GitHub `praveen-gk18/STROKE.` (two dots)
2. Render → New → Blueprint → connect repo → select `render.yaml`
3. Review plans: web Starter $7/mo (no sleep) or Free (sleeps 15min), DB Free expires 90 days or Basic $7/mo
4. Apply – creates `stroke-db` + `stroke-web`, injects `DATABASE_URL`
5. If you see `DATABASE_URL is required in production`:
   - Dashboard → PostgreSQL → ensure Available
   - Web Service → Environment → Add from database → select `stroke-db` → key `DATABASE_URL` → Save → Manual Deploy
6. Verify `/api/health` → `{"status":"ok","storage":"postgres"}`
7. In app → Manage sync → Enable cloud save → copy key → restore on other device

Render auto-deploys on push to `main` if enabled.

---

## 🔒 Security & Privacy

- Only SHA-256 hash stored server-side, never raw key
- 300kb body limit, payload validation, 409 prevents silent overwrite
- No secrets in Git, `DATABASE_URL` from Render env
- Recovery key = password – anyone with it can read/replace progress – not for sensitive school records without proper auth, consent, retention, backups
- Service worker does NOT cache `/api`

---

## ⚡ Performance & Accessibility

- No build step, static assets cached by SW
- Three.js vendored 1.3MB, loaded via dynamic import only when tab visible
- `prefers-reduced-motion` disables animations, `prefers-contrast: more` thickens borders
- Keyboard: skip-link, tablist Arrow keys, Enter/Space on hubs/topics/flashcards, focus-visible 4px sky
- High-contrast: cream #f6f2e6 on navy #101b29 15:1 AAA
- Responsive: hero 2col→1col, layout 3col→2col→1col, tabs wrap, periodic table scrollable

---

## 🗺 Roadmap

- Add more quests per topic
- Add real auth (optional) + sharing
- Add persistent file storage for exports
- Add more molecules + solar missions
- Add sound toggle (respects reduced-motion)

---

## 📜 Licenses

- Three.js MIT – `public/vendor/THREE-LICENSE`
- Element data: public domain facts + custom JSON compilation MIT – `public/data/LICENSE`
- Code: MIT (unless otherwise noted)

**Product name:** Stroke – some older localStorage keys retain earlier names (`learnquest_progress`) for compatibility.
