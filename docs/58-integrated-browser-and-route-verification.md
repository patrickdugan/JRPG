# 58 — Integrated Browser, Smoke, and Rendered-Control Action Route Verification

- **Verification baseline:** integrated branch commit `b260da2` (merging all 15 remote PRs through `8b7ba54`, `docs/56-staffing-and-contractor-plan.md`, and `jrpg-verifiers-v2`) plus the minimal surgical integration fixes recorded below.
- **Runtime toolchain:** Node `v24.19.0`, Python `3.12.10` (with pinned `Pillow 11.3.0` virtualenv for byte-identical art checks), Playwright + installed Chrome over ephemeral `127.0.0.1:0` servers.
- **Duration honesty:** Bounded automation never fabricates playtime and never sets `durationProven: true`. All receipts below preserve `durationProven: false` and `releaseTargetProven: false`.

---

## 1. Automated Syntax, Storyworld, Static Delivery, and Node Test Suite

| Check | Command (run from `game/`) | Result | Exact Metrics |
| --- | --- | --- | --- |
| JS/MJS syntax check | `node --check` across all `.js`/`.mjs` files in `game/` | PASS | `388` files checked, `0` failures |
| Storyworld build parity | `node tools/build-storyworld.mjs --check` | PASS | `Storyworld generated artifacts are current.` |
| Full Node test suite | `node --test --test-force-exit --test-concurrency=4` (with `Pillow 11.3.0` venv on `PATH`) | PASS | `1445` tests, `1445` pass, `0` fail, `0` skipped, `0` cancelled (`108,605 ms`) |
| Static HTTP delivery | `python tools/static-delivery.py` | PASS | `430` files, `72,571,678` bytes (`72,571,250` bytes on pre-fix `b260da2`), `0` failures |

### Static Delivery Breakdown by Extension

| Suffix | File Count |
| --- | ---: |
| `.css` | 16 |
| `.html` | 18 |
| `.js` | 16 |
| `.json` | 21 |
| `.mjs` | 149 |
| `.png` | 128 |
| `.svg` | 82 |
| **Total** | **430** |

> **Environment note:** The six procedural pixel-art `--check` tests (`action-objective-suite-assets`, `boss-animation-suite`, `enemy-animation-suite-v4-assets`, `enemy-combat-animation-runtime`, `field-prop-production-acceptance`, `regional-battle-stage-production-acceptance`) require pinned `Pillow==11.3.0` for byte-exact PNG/manifest hashing. Running with system Pillow `12.3.0` fails those six checks (`1439/1445`); activating the pinned `Pillow 11.3.0` virtualenv yields `1445/1445` green.

---

## 2. Installed-Chrome Browser Probe & Smoke Matrix (11/11 PASS)

Every script serves `game/` (or an isolated temporary fixture directory) on an ephemeral `127.0.0.1:0` port and closes its own headless Chrome session cleanly. All 11 scripts passed with `0` console, page, and HTTP errors.

| # | Script (`game/tools/...`) | Status | Verified Scope & Key Receipts |
| --- | --- | --- | --- |
| 1 | `action-campaign-browser-probe.py` | PASS | `c1-cinder-hounds` movement (`27.258px`), cooldown movement (`14.868px`), `c4-widow-of-fog` Hunter–Priest duo combo (`lise` + `mateus`), opening READY gate (`nowMs: 0`, paused), canonical settlement committed (`0` restarts, 11 storage keys, `0` console/page/delivery errors) |
| 2 | `browser-smoke.py` | PASS | Full end-to-end smoke: Camp round-trip (`96×96` portrait v2), Campaign Dodge + Item reload-refund/commit, 5-win Auto-Grind queue (`4×` speed), Takamine + 18 regional stages, wrong-size/error fallbacks, 77-scene Salt route + 22 Storyworld scenes credits gate (`active-playtime-incomplete`, `durationProven: false`, `releaseTargetProven: false`, `aggregateReferenceTargetMs: 74,676,250`), `sw3-sayos-warehouse-conditions` lock + 14-authority recovery checkpoint round-trip, route-guide archive launch, 180 finite Camp/Council/Archive browser controls (`90`/`30`/`60`), 390px responsive + WCAG semantic + audio audits across 6 pages, touch-only FP-0 victory, reduced-motion frozen on 5 canvases, denied-storage `SecurityError` resilience across 4 pages, `0` console/page/delivery errors |
| 3 | `voice-review-browser-smoke.py` | PASS | `27` voiced lines rendered on `voice-lab.html`, EN/JA verdict isolation, export (`2` reviews), stale-take lock & rejection, JSON import recovery, `0` console/page/HTTP errors |
| 4 | `illustration-review-browser-smoke.py` | PASS | `4` July original reference pairs (`8` images: Nikola, Mateus, Kurozane, World), localStorage persistence, JSON export/import round-trip, stale SHA import rejection, `0` errors |
| 5 | `svg-motion-browser-smoke.py` | PASS | `62` cast identities on `svg-motion-studio.html`, `13` action cells, `8` party field cells, animation playback toggle, `8` verified SVG sheet deliveries, `0` errors |
| 6 | `npc-motion-browser-smoke.py` | PASS | `16` NPC roles across all `6` clip families (`idle`, `walk`, `talk`, `work`, `react`, `leave`), `96` decoded images, frame scrub to frame `17`, `0` errors |
| 7 | `hd-painted-browser-smoke.py` | PASS | Synthetic temporary HTTP overlay (zero Git tree mutations): `&art=hd` painted mode (`hdArtDrawCount: 5`, `ren`, card link 200), default classic fallback (`hdArtDrawCount: 0`), missing-manifest 404 fallback (`hdArtState: unavailable`), `0` page errors |
| 8 | `hd-motion-browser-smoke.py` | PASS | Isolated temp fixture verifying v2 `192px` WebP motion decode, v1 `384px` sheet fallback, `2` cached clips, `0` browser errors |
| 9 | `hd-missing-browser-smoke.py` | PASS | `16` source-derived enemy identities on `hd-source-derived-review.html`, non-blank canvas render (`>1000` opaque pixels), frame step & playback toggle, `0` errors |
| 10 | `hd-kurozane-browser-smoke.py` | PASS | Isolated temp fixture verifying all `6` Kurozane phase key draws (`[0, 384, 768, 1152, 1536, 1920]`) and null-form rejection, `0` browser errors |
| 11 | `hd-boss-vfx-browser-smoke.py` | PASS | All `6` bosses × `2` phases (`12` stages: `widow-of-fog`, `furnace-abbot`, `ujiro`, `bell-warden-chiyo`, `lady-enma`, `yearless-bell` × `windup`/`active`) verified at frame `9`, `0` console/HTTP errors |

---

## 3. Fresh Rendered-Control FP-1 Opening Slice Playthrough

**Command (run from `game/`):**
```bash
python tools/browser-route-playthrough.py --stop-after-beat c3-01-separate-arrivals --max-scenes 25 --max-seconds 600
```

**Policy:** Rendered DOM controls only; no direct `localStorage` mutation; no JavaScript runtime transition calls; canonical action combat (`battleMode: "canonical-action"`, `routeMode: "narrative-selected-route"`).

| Metric | Value |
| --- | --- |
| Status | `target-reached` |
| Start checkpoint | `p00-delivery-in-rain` (`The Night Census \| SCENE 01/06 \| Delivery in Rain`) |
| Target frontier reached | `c3-01-separate-arrivals` (`Sodegaura Lanterns \| SCENE 01/06 \| Separate Arrivals`) |
| Run proof string | `Narrative run ed0c4516 · 22/82 played scenes · 00:06:14 active` (18 opening scenes + 4 opening Storyworld scenes) |
| Wall-clock elapsed | `519.265 s` |
| Control activations | `2,452` |
| Field moves | `989` |
| Battle commands | `1,078` |
| Camp controls | `33` |
| Canonical action battles cleared | `7 / 7` (`totalRestarts: 0`) |
| Action battle total / median / longest | `121.424 s` / `13.907 s` / `31.922 s` |
| Minimum survivor HP ratio | `0.7176` (`71.76%`) |
| Console / Page errors | `0` / `0` |

### Encounter-by-Encounter Canonical Action Receipts

| # | Encounter | Wall (s) | Sim (s) | Hit-stop (s) | Interrupts | Inputs | Restarts | Final Boss Phase | Party End Vitals |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | Ashen Bailiff — River Escape | 13.907 | 13.92 | 0.048 | 0 | 73 | 0 | — | Ren 122/122 |
| 2 | Flooded Cedars — Cinder Hounds | 15.735 | 14.42 | 1.438 | 2 | 155 | 0 | — | Ren 94/131 |
| 3 | Flooded Cedars — Ash Wisps | 9.984 | 9.14 | 0.786 | 0 | 109 | 0 | — | Ren 135/140 |
| 4 | Tithe Hound | 31.922 | 30.58 | 1.043 | 0 | 300 | 0 | `frantic` | Ren 138/149 |
| 5 | Cedar Service Path — Cinder Hounds and Ash Wisp | 12.937 | 11.72 | 1.220 | 4 | 118 | 0 | — | Ren 137/158 |
| 6 | Flooded Archive — Tithe Enforcer and Bell Moths | 12.954 | 11.78 | 1.136 | 3 | 123 | 0 | — | Nikola 134/141, Ren 157/167 |
| 7 | Father Mateus Avelar | 23.985 | 22.22 | 1.535 | 2 | 200 | 0 | `phase-3` | Nikola 142/149, Ren 152/176 |

---

## 4. Genuine Integration Regressions & Bugs Diagnosed and Fixed

Every modified file is listed explicitly below. No security, save, provenance, or duration-proof invariant was weakened.

1. **`game/player-journey-completion.mjs` (Production runtime crash under denied `localStorage`)**
   - **Root cause:** `createPlayerJourneyStorageAdapter(storage = globalThis.localStorage)` evaluated `globalThis.localStorage` in its default parameter before entering any `try/catch`, throwing an uncaught `SecurityError` at module init on `credits.html` in restricted-storage browser contexts (caught by `browser-smoke.py`'s denied-storage check).
   - **Fix:** Added `resolveStorage(explicitStorage)` inside `try/catch` and made `load()`/`save()` fail closed when storage is unavailable.

2. **`game/svg-motion-studio.js` (Real Chrome rAF timestamp `NaN` SVG error)**
   - **Root cause:** When Chrome's first `requestAnimationFrame` callback timestamp `now` preceded `performance.now()` (`playStarted`), `Math.floor((now - playStarted) / 170) % cycle.length` evaluated to `-1`, indexing `cycle[-1] === undefined` and writing `<image x="NaN">`.
   - **Fix:** Clamped elapsed playback time with `Math.max(0, now - playStarted)`.

3. **`game/tools/hd-painted-browser-smoke.py` (Git-tree clobbering regression on `b260da2`)**
   - **Root cause:** Written before the seven named bosses were committed under `game/assets/art/hd-painted-v1/`, the smoke script overwrote the committed `manifest.json`, wrote synthetic PNGs into `game/assets/art/hd-painted-v1/`, and then called `manifest.unlink()` — breaking `tests/hd-seven-named-boss-art-git.test.mjs` and dirtying the repository.
   - **Fix:** Serve the synthetic fixture from a `tempfile.TemporaryDirectory()` HTTP overlay handler for `/assets/art/hd-painted-v1/` so the smoke verifies painted, classic, and 404-fallback paths without touching Git, plus installed Chrome/Edge fallback.

4. **`game/tools/browser-smoke.py` & `game/tests/browser-smoke-current-build.test.mjs` (Post-15-PR UI & contract alignment)**
   - **Root cause:** Several merged PRs updated player-facing vs `?dev=1` presentation and content constants without updating `browser-smoke.py`:
     - Campaign masthead link shortened from `"Camp & Loadout"` to `"Camp"`.
     - `party-portrait-suite-v2` upgraded portrait cells from `64×64` to `96×96` (`aya.y: 96`).
     - Player-mode Camp summaries show `"0 remembered"` / `"0 read"` (while `?dev=1` shows catalog denominators); developer proof checks (`#exportRecovery`, `#runProofStatus`, `#sealCredits` 5-hour gate, `#exportEvidence`) belong on `?dev=1`.
     - `#gameCanvas` moved from player title shell `index.html` to `training.html?dev=1`.
     - Canonical `aggregateReferenceTargetMs` updated to `74,676,250` (matching `tests/playtest-evidence.test.mjs`).
     - `sw3-sayos-warehouse-conditions` moved to `c3-01-separate-arrivals` (`act-route-decision`, `storyworldRequiredClusterCount: 12`), and `unlockedPartyCount` increased from `6` to `7` (with Miyo).
     - Opening-focus CSS hides `.journal-drawer` and `.chapter-rail` during the 18-scene opening slice; route-guide verification now advances past opening (`c3-02-the-checkpoint`) and opens `.journal-drawer > summary`, while opening-focus responsive QA verifies `#openingSliceAction`.
     - Fixed Python 3.12 raw-string `SyntaxWarning` on `\s+`.

5. **Feature smoke scripts (`game/tools/voice-review-browser-smoke.py`, `illustration-review-browser-smoke.py`, `svg-motion-browser-smoke.py`, `npc-motion-browser-smoke.py`, `hd-motion-browser-smoke.py`, `hd-missing-browser-smoke.py`, `hd-kurozane-browser-smoke.py`, `hd-boss-vfx-browser-smoke.py`)**
   - Added automatic fallback to installed Chrome/Edge when Playwright's downloaded `chromium_headless_shell` is not present.
   - Added `204 No Content` handling for `/favicon.ico` in the 5 studio/review smoke HTTP handlers (`voice-review`, `illustration-review`, `svg-motion`, `hd-missing`, `hd-boss-vfx`) because full installed Chrome probes `/favicon.ico` on HTML pages lacking `<link rel="icon">`. *(Follow-up polish note: adding `<link rel="icon" href="favicon.svg" type="image/svg+xml">` to the 9 auxiliary review/map HTML pages will also eliminate `/favicon.ico` 404s when opened directly in Chrome.)*
