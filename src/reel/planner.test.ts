import test from 'node:test';
import assert from 'node:assert/strict';
import beispiel from '../beispiel.json';
import {
  aktivesWortIndex,
  cleanDomain,
  gruppiere,
  kameraPx,
  musikLautstaerke,
  plane,
  planeSfx,
  promptForm,
  reelDuration,
  tippKurve,
  toolMarken,
} from './planner';
import { REEL_FPS, ReelProps } from './types';

const sample = beispiel as ReelProps;

test('reelDuration scales with fps and enforces minimum 1 second', () => {
  assert.equal(reelDuration(sample, 60), Math.ceil(sample.dauer * 60));
  assert.equal(reelDuration({ ...sample, dauer: 0.2 }, 60), 60);
});

test('cleanDomain strips protocol, www, and trailing slash', () => {
  assert.equal(cleanDomain('https://www.meta.ai/'), 'meta.ai');
  assert.equal(cleanDomain('http://claude.ai/chat/'), 'claude.ai/chat');
});

test('toolMarken detects multi-word tool names and German inflections', () => {
  const tokens = ['Öffne', 'dafür', 'Meta', 'AI', 'direkt', 'im', 'Chat'];
  assert.deepEqual(toolMarken(tokens, 'Meta AI'), [false, false, true, true, false, false, false]);
  const inflected = ['Mit', 'Perplexitys', 'Suche'];
  assert.deepEqual(toolMarken(inflected, 'Perplexity'), [false, true, false]);
});

test('gruppiere preserves per-word timestamps and aktivesWortIndex tracks speech accurately', () => {
  const gruppen = gruppiere(sample.woerter, sample.tool);
  assert.ok(gruppen.length > 0);
  const totalWords = gruppen.reduce((acc, g) => acc + g.woerter.length, 0);
  assert.equal(totalWords, sample.woerter.length);

  const first = gruppen[0];
  assert.ok(first.woerter.length >= 2);
  assert.equal(aktivesWortIndex(first, first.woerter[0].start), 0);
  assert.equal(aktivesWortIndex(first, first.woerter[1].start + 0.01), 1);
});

test('plane produces a gapless, non-overlapping timeline from 0 to gesamt', () => {
  const gesamt = reelDuration(sample, REEL_FPS);
  const { takte, pIdx } = plane(sample, REEL_FPS, gesamt, false);
  assert.ok(takte.length >= 6);
  assert.equal(pIdx, 2);
  assert.equal(takte[0].von, 0);
  assert.equal(takte[takte.length - 1].bis, gesamt);

  for (let i = 0; i < takte.length; i++) {
    assert.ok(takte[i].bis > takte[i].von, `takt ${i} has positive duration`);
    if (i > 0) {
      assert.equal(takte[i].von, takte[i - 1].bis, `no gap between takt ${i - 1} and ${i}`);
    }
  }
  assert.ok(takte.some((t) => t.inhalt === 'prompt' && t.kopiertAb !== undefined));
  assert.ok(takte.some((t) => t.inhalt === 'teilen'));
  assert.equal(takte[takte.length - 1].loop, true);
});

test('plane handles single-scene reels gracefully without crashing', () => {
  const oneScene: ReelProps = {
    ...sample,
    szenen: [sample.szenen[0]],
    dauer: 6,
  };
  const gesamt = reelDuration(oneScene, REEL_FPS);
  const { takte } = plane(oneScene, REEL_FPS, gesamt, true);
  assert.ok(takte.length >= 1);
  assert.equal(takte[0].von, 0);
  assert.equal(takte[takte.length - 1].bis, gesamt);
});

test('kameraPx strictly clamps transform within screenshot boundaries even with drift', () => {
  const W = 868;
  const H = 1400;
  const Wv = 868;
  const Hv = 620;
  const res = kameraPx({ z: 1.5, x: 0.99, y: 0.99, dz: 0.05, dy: 0.1 }, W, H, Wv, Hv, 1);
  assert.ok(res.tx <= 0 && res.tx >= Wv - W * res.z);
  assert.ok(res.ty <= 0 && res.ty >= Hv - H * res.z);
});

test('planeSfx generates bounded cues including typing and copy confirmation', () => {
  const gesamt = reelDuration(sample, REEL_FPS);
  const { takte } = plane(sample, REEL_FPS, gesamt, false);
  const pf = promptForm(sample.promptText || '');
  const kurve = tippKurve(pf.text, 42);
  const cues = planeSfx(takte, pf.text, kurve, REEL_FPS, gesamt);

  assert.ok(cues.length >= 5);
  assert.ok(cues.some((c) => c.art === 'copy'));
  assert.ok(cues.some((c) => c.art === 'key1' || c.art === 'key2'));
  assert.ok(cues.some((c) => c.art === 'send'));
  for (const cue of cues) {
    assert.ok(cue.frame >= 0 && cue.frame < gesamt, `cue frame ${cue.frame} within bounds`);
  }
});

test('musikLautstaerke ducks during speech and fades cleanly at edges', () => {
  const speakingVol = musikLautstaerke(0.7, sample.woerter, sample.dauer, 0.08);
  const gapVol = musikLautstaerke(20.9, sample.woerter, sample.dauer, 0.08);
  const startVol = musikLautstaerke(0, sample.woerter, sample.dauer, 0.08);
  const endVol = musikLautstaerke(sample.dauer, sample.woerter, sample.dauer, 0.08);

  assert.equal(startVol, 0);
  assert.equal(endVol, 0);
  assert.ok(speakingVol < 0.08 * 0.7);
  assert.ok(gapVol > 0);
});
