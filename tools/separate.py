"""Splits a 44.1 kHz WAV into vocals.wav and accompaniment.wav with Hybrid Demucs.

Uses torchaudio's HDEMUCS_HIGH_MUSDB_PLUS (weights from download.pytorch.org; the original Demucs
download host's certificate has expired). Runs on the GPU when CUDA is available.

Usage: separate.py IN.wav OUT_DIR    (run by UTAGE.exe with the Python in tools/python-path.txt)
Prints the device used (cuda / cpu).
"""
import pathlib
import sys

import numpy as np
import soundfile as sf
import torch
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS
from torchaudio.transforms import Fade


def separate(model, mix, sr, segment=10.0, overlap=0.1):
    """Runs the model over overlapping chunks (cross-faded) so long songs fit in GPU memory. mix: (1, 2, samples)."""
    _, channels, length = mix.shape
    chunk = int(sr * segment * (1 + overlap))
    over = int(sr * overlap)
    fade = Fade(fade_in_len=0, fade_out_len=over, fade_shape="linear")
    out = torch.zeros(1, len(model.sources), channels, length, device=mix.device)
    start, end = 0, chunk
    while start < length - over:
        with torch.no_grad():
            part = fade(model(mix[:, :, start:end]))
        out[:, :, :, start:end] += part
        if start == 0:
            fade.fade_in_len = over
            start += chunk - over
        else:
            start += chunk
        end += chunk
        if end >= length:
            fade.fade_out_len = 0
    return out[0]


def main(src: str, out_dir: str) -> None:
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    data, sr = sf.read(src, dtype="float32", always_2d=True)  # (samples, channels)
    if sr != HDEMUCS_HIGH_MUSDB_PLUS.sample_rate:
        sys.exit(f"expected {HDEMUCS_HIGH_MUSDB_PLUS.sample_rate} Hz audio, got {sr}")
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = HDEMUCS_HIGH_MUSDB_PLUS.get_model().to(device).eval()
    wav = torch.from_numpy(np.ascontiguousarray(data[:, :2].T)).to(device)  # (2, samples)
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8  # the model expects normalised input
    sources = separate(model, ((wav - mean) / std)[None], sr) * std + mean
    vocals = sources[model.sources.index("vocals")]
    stems = {"vocals": vocals, "accompaniment": sources.sum(0) - vocals}
    for name, x in stems.items():
        sf.write(out / f"{name}.wav", x.clamp(-1, 1).T.cpu().numpy(), sr, subtype="PCM_16")
    print(device)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
