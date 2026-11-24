import {
  Gruppe,
  Kamera,
  Oben,
  REEL_FPS,
  ReelProps,
  SfxCue,
  Takt,
  Wort,
} from './types';

export const reelDuration = (p: ReelProps, fps: number = REEL_FPS) =>
  Math.max(fps, Math.ceil((p.dauer || 20) * fps));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const klemme = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const cleanDomain = (url: string) =>
  (url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');

// Deterministic PRNG so every reel keeps consistent, repeatable visual variation
export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const zufall = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Recognize tool name tokens (including German inflections) for intentional accenting
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const toolMarken = (woerter: string[], tool: string): boolean[] => {
  const t = (tool || '').split(/\s+/).map(norm).filter(Boolean);
  const res = woerter.map(() => false);
  if (!t.length) return res;
  for (let i = 0; i + t.length <= woerter.length; i++) {
    let ok = true;
    for (let j = 0; j < t.length; j++) {
      const w = norm(woerter[i + j]);
      const letztes = j === t.length - 1;
      if (!(w === t[j] || (letztes && t[j].length >= 4 && w.startsWith(t[j])))) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (let j = 0; j < t.length; j++) res[i + j] = true;
    }
  }
  return res;
};

// Responsive prompt typography & sentence-boundary trimming
export const promptForm = (roh: string) => {
  const s = (roh || '').replace(/\s+/g, ' ').trim();
  let text = s;
  let gekuerzt = false;
  if (s.length > 360) {
    gekuerzt = true;
    const cut = s.slice(0, 290);
    const satz = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    text =
      satz > 170
        ? cut.slice(0, satz + 1) + ' …'
        : cut.slice(0, Math.max(0, cut.lastIndexOf(' '))).replace(/[,;:\s]+$/, '') + ' …';
  }
  const groesse = Math.round(klemme(Math.sqrt(470000 / (1.15 * Math.max(1, text.length))), 32, 48));
  return { text, gekuerzt, groesse };
};

// Organic typing rhythm with natural pauses after words & punctuation
export const tippKurve = (text: string, seed: number) => {
  const r = zufall(seed);
  const cum: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    const vor = text[i - 1] || '';
    let w = 0.55 + r() * 0.88;
    if (vor === ' ') w *= 1.38;
    if (/[,;:]/.test(vor)) w *= 2.3;
    if (/[.!?]/.test(vor)) w *= 3.1;
    if (r() < 0.04) w *= 2.8;
    t += w;
    cum.push(t);
  }
  return cum.map((c) => c / (t || 1));
};

// Phrase grouping preserving EXACT per-word timestamps for active karaoke focus
export const gruppiere = (woerter: Wort[], tool: string): Gruppe[] => {
  const marken = toolMarken(
    woerter.map((w) => w.text),
    tool,
  );
  const gruppen: Gruppe[] = [];
  let akt: Gruppe | null = null;
  let zeichen = 0;

  woerter.forEach((w, i) => {
    const pause = akt ? w.start - akt.end : 0;
    if (
      akt &&
      (zeichen + 1 + w.text.length > 26 || akt.woerter.length >= 4 || pause > 0.45)
    ) {
      gruppen.push(akt);
      akt = null;
    }
    if (!akt) {
      akt = { woerter: [], start: w.start, end: w.end };
      zeichen = 0;
    }
    akt.woerter.push({ text: w.text, start: w.start, end: w.end, tool: marken[i] });
    akt.end = w.end;
    zeichen += (zeichen ? 1 : 0) + w.text.length;
    if (/[.!?:]$/.test(w.text) || (/,$/.test(w.text) && zeichen > 13)) {
      gruppen.push(akt);
      akt = null;
    }
  });
  if (akt) gruppen.push(akt);
  return gruppen;
};

// Returns index of currently spoken word within a phrase at time t (in seconds)
export const aktivesWortIndex = (gruppe: Gruppe, t: number): number => {
  if (!gruppe.woerter.length) return -1;
  // Slightly anticipate word onset by 30ms for perceptual lip/ear sync
  const ts = t + 0.03;
  for (let i = gruppe.woerter.length - 1; i >= 0; i--) {
    if (ts >= gruppe.woerter[i].start) return i;
  }
  return 0;
};

const TOTAL: Kamera = { z: 1, x: 0.5, y: 0, dz: 0.025, dy: 0.015 };
const NAH: Kamera = { z: 1.001, x: 0.5, y: 0.5, dz: 0.012 };

// Editorial camera choreography for website screenshots (guided hero -> focal crops + scroll drift)
const SHOT_CHOREO: Kamera[] = [
  { z: 1.0, x: 0.5, y: 0.02, dz: 0.035, dy: 0.04 },
  { z: 1.38, x: 0.36, y: 0.24, dz: 0.04, dy: 0.03, cursor: { x: 0.38, y: 0.32, klick: true } },
  { z: 1.24, x: 0.52, y: 0.44, dz: 0.035, dy: 0.06 },
  { z: 1.42, x: 0.64, y: 0.30, dz: 0.035, dy: 0.02, cursor: { x: 0.62, y: 0.38, klick: true } },
  { z: 1.28, x: 0.5, y: 0.68, dz: 0.03, dy: 0.04 },
];

export const rollen = (p: ReelProps) => {
  const sz = p.szenen.length
    ? p.szenen
    : [{ titel: p.tool, text: '', start: 0, ende: p.dauer }];
  const n = sz.length;
  const letzte = n - 1;
  const prompt = (p.promptText || '').trim();
  let pIdx = -1;
  if (prompt && n > 1) {
    pIdx = sz.findIndex((s, i) => i > 0 && /prompt/i.test(`${s.titel} ${s.text}`));
    if (pIdx < 0) pIdx = n >= 3 ? n - 2 : letzte;
  }
  const mitte = sz.map((_, i) => i > 0 && i !== pIdx && i !== letzte);
  const nr: number[] = [];
  let k = 0;
  sz.forEach((_, i) => {
    if (mitte[i]) nr[i] = ++k;
  });
  if (pIdx > 0 && pIdx !== letzte && k > 0) nr[pIdx] = ++k;
  const gesamtSchritte = k;
  const schritte = (p.schritte || []).map((s) => String(s).trim()).filter(Boolean);
  let listeTexte = schritte.length
    ? schritte
    : sz.filter((_, i) => nr[i]).map((s) => s.titel);
  if (!listeTexte.length) listeTexte = sz.filter((_, i) => i > 0).map((s) => s.titel);
  if (!listeTexte.length) listeTexte = [cleanDomain(p.toolUrl)];
  return {
    sz,
    n,
    letzte,
    prompt,
    pIdx,
    mitte,
    nr,
    gesamtSchritte,
    schritte,
    listeTexte: listeTexte.slice(0, 5),
  };
};

export const plane = (p: ReelProps, fps: number, gesamt: number, hatShot: boolean) => {
  const { sz, n, letzte, prompt, pIdx, mitte, nr, gesamtSchritte, schritte, listeTexte } = rollen(p);
  const r = zufall(hash(`${p.tool}|${sz[0].titel}`));

  const von = sz.map((s, i) =>
    i === 0 ? 0 : Math.round(klemme(s.start * fps, 1, gesamt - 2)),
  );
  for (let i = 1; i < n; i++) von[i] = Math.max(von[i], von[i - 1] + 1);
  const bis = (i: number) => (i >= letzte ? gesamt : von[i + 1]);

  // Custom focus points from n8n take priority; otherwise curated editorial camera order
  const customShots: Kamera[] = (p.fokus || []).map((f) => ({
    z: f.z ?? 1.38,
    x: klemme(f.x, 0.15, 0.85),
    y: klemme(f.y, 0.05, 0.85),
    dz: 0.035,
    dy: 0.02,
    cursor: { x: klemme(f.x, 0.18, 0.82), y: klemme(f.y, 0.18, 0.78), klick: true },
  }));

  const baseShots = customShots.length
    ? [SHOT_CHOREO[0], ...customShots]
    : [
        SHOT_CHOREO[0],
        ...SHOT_CHOREO.slice(1)
          .map((c) => ({ c, s: r() }))
          .sort((a, b) => a.s - b.s)
          .map((x) => x.c),
      ];

  let si = 0;
  const naechsteShot = () => baseShots[si++ % baseShots.length];

  // Visual beats: at most ~1.65s with subtle organic irregularity
  const teile = (a: number, b: number, maxLen = 1.65 * fps): [number, number][] => {
    const L = b - a;
    if (L <= 0) return [];
    const anz = Math.max(1, Math.ceil(L / maxLen));
    const w = Array.from({ length: anz }, () => 0.86 + r() * 0.28);
    const sum = w.reduce((x, y) => x + y, 0);
    const out: [number, number][] = [];
    let t = a;
    w.forEach((wi, i) => {
      const e = i === anz - 1 ? b : Math.round(t + (L * wi) / sum);
      out.push([t, e]);
      t = e;
    });
    return out;
  };

  const takte: Takt[] = [];
  const oben = (i: number): Oben =>
    i === 0
      ? { art: 'hook', text: sz[0].titel }
      : nr[i]
        ? { art: 'schritt', text: sz[i].titel, nr: nr[i], gesamtSchritte }
        : { art: 'titel', text: sz[i].titel };

  const bildTakt = (
    a: number,
    b: number,
    szenenIdx: number,
    o: Oben,
    j: number,
    aktiv: number,
    mitListe: boolean,
  ): Takt => {
    if (hatShot && !(mitListe && j % 2 === 1)) {
      return { von: a, bis: b, inhalt: 'shot', kam: naechsteShot(), oben: o, szenenIdx, beat: j };
    }
    if (!hatShot && prompt && j % 2 === 1) {
      return { von: a, bis: b, inhalt: 'prompt', kam: TOTAL, oben: o, szenenIdx, beat: j };
    }
    return {
      von: a,
      bis: b,
      inhalt: 'liste',
      kam: j % 2 ? NAH : TOTAL,
      oben: o,
      szenenIdx,
      aktiv,
      beat: j,
    };
  };

  // Detect share CTA in final sentence ("Schick...", "Teil...", "Speicher...")
  let cue = gesamt;
  let loopVon = gesamt;
  if (n > 1) {
    const lStart = von[letzte] / fps - 0.05;
    const w = p.woerter.find(
      (x) => x.start >= lStart && /^(schick|teil|send|speicher|leit|merk)/i.test(x.text),
    );
    cue = w
      ? Math.round(w.start * fps) - Math.round(0.1 * fps)
      : Math.max(von[letzte], gesamt - Math.round(3.2 * fps));
    cue = klemme(cue, von[letzte], gesamt - 1);
    if (cue - von[letzte] < 0.75 * fps) cue = von[letzte];
    loopVon = Math.max(cue + Math.round(0.65 * fps), gesamt - Math.round(0.45 * fps));
    if (loopVon > gesamt - Math.round(0.25 * fps)) loopVon = gesamt;
  }

  // 1) Hook
  const hookEnde = n === 1 ? gesamt : bis(0);
  teile(0, hookEnde).forEach(([a, b], j) => {
    const teaser = !!prompt && (prompt.length <= 210 || !hatShot);
    if (j === 0 && teaser) {
      takte.push({ von: a, bis: b, inhalt: 'prompt', kam: TOTAL, oben: oben(0), szenenIdx: 0, beat: j });
    } else {
      takte.push(bildTakt(a, b, 0, oben(0), teaser ? j + 1 : j, 0, false));
    }
  });

  if (n === 1) {
    const sauber = normalizeTakte(takte, gesamt);
    return { takte: sauber, pIdx, szenenGrenzen: von };
  }

  // 2) Middle step scenes
  for (let i = 1; i < n; i++) {
    if (!mitte[i]) continue;
    teile(von[i], bis(i)).forEach(([a, b], j) =>
      takte.push(bildTakt(a, b, i, oben(i), j, (nr[i] || 1) - 1, schritte.length > 0)),
    );
  }

  // 3) Prompt typing -> highlight sweep -> cursor click "Kopiert"
  const promptBisSchluss = pIdx > 0 && pIdx >= letzte - 1;
  if (pIdx > 0) {
    const a0 = von[pIdx];
    const b0 = promptBisSchluss ? cue : bis(pIdx);
    const o = oben(pIdx);
    const pf = promptForm(prompt);
    const tipp = Math.round(klemme(pf.text.length / 58, 0.85, 2.2) * fps);
    const erst = Math.min(b0, a0 + tipp + Math.round(0.32 * fps));
    const kopiertAb = erst + Math.round(0.55 * fps);
    if (erst > a0) {
      takte.push({
        von: a0,
        bis: erst,
        inhalt: 'prompt',
        kam: TOTAL,
        oben: o,
        szenenIdx: pIdx,
        tippVon: a0,
        beat: 0,
      });
    }
    teile(erst, b0).forEach(([a, b], j) =>
      takte.push({
        von: a,
        bis: b,
        inhalt: 'prompt',
        kam: TOTAL,
        markieren: true,
        kopiertAb,
        oben: o,
        szenenIdx: pIdx,
        tippVon: a0,
        beat: j + 1,
      }),
    );
  }

  if (!promptBisSchluss) {
    const o = oben(letzte - 1);
    teile(von[letzte], cue).forEach(([a, b], j) =>
      takte.push(
        bildTakt(
          a,
          b,
          letzte,
          o,
          j + 1,
          Math.max(0, (nr[letzte - 1] || listeTexte.length) - 1),
          schritte.length > 0,
        ),
      ),
    );
  }

  takte.sort((x, y) => x.von - y.von);

  // 4) Share outro
  teile(cue, loopVon).forEach(([a, b], j) =>
    takte.push({
      von: a,
      bis: b,
      inhalt: 'teilen',
      kam: TOTAL,
      oben: oben(letzte),
      szenenIdx: letzte,
      beat: j,
    }),
  );

  // 5) Seamless loop back to opening frame
  if (loopVon < gesamt && takte.length > 0) {
    takte.push({ ...takte[0], von: loopVon, bis: gesamt, loop: true });
  }

  return { takte: normalizeTakte(takte, gesamt), pIdx, szenenGrenzen: von };
};

const normalizeTakte = (takte: Takt[], gesamt: number): Takt[] => {
  const sauber = takte.filter((t) => t.bis > t.von).sort((x, y) => x.von - y.von);
  for (let i = 0; i < sauber.length - 1; i++) {
    sauber[i].bis = sauber[i + 1].von;
  }
  if (sauber.length) {
    sauber[0].von = 0;
    sauber[sauber.length - 1].bis = gesamt;
  }
  return sauber.filter((t) => t.bis > t.von);
};

// Camera pixel transform clamped strictly inside image bounds, with subtle continuous drift
export const kameraPx = (
  k: Kamera,
  W: number,
  H: number,
  Wv: number,
  Hv: number,
  driftProgress = 0,
) => {
  const dp = klemme(driftProgress, 0, 1);
  const z = k.z + (k.dz ?? 0) * dp;
  const ky = klemme(k.y + (k.dy ?? 0) * dp, 0, 1);
  const fyMax = Math.min(H, Hv * 2.2);
  const tx = klemme(Wv / 2 - k.x * W * z, Math.min(0, Wv - W * z), 0);
  const ty = klemme(Hv / 2 - ky * fyMax * z, Math.min(0, Hv - H * z), 0);
  return { z, tx, ty };
};

// Deterministic studio SFX cues synced to visual cuts, typing cadence, copy click & share
export const planeSfx = (
  takte: Takt[],
  pfText: string,
  kurve: number[],
  fps: number,
  gesamt: number,
): SfxCue[] => {
  const cues: SfxCue[] = [];
  let copyScheduled = false;
  let typedScheduled = false;

  takte.forEach((t, i) => {
    const vor = i > 0 ? takte[i - 1] : undefined;
    const neu = i > 0 && (!vor || vor.inhalt !== t.inhalt || t.loop);

    if (neu && t.von > 0 && t.von < gesamt - 4) {
      if (t.inhalt === 'teilen') {
        cues.push({ frame: t.von, art: 'send', volume: 0.22 });
      } else {
        cues.push({ frame: t.von, art: 'whoosh', volume: 0.16 });
      }
    } else if (i > 0 && t.inhalt === 'liste' && t.kam.z > 1 && t.von < gesamt - 4) {
      cues.push({ frame: t.von + Math.round(0.05 * fps), art: 'pop', volume: 0.18 });
    } else if (i > 0 && t.inhalt === 'teilen' && t.beat > 0 && t.von < gesamt - 4) {
      cues.push({ frame: t.von, art: 'send', volume: 0.18 });
    }

    // Organic soft mechanical keystrokes synchronized to the typing curve (throttled ~100ms min gap)
    if (t.inhalt === 'prompt' && t.tippVon !== undefined && !typedScheduled && pfText.length > 0) {
      typedScheduled = true;
      const tippFrames = Math.round(klemme(pfText.length / 58, 0.85, 2.2) * fps);
      const minGap = Math.max(4, Math.round(0.085 * fps));
      let lastKeyFrame = -minGap;
      let keyIdx = 0;
      const variants: ('key1' | 'key2' | 'key3')[] = ['key1', 'key2', 'key3'];
      for (let k = 0; k < kurve.length; k++) {
        const kf = t.tippVon + Math.round(kurve[k] * tippFrames);
        if (kf - lastKeyFrame >= minGap && kf >= 0 && kf < gesamt - 4) {
          cues.push({
            frame: kf,
            art: variants[keyIdx % variants.length],
            volume: 0.11 + (keyIdx % 3) * 0.018,
          });
          lastKeyFrame = kf;
          keyIdx++;
        }
      }
    }

    // Crisp confirmation chime right when "Kopiert" triggers
    if (
      t.inhalt === 'prompt' &&
      t.kopiertAb !== undefined &&
      !copyScheduled &&
      t.kopiertAb >= t.von &&
      t.kopiertAb < gesamt - 6
    ) {
      copyScheduled = true;
      cues.push({ frame: t.kopiertAb, art: 'copy', volume: 0.24 });
    }
  });

  return cues.sort((a, b) => a.frame - b.frame);
};

// Smooth auto-ducking volume curve for subtle ambient studio bed under speech
export const musikLautstaerke = (
  t: number,
  woerter: Wort[],
  dauer: number,
  basis = 0.075,
): number => {
  const fadeIn = klemme(t / 0.35, 0, 1);
  const fadeOut = klemme((dauer - t) / 0.45, 0, 1);
  const speaking = woerter.some((w) => t >= w.start - 0.12 && t <= w.end + 0.18);
  const duck = speaking ? 0.58 : 1.0;
  return basis * duck * fadeIn * fadeOut;
};
