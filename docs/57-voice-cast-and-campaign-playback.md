# Voice Cast, Scoped Production Plan, and Opt-In Campaign & Battle Playback

This document records the expanded 14-role synthetic voice cast, the four authored voice suites (`207` total lines across EN and draft JA), the adaptive GPU rendering pipeline, and the opt-in runtime playback contracts for both Campaign dialogue and Action Battle barks.

> **Policy & provenance:** No real person's voice is cloned. Every timbre is generated from a stock synthetic Kokoro-82M voicepack (optionally pitch-shifted), then performed by Chatterbox Multilingual with Perth watermarking. Prototype renders remain placeholders; shipping audio requires licensed human actors and native Japanese direction.

## 1. Expanded Cast Inventory (14 Speaking Roles)

`assets/audio/voice-prototype-v1/cast.json` defines all **7 playable party members** and all **7 speaking named bosses**:

| Group | Speaker ID | Display Name | Kokoro Reference (EN / JA) | FX Profile(s) |
| --- | --- | --- | --- | --- |
| Party | `ren` | Ren Ishikawa | `am_liam` / `jm_kumo` (+1.0 st) | `default` |
| Party | `aya` | Aya Shinohara | `af_heart` (-0.5 st) / `jf_tebukuro` | `default` |
| Party | `nikola` | Nikola Dražanić | `bm_fable` (-0.5 st) / `bm_fable` (-0.5 st) | `default` |
| Party | `mateus` | Father Mateus Avelar | `bm_george` / `bm_george` | `default` |
| Party | `genta` | Genta Mononobe | `am_michael` (-1.0 st) / `jm_kumo` (-1.5 st) | `default` |
| Party | `kiku` | Kiku Nawa | `af_kore` (-0.5 st) / `jf_gongitsune` (-0.5 st) | `default` |
| Party | `miyo` | Miyo Senda | `af_nicole` / `jf_alpha` | `default` |
| Boss | `kurozane` | Shogun Kurozane | `am_onyx` (-1.0 st) / `jm_kumo` (-3.0 st) | `oni`, `fallen`, `mortal` |
| Boss | `lady-enma` | Lady Enma of Ash | `af_bella` (-1.0 st) / `jf_nezumi` (-1.0 st) | `default`, `subdued` |
| Boss | `ujiro` | Magistrate Ujiro Arata | `am_eric` (+0.5 st) / `jm_kumo` (+0.5 st) | `default` |
| Boss | `captain-kaji` | Captain Kaji | `am_adam` (-1.5 st) / `jm_kumo` (-2.0 st) | `default` |
| Boss | `widow-of-fog` | Widow-of-Fog | `af_sky` (-1.0 st) / `jf_tebukuro` (-1.5 st) | `default`, `low-tide` |
| Boss | `furnace-abbot` | Furnace Abbot | `am_fenrir` (-2.0 st) / `jm_kumo` (-3.5 st) | `default`, `cooled` |
| Boss | `bell-warden-chiyo` | Bell Warden Chiyo | `af_sarah` (-0.5 st) / `jf_alpha` (-1.5 st) | `default` |

## 2. Scoped Clip Inventory (`207` Lines Total)

| Scene ID | Script File | Line IDs | Clip Count | Scope & Coverage |
| --- | --- | --- | ---: | --- |
| `last-command` | `assets/audio/voice-prototype-v1/scene-last-command.json` | `01`–`27` | 27 | `c9-05-dawn-at-observatory` + Last Command confession reversal (EN + JA already rendered) |
| `cast-auditions` | `assets/audio/voice-prototype-v1/scene-cast-auditions.json` | `ca-01`–`ca-10` | 10 | Extended cast audition lines for Aya, Kiku, Genta, Lady Enma, and Magistrate Ujiro |
| `battle-barks` | `assets/audio/voice-prototype-v1/scene-battle-barks.json` | `bb-01`–`bb-90` | 90 | 7 party × 8 barks (`56`), Black Sun Concord duo callouts (`2`), and 8 speaking boss kits (`32`: Kurozane 8, Mateus 4, Lady Enma 5, Ujiro 4, Captain Kaji 4, Widow-of-Fog 3, Furnace Abbot 2, Bell Warden Chiyo 2) |
| `trio-highlights` | `assets/audio/voice-prototype-v1/scene-trio-highlights.json` | `th-01`–`th-80` | 80 | Verbatim canonical lines across `c2-03` (10), `c2-06` (18), `c7-04` (12), `c9-03` (25), and `c9-04` (15) — includes **all 30 remaining Shogun Kurozane lines** (`21` in Conservatory + `9` at Yearless Bell), bringing Kurozane to **100% (52/52)** script coverage |
| **Total** | | | **207** | **180 new clips queued beyond the 27 already rendered** |

## 3. Adaptive Take Budgeting & GPU Time Budget

`assets/audio/voice-prototype-v1/build_voice_prototype.py` supports adaptive take budgeting via `--adaptive` and `--cer-threshold <float>` (default `0.05`):

- Without `--adaptive`, every line renders all `--takes 3` takes before picking the lowest Whisper CER take.
- With `--adaptive --takes 3 --cer-threshold 0.05`, the loop exits immediately on the first take whose normalised Whisper CER is `<= 0.05`, reducing total RTX 5080 GPU wall time by roughly **2.5×** while preserving multi-take fallback on difficult or rapid lines.
- Manifest entries preserve `sceneId`, `beatId`, `actorId`, `barkType`, and optional `phaseId` metadata so both the Campaign dialogue runner and Action Battle bark runtime index rendered clips automatically.

### Estimated RTX 5080 Budget (180 Queued Clips: `cast-auditions` + `battle-barks` + `trio-highlights`)

| Pass | Languages | Settings | Estimated GPU-hours |
| --- | --- | --- | --- |
| EN-first pass | `en` | `--takes 3 --adaptive --cer-threshold 0.05` | ~1.6–2.6 GPU-h |
| Full bilingual pass | `en,ja` | `--takes 3 --adaptive --cer-threshold 0.05` | ~3.1–4.6 GPU-h |

### Copy-Paste GPU Batch Commands (Run Only When GPU Is Free)

Run from the repository root using `.venv-voice`:

```powershell
# 1. Generate missing Kokoro reference WAVs for the 4 new bosses (CPU-only, fast):
$env:PYTHONIOENCODING = "utf-8"
.\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs en,ja --references-only

# 2. Fast EN-only pass across all 3 queued scenes (resumable, adaptive early-stop):
$env:PYTHONIOENCODING = "utf-8"
.\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs en --scenes cast-auditions,battle-barks,trio-highlights --takes 3 --adaptive --cer-threshold 0.05 --device cuda

# 3. Full EN + JA pass across all 3 queued scenes (resumable, adaptive early-stop):
$env:PYTHONIOENCODING = "utf-8"
.\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs en,ja --scenes cast-auditions,battle-barks,trio-highlights --takes 3 --adaptive --cer-threshold 0.05 --device cuda

# 4. Targeted retake of specific lines (e.g., last-command EN/JA polish):
$env:PYTHONIOENCODING = "utf-8"
.\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs ja --scenes last-command --lines 03,10,11 --takes 3 --adaptive --cer-threshold 0.03 --device cuda --force
```

## 4. Opt-In Runtime Playback Contracts

Both runtime consumers share the single opt-in preference record stored under `bbc.dialogueVoice.v1`:

```json
{ "schemaVersion": 1, "enabled": false, "language": "en" }
```

### Shared Isolation Invariants

1. **Default OFF:** Both runtimes start disabled (`enabled: false`), issue **zero** `fetch` calls, and instantiate **zero** `Audio` objects until the player explicitly opts in via the Campaign voice toggle (`#voiceToggle`).
2. **Zero canonical save pollution:** Neither runtime reads, mutates, or deletes any of the 14 canonical campaign, recovery, receipt, or playtime `localStorage` authorities. The Action Battle bark runtime is strictly read-only on `bbc.dialogueVoice.v1`.
3. **Subtitles always on:** Spoken audio is purely additive; dialogue text, combat logs, and telegraphs remain unconditionally rendered regardless of audio state or missing OGG files.
4. **Fail-closed:** Missing manifests, unrendered lines, missing locale files, and rejected `Audio.play()` promises fail silently without throwing or altering gameplay determinism.

### Campaign & Storyworld Dialogue (`game/dialogue-voice-runtime.mjs`)

- Indexes `manifest.json` lines by normalised `(speaker, text)` so verbatim lines in `last-command`, `cast-auditions`, and `trio-highlights` automatically play when reached in Campaign dialogue once rendered.
- Honours per-line `pauseBeforeSeconds` and scene `defaultPauseSeconds` (including the 1.2 s and 1.5 s dramatic silences in the confession reversal).

### Action Battle Barks (`game/battle-bark-runtime.mjs` + `game/action-campaign-battle.js`)

- Indexes rendered `battle-barks` clips from `manifest.json` by `(language, actorId, barkType)` and optional `(language, actorId, barkType, phaseId)`.
- Normalises spawned enemy instance suffixes (`kurozane-1` → `kurozane`, `captain-kaji-1` → `captain-kaji`) and party aliases transparently.
- Maps combat kernel events inside `consumeSnapshotEvents` and tag switches without mutating snapshots:
  - `combo-start` → `duo` (**high priority**, overrides cooldown & interrupts routine bark)
  - `boss-phase-entered` → `boss-phase` with phase-specific lookup (**high priority**, overrides cooldown)
  - `combat-end` → `boss-defeat` (falling back to party `victory`) or `hurt` on defeat (**high priority**, overrides cooldown)
  - `poise-broken` → boss `stagger` (or party `stagger` callout)
  - `attack-start` → weapon (`attack`) vs art (`art`) for party members, or `boss-tell` for speaking bosses
  - `subweapon-used` → `subweapon` (falling back to `heal` for Aya and Kiku)
  - `control-switch` → `tag`
  - `hit` / `hit-ignored` on player actors → `hurt` / `guard`
- Enforces non-overlapping playback with a **1800 ms global cooldown** and **4000 ms per-actor cooldown** for routine barks, while exposing read-only telemetry via `#actionCampaignCanvas[data-battle-bark-state]`.

## 5. CPU-Only Verification Suite

```powershell
python -m py_compile assets/audio/voice-prototype-v1/build_voice_prototype.py
node --test game/tests/battle-bark-runtime.test.mjs game/tests/dialogue-voice-runtime.test.mjs game/tests/voice-review.test.mjs game/tests/character-display-migration-guardrail.test.mjs
python game/tools/voice-review-browser-smoke.py
python game/tools/action-campaign-browser-probe.py
```
