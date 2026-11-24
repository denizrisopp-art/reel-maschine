import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 44100;

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

// Deterministic PRNG for noise synthesis
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One-pole low-pass filter for warm, studio-damped textures
function lowpass(input, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(input.length);
  let prev = 0;
  for (let i = 0; i < input.length; i++) {
    prev = prev + alpha * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

// Soft organic air whoosh for scene cuts (0.28s)
function synthWhoosh() {
  const len = Math.floor(SAMPLE_RATE * 0.28);
  const rng = makeRng(101);
  const raw = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const env = Math.sin(Math.PI * Math.pow(p, 0.72));
    // Dynamic filter sweep from 280 Hz up to 1350 Hz and back to 320 Hz
    const cutoff = 280 + 1050 * Math.sin(Math.PI * p);
    const alpha = Math.min(0.6, (2 * Math.PI * cutoff) / SAMPLE_RATE);
    const white = rng() * 2 - 1;
    lp += alpha * (white - lp);
    const sub = Math.sin(2 * Math.PI * (95 + 55 * p) * (i / SAMPLE_RATE)) * 0.14;
    raw[i] = (lp * 0.65 + sub) * env * 0.55;
  }
  return lowpass(raw, 1800);
}

// Warm tactile micro-pop for step / card focus (0.09s)
function synthPop() {
  const len = Math.floor(SAMPLE_RATE * 0.09);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 58) * Math.min(1, t / 0.003);
    const freq = 165 + 240 * Math.exp(-t * 85);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * env * 0.52;
  }
  return lowpass(out, 1400);
}

// Soft damped Mac-style mechanical keystroke with slight pitch variant (0.045s)
function synthKey(seed, pitchFactor) {
  const len = Math.floor(SAMPLE_RATE * 0.045);
  const rng = makeRng(seed);
  const raw = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const clickEnv = Math.exp(-t * 190) * Math.min(1, t / 0.0012);
    const bodyEnv = Math.exp(-t * 85) * Math.min(1, t / 0.002);
    const click = (rng() * 2 - 1) * clickEnv * 0.55;
    const body = Math.sin(2 * Math.PI * (240 * pitchFactor) * t) * bodyEnv * 0.35;
    const resonance = Math.sin(2 * Math.PI * (980 * pitchFactor) * t) * clickEnv * 0.18;
    raw[i] = (click + body + resonance) * 0.6;
  }
  return lowpass(raw, 2200);
}

// Tactile click + subtle warm two-note confirmation for "Kopiert" (0.22s)
function synthCopy() {
  const len = Math.floor(SAMPLE_RATE * 0.22);
  const out = new Float32Array(len);
  const rng = makeRng(303);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    // Initial tactile click
    const click = (rng() * 2 - 1) * Math.exp(-t * 240) * 0.25;
    // Soft harmonic pair (D5 -> A5, warm bell-like sine with quick gentle decay)
    const n1 = Math.sin(2 * Math.PI * 587.33 * t) * Math.exp(-t * 28) * Math.min(1, t / 0.004) * 0.28;
    const t2 = Math.max(0, t - 0.055);
    const n2 = t >= 0.055
      ? Math.sin(2 * Math.PI * 880 * t2) * Math.exp(-t2 * 22) * Math.min(1, t2 / 0.005) * 0.26
      : 0;
    out[i] = click + n1 + n2;
  }
  return lowpass(out, 2600);
}

// Light upward air sweep for paper plane share animation (0.36s)
function synthSend() {
  const len = Math.floor(SAMPLE_RATE * 0.36);
  const rng = makeRng(404);
  const raw = new Float32Array(len);
  let lp = 0;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const env = Math.sin(Math.PI * Math.pow(p, 0.8)) * (1 - 0.2 * p);
    const cutoff = 350 + 1700 * Math.pow(p, 1.15);
    const alpha = Math.min(0.65, (2 * Math.PI * cutoff) / SAMPLE_RATE);
    lp += alpha * ((rng() * 2 - 1) - lp);
    const freq = 280 + 260 * Math.pow(p, 1.3);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    const tone = Math.sin(phase) * Math.exp(-p * 3.2) * 0.14;
    raw[i] = (lp * 0.5 + tone) * env * 0.48;
  }
  return lowpass(raw, 2400);
}

// Seamless 8-second ultra-minimal warm studio pulse bed (deeply low-passed, zero distracting melody)
function synthBed() {
  const durationSec = 8; // exact integer seconds for clean harmonic loop
  const len = SAMPLE_RATE * durationSec;
  const out = new Float32Array(len);
  // Warm D minor 9 voicing with integer-cycle frequencies over 8s so phase wraps seamlessly at loop boundary
  const snapFreq = (hz) => Math.round(hz * durationSec) / durationSec;
  const notes = [
    { f: snapFreq(73.42), a: 0.22 },   // D2 sub
    { f: snapFreq(146.83), a: 0.16 },  // D3
    { f: snapFreq(174.61), a: 0.11 },  // F3
    { f: snapFreq(220.0), a: 0.10 },   // A3
    { f: snapFreq(261.63), a: 0.07 },  // C4
    { f: snapFreq(329.63), a: 0.05 },  // E4
  ];
  // 120 BPM = 2 beats/sec -> 16 beats in 8 seconds (exact loop)
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const beatPhase = (t * 2) % 1;
    // Ultra-soft muted sidechain breathing pulse
    const pulse = 0.72 + 0.28 * Math.sin(Math.PI * beatPhase);
    // Subtle muted kick thump on beats 1 and 3 (every 1.0s)
    const barPhase = t % 1;
    const thump = barPhase < 0.14
      ? Math.sin(2 * Math.PI * (62 + 48 * Math.exp(-barPhase * 32)) * barPhase) * Math.exp(-barPhase * 26) * 0.19
      : 0;
    let chord = 0;
    for (let k = 0; k < notes.length; k++) {
      const slowDrift = 0.85 + 0.15 * Math.sin(2 * Math.PI * ((k + 1) / durationSec) * t);
      chord += Math.sin(2 * Math.PI * notes[k].f * t) * notes[k].a * slowDrift;
    }
    out[i] = (chord * pulse + thump) * 0.55;
  }
  return lowpass(out, 620);
}

export function prepareAssets() {
  // 1) Local Inter fonts fallback
  const fontSrcDir = path.resolve('node_modules/@fontsource/inter/files');
  const fontOutDir = path.resolve('public/fonts');
  if (fs.existsSync(fontSrcDir)) {
    fs.mkdirSync(fontOutDir, { recursive: true });
    const weights = [500, 600, 700, 800, 900];
    const subsets = ['latin', 'latin-ext'];
    for (const sub of subsets) {
      for (const w of weights) {
        const name = `inter-${sub}-${w}-normal.woff2`;
        const src = path.join(fontSrcDir, name);
        const dst = path.join(fontOutDir, name);
        if (fs.existsSync(src) && !fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  }

  // 2) Tactile studio SFX & subtle ambient bed
  const sfxDir = path.resolve('public/sfx');
  fs.mkdirSync(sfxDir, { recursive: true });
  const files = {
    'whoosh.wav': () => synthWhoosh(),
    'pop.wav': () => synthPop(),
    'key1.wav': () => synthKey(201, 0.94),
    'key2.wav': () => synthKey(202, 1.02),
    'key3.wav': () => synthKey(203, 1.11),
    'copy.wav': () => synthCopy(),
    'send.wav': () => synthSend(),
    'bed.wav': () => synthBed(),
  };
  for (const [name, generator] of Object.entries(files)) {
    const target = path.join(sfxDir, name);
    if (!fs.existsSync(target)) {
      writeWav(target, generator());
    }
  }
}

// Run directly when executed as a script
const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirect) {
  prepareAssets();
}
