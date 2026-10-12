# Voice Prototype V1 — The Last Command

Prototype character voices for the final confrontation (`c9-05-dawn-at-observatory` and the Storyworld confession reversal) in English and Japanese. Use it to explore casting direction and dramatic range, not as final voice acting.

## Provenance

These are **AI-generated synthetic voices**. They are not human performances, and no real person's voice is cloned.

| Stage | Tool | License | Role |
| --- | --- | --- | --- |
| Reference timbre | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) stock voicepacks | Apache-2.0 | Renders an original 8–12 s reference clip per character and language, optionally pitch-shifted. |
| Performance | [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) | MIT | Performs each line from the reference timbre with per-line emotion exaggeration and CFG pacing. |
| Verification | [Whisper large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo) | MIT | Transcribes every take; the take closest to the script is kept. |

Every Chatterbox output carries Resemble AI's imperceptible Perth watermark. Model weights live in the local Hugging Face cache, never in this repository.

## Files

- `scene-last-command.json`: the 27 performed lines with English and Japanese text, direction, exaggeration, CFG weight, and effect stage.
- `cast.json`: one entry per character, with the brief, reference voicepack and pitch per language, and an effect chain per stage.
- `build_voice_prototype.py`: the generator.
- `references/<lang>/<speaker>.wav`: the generated reference timbres, kept so takes stay comparable.
- Runtime output: `game/assets/audio/voice-prototype-v1/<lang>/<id>-<speaker>.ogg` plus `manifest.json`, reviewed in `game/voice-lab.html`.

## Casting and drama

Kurozane's effect chain tracks the story. As the Oni sovereign he gets a lowered pitch, a sub-octave layer, light drive, and hall reverb. When he falls pinned beneath the spear the chain thins. For the confession's plain 「……はい」 and the 余→私 correction, every effect is gone and only a frightened mortal voice remains.

Mateus is held in restraint, around exaggeration 0.35–0.55, until the confession breaks him: 「お前は私の息子を殺した！」 runs at exaggeration 1.0 with low CFG for a raw, unhurried release. Nikola's grandeur runs hot, around 0.8, so his single Latin question can drop to 0.4 and land as genuine gravity. The Latin line uses Chatterbox's Italian voice for Italianate ecclesiastical vowels.

Mateus and Nikola speak Japanese through English reference timbres, so a foreign accent in their Japanese is deliberate. Ren, Miyo, and Kurozane use Japanese reference timbres for Japanese.

## Translation status

The confession-reversal Japanese is authored in `docs/36-act-v-the-last-command.md`. Every other Japanese line is a draft translation awaiting native review. The draft keeps register distinctions: Kurozane uses the sovereign 余 until the confession, Mateus a formal clerical register, and Miyo polite but unbending speech.

## Rebuild

From the repository root, in the voice environment (`.venv-voice`, CUDA 12.8 PyTorch 2.7.1 plus `chatterbox-tts`, `kokoro`, `misaki[ja]`):

```powershell
.\.venv-voice\Scripts\python assets\audio\voice-prototype-v1\build_voice_prototype.py --langs en,ja --takes 3
```

Options: `--lines 18,19,22` regenerates selected lines, and `--device cpu|cuda|auto` chooses the device. `auto` uses CUDA only when at least `--min-free-gb` (default 6) of VRAM is free. Neural TTS on GPU is not bit-reproducible, so the manifest records seeds, takes, ASR transcripts, and prosody metrics instead of byte hashes.

## Remaining work

- Native Japanese review of the draft lines and of the generated Japanese pronunciation.
- A listening pass on every line, then line-by-line retakes.
- Integration with the Campaign dialogue runner behind an opt-in voice setting.
- Final casting: human actors or a licensed voice pipeline for shipping.
