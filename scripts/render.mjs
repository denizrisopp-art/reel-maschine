// Baut ein Reel aus den Daten von n8n: Assets -> Stimme (ElevenLabs) -> Timing -> Remotion 30fps -> MP4
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { prepareAssets } from './prepare-assets.mjs';

prepareAssets();

const daten = JSON.parse(process.env.DATEN || fs.readFileSync('daten.json', 'utf8'));
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY fehlt (GitHub-Secret)');
const pub = path.resolve('public');
fs.mkdirSync(pub, { recursive: true });
fs.mkdirSync(path.resolve('out'), { recursive: true });

// 1) Stimme mit Zeitstempeln je Buchstabe
const teile = daten.szenen.map((s) => String(s.text).replace(/\s+/g, ' ').trim());
const volltext = teile.join(' ');
const tts = await (
  await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${daten.voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: volltext,
        model_id: 'eleven_multilingual_v2',
        language_code: 'de',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
          speed: 1.1,
        },
      }),
    },
  )
).json();
if (!tts.audio_base64) throw new Error('ElevenLabs: ' + JSON.stringify(tts).slice(0, 300));
fs.writeFileSync(path.join(pub, 'stimme.mp3'), Buffer.from(tts.audio_base64, 'base64'));
const al = tts.alignment;
const zS = al.character_start_times_seconds;
const zE = al.character_end_times_seconds;
const dauer = +(zE[zE.length - 1] + 0.6).toFixed(2);

// Szenengrenzen + Wörter mit Zeit
const starts = [];
let pos = 0;
teile.forEach((t, i) => {
  starts.push(i === 0 ? 0 : zS[Math.min(pos, zS.length - 1)]);
  pos += t.length + 1;
});
const szenen = daten.szenen.map((s, i) => ({
  titel: s.titel,
  text: teile[i],
  start: +starts[i].toFixed(2),
  ende: +(i + 1 < teile.length ? starts[i + 1] : dauer).toFixed(2),
}));
const woerter = [];
let w = null;
al.characters.forEach((ch, k) => {
  if (/\s/.test(ch)) {
    if (w) {
      woerter.push(w);
      w = null;
    }
    return;
  }
  if (!w) w = { text: '', start: zS[k], end: zE[k] };
  w.text += ch;
  w.end = zE[k];
});
if (w) woerter.push(w);

// 2) Screenshot der Tool-Website (optional)
let screenshot;
if (daten.screenshotUrl) {
  try {
    const r = await fetch(daten.screenshotUrl);
    const b = Buffer.from(await r.arrayBuffer());
    const png = b[0] === 0x89;
    const jpg = b[0] === 0xff;
    if (r.ok && (png || jpg)) {
      const n = png ? 'screenshot.png' : 'screenshot.jpg';
      fs.writeFileSync(path.join(pub, n), b);
      screenshot = n;
    }
  } catch (e) {
    console.log('Screenshot nicht geladen:', e.message);
  }
}

// Schritte im Wortlaut der Website & optionale Fokus-Koordinaten (aus n8n)
const schritte = Array.isArray(daten.schritte)
  ? daten.schritte.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
  : undefined;
const fokus = Array.isArray(daten.fokus) ? daten.fokus : undefined;

const props = {
  tool: daten.tool,
  toolUrl: daten.toolUrl,
  promptText: daten.promptText || '',
  schritte,
  fokus,
  screenshot,
  audio: 'stimme.mp3',
  szenen,
  woerter,
  dauer,
  sfx: daten.sfx !== false,
  musik: daten.musik !== false,
};
fs.writeFileSync('props.json', JSON.stringify(props, null, 1));

// 3) Rendern (Instagram-optimiertes 30fps H.264 High Profile yuv420p)
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: props });
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  pixelFormat: 'yuv420p',
  outputLocation: 'out/reel.mp4',
  inputProps: props,
  crf: 17,
  audioBitrate: '192k',
});
console.log('Fertig:', dauer, 's @', composition.fps, 'fps');
