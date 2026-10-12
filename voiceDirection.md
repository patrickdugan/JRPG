# Voice Direction — Bells of the Black Chrysanthemum

Working notes for character voices in English and Japanese. The current prototype covers the final confrontation (`c9-05-dawn-at-observatory` and the Last Command confession reversal). The voices are synthetic placeholders for exploring direction; they are not final casting.

- Prototype source: [`assets/audio/voice-prototype-v1/`](assets/audio/voice-prototype-v1/README.md) (scene script, cast sheet, generator)
- Listening page: `game/voice-lab.html` (serve `game/` and open `/voice-lab.html`)
- Story authority: [`docs/36-act-v-the-last-command.md`](docs/36-act-v-the-last-command.md)

## Ground rules

1. **No real person's voice is cloned.** Every timbre starts from a stock synthetic Kokoro voicepack. Do not feed actor recordings, celebrity clips, or anyone's voice into the reference slot without their written consent.
2. **Drama comes from contrast, not volume.** Each character has a resting register. The finale works because restrained people break and a performing sovereign stops performing.
3. **Comedy never lands on the victims.** Nikola and Mateus can be funny because they are proud and tired. The execution rows, the dead, and Miyo's survival are never the joke.
4. **Japanese is a performance, not a subtitle.** Register choices (余, 私, 俺, です/ます) carry character and plot. A line can be grammatically right and still wrong for the scene.
5. **Prototype output is not shippable.** Shipping needs human actors or a licensed pipeline with consent, plus native Japanese direction.

## Cast briefs

| Character | Resting voice | English direction | Japanese direction |
| --- | --- | --- | --- |
| **Shogun Kurozane** | Deep, slow, courtly; enjoys his own cadence | Persuasive rather than snarling; he is selling necessity. Contempt is quiet. | Sovereign 余 and archaic 〜ぬ/〜か endings while in power; plain 私 once broken. |
| **Father Mateus Avelar** | Weary baritone, scholarly precision | Restraint is the performance: guilt sits under the voice until the confession breaks it. Dry corrections stay dry. | Formal clerical register (私 read as わたくし where natural). A European accent in Japanese is in character. |
| **Nikola Dražanić** | Confident, theatrical, one degree too pleased with himself | Grandeur colliding with precision. Gravity arrives without warning and must be genuinely quiet. | Grandiose 貴様 and 我が in challenges; short, plain lines when serious. An accent is in character. |
| **Ren Ishikawa** | Young, plain, quick | Quiet authority, never speeches. The last word before the choice is firm, not loud. | Casual 俺 and plain form. No heroic flourish. |
| **Miyo Senda** | Clear, controlled, exact | Anger arrives as precision. She refuses to be anyone's argument. | Polite です/ます that does not bend; the politeness is the steel. |
| **Aya** | Measured archivist, warm under pressure | Asks the question that makes everyone define terms. | Careful neutral register. |
| **Kiku** | Brisk physician | Bedside manner as command; humor is impatience, not cruelty. | Clipped, practical. |
| **Genta** | Steady engineer | Reports, positions, load paths. Calm makes the danger credible. | Plain, low-key. |
| **Lady Enma of Ash** | Former court entertainer; theatrical, fan-snap timing | Every line staged for an audience, even when alone. Three masks, three temperatures. | Elegant court speech with performative flourishes. |
| **Magistrate Ujiro Arata** | Bureaucratic authority over cowardice | Paperwork as violence; brave only when the room agrees. | Officious formal speech that frays under pressure. |

Only Kurozane, Mateus, Nikola, Ren, and Miyo are in the current prototype. The other briefs are starting points for later scenes.

## The final confrontation: intensity map

Intensity is the target on a 0–10 scale. The numbers in brackets are the prototype's Chatterbox settings: `exaggeration` (emotional intensity) and `cfg` (lower means slower and more deliberate).

| Line | Speaker | Beat | Target | Notes |
| ---: | --- | --- | ---: | --- |
| 01 | Kurozane | "mistaken damage for mortality" | 6 | Regal, unhurried, enjoying the echo. Oni effects. (0.65 / 0.35) |
| 02 | Kurozane | "Fewer graves, Father." | 6 | A ledger read aloud; twist on "You counted them for me." |
| 03 | Mateus | "people still breathing inside them" | 5 | Guilt held under the voice. |
| 04 | Nikola | Longinus threat | 8 | Magnificently wrong. Let him enjoy it. |
| 05 | Mateus | "theologically and anatomically inaccurate" | 3 | Bone-dry. Contrast with 04 is the joke. |
| 06 | Nikola | "correct the inscription" | 6 | Breezy, undaunted. |
| 07 | Kurozane | "condemn my peace" | 7 | A prosecutor turning the court. |
| 08 | Mateus | "The dead were not confused by either word." | 6 | The game's thesis. Quiet and absolute; do not oversing it. |
| 09 | Miyo | "my pulse as a receipt" | 7 | Steady anger; refuses both men. |
| 10 | Kurozane | "Avelar, come home." | 4 | Seductive, almost fatherly. The softest he ever is. |
| 11 | Mateus | "usefulness felt like shelter" | 5 | Refusal without heat. |
| 12–14 | Mateus / Nikola | Black Sun Concord | 8–9 | Invocation full voice; banter clipped under exertion. |
| 15 | Kurozane | "inherit my necessity" | 6 | Pinned, breathing hard, still bargaining. Effects thin out. |
| 16 | Mateus | "history continuing while you watch" | 5 | A measured verdict. |
| 17 | Ren | "Conversation decides…" | 6 | Firm and young. The calm before the choice. |
| 18 | Mateus | 「お前は私の息子を殺した！」 | **10** | Two centuries of restraint break. Raw, voice cracking. (1.0 / 0.3) |
| 19 | Kurozane | "He was a rebel!" | 9 | Shouting back; the mask slips. |
| 20 | Mateus | "You made me watch his execution." | 7 | Sudden near-whisper after the shout. The silence before it matters. |
| 21 | Kurozane | "You demanded the right!" | 9 | Cruelty as self-defense. |
| 22 | Mateus | "You made me betray my God!" | **10** | The heart of the game. |
| 23 | Nikola | *Credis in Deum, Shogun?* | 4 | Ecclesiastical Latin, no performance at all. Italianate vowels. |
| 24 | Mateus | 「将軍。神を信じるか、と聞いている。」 | 5 | Translating, giving the question full weight. |
| 25 | Kurozane | 「……はい。」 | **2** | Mandatory plain answer. A frightened ordinary man. No effects. Barely audible. |
| 26 | Mateus | "Call it sin." | 6 | A confessor's sentence, not a victor's. |
| 27 | Kurozane | 「余の――……私の権威ではない。」 | 4 | Begins as sovereign 余, catches himself, finishes as 私. The fiction ends mid-sentence. |

### Shape of the scene

- **Peaks need valleys.** Lines 18 and 22 only work because 20 is quiet and 25 is almost nothing. Never raise 20 or 25 to make them "clearer".
- **Kurozane loses resonance as he loses power.** His effect chain runs from `oni` (lowered pitch, sub-octave, drive, hall) to `fallen` (thinner) to `mortal` (dry). The plain はい must sound like a different, smaller man.
- **Silence is direction.** In playback, leave about 0.4 s between lines, about 1.2 s before line 18, and about 1.5 s before line 25. (The listening page currently uses a uniform gap; per-line pauses are a TODO.)
- **The Latin line is a hinge.** After Nikola's grandeur all scene long, his one serious question has to drop to nothing.

## Japanese register rules for this scene

- 余 is Kurozane's sovereign pronoun. He uses it until the confession. The 余 → 私 correction in line 27 is plot, not style.
- はい in line 25 must be plain はい: no ああ, no うむ, no sovereign alternative.
- Mateus says マテウス for himself only when Kurozane names him; his own register stays formal.
- Katakana for names without established kanji: センダ, アヴェラール.
- The confession-reversal Japanese (18–27) is authored in docs/36. Everything else is a **draft translation** awaiting native review.

## Parameter vocabulary (Chatterbox)

| Direction word | exaggeration | cfg | Use |
| --- | --- | --- | --- |
| restrained, dry | 0.3–0.45 | 0.45–0.5 | Corrections, translation, plain answers |
| measured, grave | 0.45–0.55 | 0.3–0.4 | Theses, verdicts |
| heated, theatrical | 0.65–0.8 | 0.35–0.45 | Accusations, proclamations |
| breaking, raw | 0.9–1.0 | 0.25–0.3 | Only at the true peaks |

Higher exaggeration speeds speech up; lower CFG slows it back down. At exaggeration ≥ 0.9 on short lines, Chatterbox tends to keep talking past the script. The generator caps the speech-token budget per line and trims any overrun using Whisper word timestamps.

## Generating on another machine

The generator is resumable: it skips any line whose output file exists and whose text is unchanged, so rendering can move between PCs at any point. A GPU makes it practical (about 2 minutes per take on CPU, seconds on GPU).

1. Get the branch with the voice prototype onto the other PC (pull it from GitHub, or copy the repository folder).
2. Install Python 3.11 or 3.12 and create the voice environment in the repo root:
   ```powershell
   python -m venv .venv-voice
   .\.venv-voice\Scripts\python -m pip install --upgrade pip
   ```
3. Install PyTorch for that machine's GPU. RTX 50-series (Blackwell) needs CUDA 12.8 wheels; older RTX cards can use cu124 or cu126:
   ```powershell
   .\.venv-voice\Scripts\python -m pip install torch==2.7.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu128
   ```
4. Install Chatterbox without its torch pin, then its dependencies, Kokoro, and the Japanese dictionary:
   ```powershell
   .\.venv-voice\Scripts\python -m pip install --no-deps chatterbox-tts
   .\.venv-voice\Scripts\python -m pip install "numpy>=1.24,<2" librosa==0.11.0 s3tokenizer transformers==5.2.0 diffusers==0.29.0 resemble-perth conformer==0.3.2 safetensors==0.5.3 spacy-pkuseg pykakasi==2.3.0 pyloudnorm omegaconf soundfile scipy
   .\.venv-voice\Scripts\python -m pip install kokoro "misaki[ja,en]" unidic-lite
   .\.venv-voice\Scripts\python -m pip uninstall -y unidic
   ```
   Keep `unidic-lite` and remove the full `unidic`: the full package needs a separate dictionary download, and MeCab fails without it.
5. Render. On first run this downloads Chatterbox Multilingual, Kokoro, and Whisper large-v3-turbo into the Hugging Face cache:
   ```powershell
   $env:PYTHONIOENCODING = "utf-8"
   .\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs en,ja --takes 3 --device cuda
   ```
   Use `--takes 3` on GPU so the ASR check can pick the cleanest take. Use `--lines 18,22 --force` to retake specific lines.
6. Bring the results back: commit `game/assets/audio/voice-prototype-v1/` (OGG files and `manifest.json`) on the branch, or copy that folder over.

## Review checklist

For each line, on the listening page:

- [ ] The words are right (the page's ASR error is under 10%).
- [ ] The intensity matches the map above, especially the valleys at 20 and 25.
- [ ] Kurozane's effects step down: oni, then fallen, then mortal.
- [ ] Japanese pronunciation and pitch accent are natural (native reviewer).
- [ ] No breath, click, or babble at the tail.
- [ ] Voices stay distinguishable in a blind listen.

## Open work

- Finish the render: 11 English and 26 Japanese lines remain as of this note.
- Native Japanese review of the draft translation and of every Japanese take.
- Per-line pauses in the listening page and in the eventual dialogue runner.
- An opt-in voice setting in the Campaign dialogue runner, with subtitles always on.
- Extend the cast to Aya, Kiku, Genta, Lady Enma, and Ujiro for their key scenes.
