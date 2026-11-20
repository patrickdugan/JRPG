"""Generate the Last Command voice prototype in English and Japanese.

Pipeline per character and language:
1. Kokoro-82M renders an original reference clip from a stock synthetic
   voicepack (optionally pitch-shifted) -> references/<lang>/<speaker>.wav.
2. Chatterbox Multilingual performs each line with that reference timbre,
   the line's exaggeration and CFG weight, over several seeded takes.
3. Whisper transcribes every take; the take with the lowest character error
   rate against the script is kept.
4. A per-character effect chain (pitch, sub-octave layer, drive, hall reverb)
   is applied, loudness is normalised, and the result is written as OGG to
   game/assets/audio/voice-prototype-v1/<lang>/ with a manifest.

Neural TTS on GPU is not bit-reproducible; seeds, takes, and metrics are
recorded in the manifest instead of byte hashes.
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

import numpy as np

SUITE = Path(__file__).resolve().parent
REPO = SUITE.parents[2]
RUNTIME = REPO / "game" / "assets" / "audio" / "voice-prototype-v1"
SAMPLE_RATE_OUT = 24_000
TARGET_LUFS = -18.0


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def gpu_free_gb() -> float | None:
    """Free VRAM from nvidia-smi; torch.cuda.mem_get_info over-reports on Windows WDDM."""
    import subprocess

    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=True,
        ).stdout.strip().splitlines()[0]
        used, total = (float(value) for value in out.split(","))
        return (total - used) / 1024
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def pick_device(requested: str, minimum_free_gb: float) -> str:
    import torch

    if requested != "auto":
        return requested
    if not torch.cuda.is_available():
        return "cpu"
    free = gpu_free_gb()
    return "cuda" if free is not None and free >= minimum_free_gb else "cpu"


# ---------------------------------------------------------------- references

def render_reference(character_id: str, character: dict, lang: str, device: str) -> Path:
    target = SUITE / "references" / lang / f"{character_id}.wav"
    if target.exists():
        return target
    # Kokoro is needed only to render a missing reference, so a machine that
    # just performs lines can skip it (misaki[ja] builds pyopenjtalk from source).
    import librosa
    import soundfile as sf
    from kokoro import KPipeline

    spec = character["reference"][lang]
    text = character["referenceText"][lang]
    pipeline = KPipeline(lang_code=spec["lang"], device=device)
    chunks = [np.asarray(audio, dtype=np.float32) for _gs, _ps, audio in pipeline(text, voice=spec["voice"], speed=0.95)]
    audio = np.concatenate(chunks)
    if spec.get("pitch"):
        audio = librosa.effects.pitch_shift(audio, sr=24_000, n_steps=float(spec["pitch"]))
    target.parent.mkdir(parents=True, exist_ok=True)
    sf.write(target, audio / max(1e-6, np.abs(audio).max()) * 0.9, 24_000, subtype="PCM_16")
    return target


# --------------------------------------------------------------- performance

_KAKASI = None


def to_hiragana(text: str) -> str:
    """Compare Japanese by reading: Whisper often picks a homophone (鐘/金, 書記/初期)."""
    global _KAKASI
    if _KAKASI is None:
        import pykakasi

        _KAKASI = pykakasi.kakasi()
    return "".join(item["hira"] for item in _KAKASI.convert(text))


def normalise_text(text: str, lang: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    if lang == "ja":
        return re.sub(r"[\s、。，．・…―ー\-—“”\"'「」『』！？!?.,]", "", to_hiragana(text))
    return re.sub(r"[^a-z0-9]", "", text)


def char_error_rate(reference: str, hypothesis: str) -> float:
    a, b = reference, hypothesis
    if not a:
        return 0.0 if not b else 1.0
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1] / len(a)


class Transcriber:
    def __init__(self, device: str, model_id: str):
        import torch
        from transformers import pipeline

        self.pipe = pipeline(
            "automatic-speech-recognition",
            model=model_id,
            device=0 if device == "cuda" else -1,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        )
        # Word timestamps need only the decoder's cross-attention, but generate()
        # requests attentions from the whole model. The encoder would then return
        # 32 layers of 1500x1500 self-attention maps (about 5.8 GB per call in fp32).
        encoder = self.pipe.model.get_encoder()
        encoder_forward = encoder.forward

        def forward_without_attentions(*args, **kwargs):
            kwargs["output_attentions"] = False
            return encoder_forward(*args, **kwargs)

        encoder.forward = forward_without_attentions

    def __call__(self, audio: np.ndarray, sample_rate: int, lang: str, *, words: bool = False):
        result = self.pipe(
            {"raw": audio.astype(np.float32), "sampling_rate": sample_rate},
            generate_kwargs={"language": {"en": "english", "ja": "japanese", "it": "italian"}[lang], "task": "transcribe"},
            **({"return_timestamps": "word"} if words else {}),
        )
        if words:
            return result["text"].strip(), result.get("chunks", [])
        return result["text"].strip()


def speech_token_budget(text: str, lang: str) -> int:
    """Cap generated speech tokens (25 Hz) from line length, with room for slow drama."""
    per_char = 0.26 if lang == "ja" else 0.11
    seconds = 1.8 + per_char * len(text)
    return int(min(1000, max(60, seconds * 25)))


def trim_overrun(audio: np.ndarray, sample_rate: int, chunks: list[dict], script: str, lang: str) -> tuple[np.ndarray, bool]:
    """Cut a babbled tail: keep the shortest transcript prefix that best matches the script."""
    if not chunks:
        return audio, False
    target = normalise_text(script, lang)
    best_index, best_cer, heard = None, float("inf"), ""
    for index, chunk in enumerate(chunks):
        heard += chunk.get("text", "")
        cer = char_error_rate(target, normalise_text(heard, lang))
        if cer < best_cer - 1e-9:
            best_index, best_cer = index, cer
    if best_index is None or best_index == len(chunks) - 1:
        return audio, False
    end = chunks[best_index].get("timestamp", (None, None))[1]
    following = chunks[best_index + 1].get("timestamp", (None, None))[0]
    if end is None:
        return audio, False
    cut = end + 0.18 if following is None else min(end + 0.25, (end + following) / 2 + 0.05)
    cut_index = int(cut * sample_rate)
    if cut_index >= len(audio) - int(0.1 * sample_rate):
        return audio, False
    fade = min(int(0.04 * sample_rate), cut_index)
    trimmed = audio[:cut_index].copy()
    trimmed[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return trimmed, True


def prosody_metrics(audio: np.ndarray, sample_rate: int) -> dict:
    import librosa

    f0, voiced, _ = librosa.pyin(audio, fmin=60, fmax=500, sr=sample_rate, frame_length=1024)
    f0 = f0[voiced] if voiced is not None else np.array([])
    rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=256)[0]
    loud = 20 * np.log10(np.maximum(rms, 1e-5))
    active = loud[loud > loud.max() - 40]
    return {
        "durationSeconds": round(len(audio) / sample_rate, 2),
        "pitchMedianHz": round(float(np.median(f0)), 1) if f0.size else None,
        "pitchRangeSemitones": round(float(12 * np.log2(np.percentile(f0, 95) / np.percentile(f0, 5))), 1) if f0.size > 10 else None,
        "loudnessRangeDb": round(float(np.percentile(active, 95) - np.percentile(active, 10)), 1) if active.size else None,
    }


# ---------------------------------------------------------------------- fx

def hall_impulse(sample_rate: int, seconds: float = 2.2, seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    length = int(sample_rate * seconds)
    t = np.arange(length) / sample_rate
    noise = rng.standard_normal(length)
    envelope = np.exp(-t * 3.2)
    impulse = noise * envelope
    for delay, gain in ((0.023, 0.6), (0.041, 0.45), (0.067, 0.35)):
        index = int(delay * sample_rate)
        impulse[index] += gain * 8
    return impulse / np.sqrt(np.sum(impulse**2))


def apply_fx(audio: np.ndarray, sample_rate: int, fx: dict) -> np.ndarray:
    import librosa
    from scipy.signal import butter, fftconvolve, sosfilt

    dry = audio.astype(np.float32)
    if fx.get("pitch"):
        dry = librosa.effects.pitch_shift(dry, sr=sample_rate, n_steps=float(fx["pitch"]))
    out = dry.copy()
    if fx.get("sub"):
        sub = librosa.effects.pitch_shift(dry, sr=sample_rate, n_steps=-12.0)
        sub = sosfilt(butter(4, 900, "lowpass", fs=sample_rate, output="sos"), sub)
        out = out + float(fx["sub"]) * sub
    if fx.get("drive"):
        amount = 1 + 6 * float(fx["drive"])
        out = np.tanh(out * amount) / np.tanh(amount)
    if fx.get("reverb"):
        wet = fftconvolve(out, hall_impulse(sample_rate))[: len(out) + int(sample_rate * 1.2)]
        out = np.pad(out, (0, len(wet) - len(out)))
        out = (1 - 0.5 * float(fx["reverb"])) * out + float(fx["reverb"]) * 0.35 * wet
    return out.astype(np.float32)


def loudness_normalise(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    import pyloudnorm

    meter = pyloudnorm.Meter(sample_rate)
    loudness = meter.integrated_loudness(audio)
    if np.isfinite(loudness):
        audio = pyloudnorm.normalize.loudness(audio, loudness, TARGET_LUFS)
    peak = np.abs(audio).max()
    return audio * (0.95 / peak) if peak > 0.95 else audio


# -------------------------------------------------------------------- main

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--langs", default="en,ja")
    parser.add_argument("--lines", default="", help="Comma-separated line ids; default all.")
    parser.add_argument("--takes", type=int, default=3)
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    parser.add_argument("--min-free-gb", type=float, default=6.0)
    parser.add_argument("--whisper", default="openai/whisper-large-v3-turbo")
    parser.add_argument("--asr-device", default="same", choices=["same", "cuda", "cpu"],
                        help="Device for Whisper; 'cpu' leaves a small GPU to Chatterbox alone.")
    parser.add_argument("--references-only", action="store_true")
    parser.add_argument("--threads", type=int, default=10, help="CPU threads for torch (leave room for other jobs).")
    parser.add_argument("--force", action="store_true", help="Regenerate lines that already have current output.")
    args = parser.parse_args()

    import soundfile as sf
    import torch

    torch.set_num_threads(max(1, args.threads))

    cast = load_json(SUITE / "cast.json")["characters"]
    scene = load_json(SUITE / "scene-last-command.json")
    langs = [lang for lang in args.langs.split(",") if lang]
    wanted = {item for item in args.lines.split(",") if item}
    lines = [line for line in scene["lines"] if not wanted or line["id"] in wanted]
    device = pick_device(args.device, args.min_free_gb)
    asr_device = device if args.asr_device == "same" else args.asr_device
    print(f"device={device} asr={asr_device} langs={langs} lines={len(lines)} takes={args.takes}", flush=True)

    references = {
        (speaker, lang): render_reference(speaker, cast[speaker], lang, "cpu")
        for lang in langs for speaker in sorted({line["speaker"] for line in lines})
    }
    print(f"references ready: {len(references)}", flush=True)
    if args.references_only:
        return 0

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    # generate() hard-codes a 1000-token budget; short, intense lines can then
    # babble past the script. Cap it per line instead.
    base_inference = model.t3.inference
    budget = {"tokens": 1000}

    def capped_inference(*inference_args, **inference_kwargs):
        inference_kwargs["max_new_tokens"] = min(inference_kwargs.get("max_new_tokens") or 1000, budget["tokens"])
        return base_inference(*inference_args, **inference_kwargs)

    model.t3.inference = capped_inference
    transcribe = Transcriber(asr_device, args.whisper)
    manifest_path = RUNTIME / "manifest.json"
    manifest = load_json(manifest_path) if manifest_path.exists() else {"lines": {}}
    manifest.update({
        "id": "voice-prototype-v1:last-command",
        "provenance": "AI-generated synthetic voices: Kokoro-82M reference timbres performed by Chatterbox Multilingual; every file carries the Perth watermark. No real person's voice is cloned.",
        "sampleRate": SAMPLE_RATE_OUT,
        "targetLufs": TARGET_LUFS,
        "defaultPauseSeconds": scene.get("defaultPauseSeconds", 0.4),
        "pauseBeforeSeconds": {line["id"]: line["pauseBeforeSeconds"] for line in scene["lines"] if "pauseBeforeSeconds" in line},
    })

    def save_manifest() -> None:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    save_manifest()

    for lang in langs:
        for line in lines:
            speaker = line["speaker"]
            text = line[lang]
            language_id = line.get("language", {}).get(lang, lang)
            reference = references[(speaker, lang)]
            existing = manifest["lines"].get(line["id"], {}).get(lang)
            if (not args.force and existing and existing.get("text") == text
                    and (RUNTIME / lang / f"{line['id']}-{speaker}.ogg").exists()):
                print(f"  {lang} {line['id']} {speaker}: current, skipped", flush=True)
                continue
            takes = []
            for take in range(args.takes):
                seed = int(line["id"]) * 100 + take
                torch.manual_seed(seed)
                budget["tokens"] = speech_token_budget(text, language_id)
                started = time.perf_counter()
                wav = model.generate(
                    text,
                    language_id=language_id,
                    audio_prompt_path=str(reference),
                    exaggeration=float(line["exaggeration"]),
                    cfg_weight=float(line["cfg"]),
                )
                audio = wav.squeeze().detach().cpu().numpy().astype(np.float32)
                generated_seconds = round(time.perf_counter() - started, 1)
                heard, chunks = transcribe(audio, model.sr, language_id, words=True)
                audio, trimmed = trim_overrun(audio, model.sr, chunks, text, language_id)
                if trimmed:
                    heard = transcribe(audio, model.sr, language_id)
                cer = char_error_rate(normalise_text(text, language_id), normalise_text(heard, language_id))
                takes.append({"take": take, "seed": seed, "cer": round(cer, 3), "heard": heard, "trimmed": trimmed,
                              "tokenBudget": budget["tokens"], "seconds": generated_seconds, "audio": audio})
                print(f"  {lang} {line['id']} {speaker} take {take}: cer={cer:.3f} trimmed={trimmed} heard={heard!r}", flush=True)
            best = min(takes, key=lambda item: (item["cer"], abs(len(item["audio"]) / model.sr - 0.07 * len(text))))
            fx = cast[speaker].get("fx", {}).get(line.get("fx", "default"), cast[speaker].get("fx", {}).get("default", {}))
            performed = apply_fx(best["audio"], model.sr, fx)
            import librosa
            performed = librosa.resample(performed, orig_sr=model.sr, target_sr=SAMPLE_RATE_OUT) if model.sr != SAMPLE_RATE_OUT else performed
            performed = loudness_normalise(performed, SAMPLE_RATE_OUT)
            out = RUNTIME / lang / f"{line['id']}-{speaker}.ogg"
            out.parent.mkdir(parents=True, exist_ok=True)
            sf.write(out, performed, SAMPLE_RATE_OUT, format="OGG", subtype="VORBIS")
            manifest["lines"].setdefault(line["id"], {})[lang] = {
                "file": f"./assets/audio/voice-prototype-v1/{lang}/{out.name}",
                "speaker": speaker,
                "section": line["section"],
                "direction": line["direction"],
                "text": text,
                "languageId": language_id,
                "exaggeration": line["exaggeration"],
                "cfgWeight": line["cfg"],
                "fx": line.get("fx", "default"),
                "chosenTake": best["take"],
                "seed": best["seed"],
                "cer": best["cer"],
                "heard": best["heard"],
                "takes": [{key: value for key, value in item.items() if key != "audio"} for item in takes],
                **prosody_metrics(best["audio"], model.sr),
            }
            save_manifest()
    print("done", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
