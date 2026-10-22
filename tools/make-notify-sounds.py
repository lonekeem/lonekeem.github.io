#!/usr/bin/env python3
# Generate Kemy's original notification sounds. No recorded or third-party audio.
# Recipes use MIDI note numbers at 44.1 kHz. Output is stereo Ogg Vorbis in sounds/notify/.
# Written by Lone Keem.
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
DUR = 2.4
FADE = 0.35
PEAK = 0.42
WET = 0.28
OUT = Path(__file__).resolve().parents[1] / 'sounds' / 'notify'
N = int(round(DUR * SR))


def midi(note):
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def t_of(n):
    return np.arange(n) / SR


def attack_env(n, seconds):
    a = max(1, int(round(seconds * SR)))
    env = np.ones(n, dtype=np.float64)
    env[:a] = np.linspace(0.0, 1.0, a, endpoint=False)
    return env


def kalimba(f, n=N):
    t = t_of(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-3.2 * t)
    y += 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-14 * t)
    y += 0.1 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-6 * t)
    return y * attack_env(n, 0.002)


def fm(f, ratio, idx, dec, idec, n=N):
    t = t_of(n)
    mod = idx * np.exp(-idec * t) * np.sin(2 * np.pi * f * ratio * t)
    y = np.sin(2 * np.pi * f * t + mod) * np.exp(-dec * t)
    return y * attack_env(n, 0.002)


def rhodes(f, n=N):
    return fm(f, 1, 1.4, 1.8, 3, n) + 0.15 * fm(2 * f, 1, 0.3, 2.6, 5, n)


def glass(f, n=N):
    return fm(f, 3.5, 1.6, 1.4, 2.5, n)


def pluck(f, n=N, damp=0.996, seed=1):
    period = max(2, int(round(SR / f)))
    rng = np.random.default_rng(seed)
    buf = rng.uniform(-1.0, 1.0, period)
    buf -= buf.mean()
    out = np.empty(n, dtype=np.float64)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nxt = buf[(idx + 1) % period]
        buf[idx] = damp * 0.5 * (buf[idx] + nxt)
        idx = (idx + 1) % period
    return out * attack_env(n, 0.002)


def pad(f, n=N):
    t = t_of(n)
    y = np.zeros(n, dtype=np.float64)
    for det in (0.997, 1.0, 1.003):
        y += np.sin(2 * np.pi * f * det * t)
    y /= 3.0
    att = np.minimum(1.0, t / 0.25)
    return y * att * np.exp(-1.6 * t)


def lowpass(x, cutoff):
    a = 1.0 - np.exp(-2.0 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    z = 0.0
    for i in range(len(x)):
        z += a * (x[i] - z)
        y[i] = z
    return y


def add_at(buf, sig, at):
    i0 = int(round(at * SR))
    if i0 >= len(buf) or i0 < 0:
        return
    m = min(len(sig), len(buf) - i0)
    buf[i0:i0 + m] += sig[:m]


def soft_breeze():
    # E5 then B5, 0.4 s apart. Sine, a 0.15 second harmonic, and a +1.5 Hz copy.
    buf = np.zeros(N, dtype=np.float64)
    for f, at in ((midi(76), 0.0), (midi(83), 0.4)):
        t = t_of(N)
        local = t
        att = np.clip(local / 0.03, 0.0, 1.0)
        env = att * np.exp(-1.8 * local)
        voice = (np.sin(2 * np.pi * f * local)
                 + 0.15 * np.sin(2 * np.pi * (2 * f) * local)
                 + np.sin(2 * np.pi * (f + 1.5) * local)
                 + 0.15 * np.sin(2 * np.pi * (2 * f + 1.5) * local))
        add_at(buf, voice * env, at)
    return buf


def reverb_ir():
    n = int(round(1.6 * SR))
    pre = int(round(0.012 * SR))
    rng = np.random.default_rng(7)
    noise = rng.normal(0.0, 1.0, (2, n))
    env = np.exp(-4.2 * t_of(n))
    ir = noise * env
    ir[:, :pre] = 0.0
    spread = 17
    shifted = np.zeros(n)
    shifted[spread:] = ir[1, :-spread]
    ir[1] = shifted
    peak = np.max(np.abs(ir))
    if peak > 0:
        ir /= peak
    return ir


IR = None


def fft_convolve(x, h):
    n = len(x) + len(h) - 1
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)
    return y[:len(x)]


def finish(mono, peak=PEAK):
    global IR
    if IR is None:
        IR = reverb_ir()
    wet_l = fft_convolve(mono, IR[0])
    wet_r = fft_convolve(mono, IR[1])
    dry_peak = np.max(np.abs(mono)) + 1e-9
    wet_peak = max(np.max(np.abs(wet_l)), np.max(np.abs(wet_r))) + 1e-9
    wet_l *= dry_peak / wet_peak
    wet_r *= dry_peak / wet_peak
    dry = 1.0 - WET
    left = dry * mono + WET * wet_l
    right = dry * mono + WET * wet_r
    top = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-9)
    g = peak / top
    left *= g
    right *= g
    fade_n = int(round(FADE * SR))
    ramp = np.linspace(1.0, 0.0, fade_n, endpoint=True)
    left[-fade_n:] *= ramp
    right[-fade_n:] *= ramp
    stereo = np.stack([left, right], axis=1).astype(np.float32)
    return np.clip(stereo, -1.0, 1.0)


def write_ogg(name, stereo):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{name}.ogg'
    proc = subprocess.run(
        ['ffmpeg', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'pipe:0',
         '-c:a', 'libvorbis', '-q:a', '2', str(path)],
        input=stereo.tobytes(), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.decode('utf-8', 'replace')[-500:])
    top = float(np.max(np.abs(stereo)))
    print(f'{path.name:24} {stereo.shape[0] / SR:.2f}s  peak {top:.3f}  {path.stat().st_size // 1024} KB')


def build(name, mono, peak=PEAK):
    write_ogg(name, finish(mono, peak))


def main():
    # Gentle one-pole cutoff for the sounds marked lowpassed.
    LO = 1400.0
    LOFI = 900.0

    build('soft-breeze', soft_breeze())

    hello = np.zeros(N)
    add_at(hello, kalimba(midi(76)), 0.0)
    add_at(hello, kalimba(midi(83)), 0.14)
    build('kalimba-hello', hello)

    sparkle = np.zeros(N)
    for i, note in enumerate((79, 83, 86, 91)):
        add_at(sparkle, kalimba(midi(note)), i * 0.09)
    build('kalimba-sparkle', sparkle)

    lofi = np.zeros(N)
    add_at(lofi, lowpass(rhodes(midi(64)), LOFI), 0.0)
    add_at(lofi, lowpass(rhodes(midi(71)), LOFI), 0.02)
    add_at(lofi, lowpass(rhodes(midi(76)), LOFI), 0.22)
    build('lo-fi-keys', lofi)

    velvet = np.zeros(N)
    add_at(velvet, rhodes(midi(81)), 0.0)
    add_at(velvet, rhodes(midi(88)), 0.18)
    build('velvet-ping', velvet)

    drop = np.zeros(N)
    add_at(drop, glass(midi(88)), 0.0)
    add_at(drop, glass(midi(83)), 0.2)
    build('glass-drop', drop)

    pair = np.zeros(N)
    add_at(pair, glass(midi(84)), 0.0)
    add_at(pair, glass(midi(91)), 0.0)
    add_at(pair, glass(midi(88)), 0.25)
    build('crystal-pair', pair)

    plucked = np.zeros(N)
    for i, note in enumerate((67, 74, 79)):
        add_at(plucked, lowpass(pluck(midi(note), seed=100 + note), LO), i * 0.12)
    build('soft-pluck', plucked)

    build('pocket-bell', fm(midi(86), 2, 1.2, 2.4, 5))

    dream = pad(midi(64)) + pad(midi(71)) + kalimba(midi(83))
    build('dreamy-pad-ping', dream)

    bubble = np.zeros(N)
    add_at(bubble, lowpass(fm(midi(79), 1, 3, 6, 30), LO), 0.0)
    add_at(bubble, lowpass(fm(midi(86), 1, 3, 6, 30), LO), 0.13)
    build('soft-bubble-pop', bubble)

    glow = pad(midi(60)) + pad(midi(67))
    add_at(glow, glass(midi(84)), 0.2)
    build('night-glow', glow)

    blink = np.zeros(N)
    add_at(blink, glass(midi(95)), 0.0)
    add_at(blink, kalimba(midi(88)), 0.08)
    add_at(blink, glass(midi(100)), 0.2)
    build('star-blink', blink, peak=0.28)

    chord = np.zeros(N)
    for note in (60, 64, 67, 71):
        chord += rhodes(midi(note))
    build('cozy-chord', lowpass(chord, LO))

    pebble = np.zeros(N)
    add_at(pebble, lowpass(fm(midi(84), 1.5, 2, 9, 25), LO), 0.0)
    add_at(pebble, lowpass(fm(midi(91), 1.5, 2, 9, 25), LO), 0.1)
    build('pebble-tap', pebble)

    ascend = np.zeros(N)
    for i, note in enumerate((72, 76, 79, 84)):
        add_at(ascend, kalimba(midi(note)), i * 0.16)
    build('calm-ascend', ascend)

    harp = np.zeros(N)
    for i, note in enumerate((67, 71, 74, 79, 83)):
        add_at(harp, pluck(midi(note), seed=200 + note), i * 0.07)
    build('moon-harp', harp)

    friend = np.zeros(N)
    add_at(friend, rhodes(midi(76)), 0.0)
    add_at(friend, kalimba(midi(81)), 0.16)
    add_at(friend, glass(midi(88)), 0.32)
    build('hello-friend', friend)

    ding = fm(midi(88), 1, 0.6, 1.5, 3) + 0.45 * pad(midi(76))
    build('airy-ding', ding)


if __name__ == '__main__':
    main()
