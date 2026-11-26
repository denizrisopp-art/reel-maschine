import {
  Gruppe,
  Kamera,
  Oben,
  REEL_FPS,
  ReelProps,
  SfxCue,
  BAR,
  BildMasse,
  BUEHNE,
  Takt,
  Tinte,
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
// v45: Ausschnitte zoomen nicht mehr während des Takts (dz 0), sie wandern nur senkrecht wie beim
// Scrollen; Takte mit Klick stehen still, damit der Zeiger auf seinem Ziel bleibt.
const SHOT_CHOREO: Kamera[] = [
  { z: 1.0, x: 0.5, y: 0.02, dz: 0.02, dy: 0.04 },
  { z: 1.38, x: 0.36, y: 0.24, dz: 0, dy: 0, cursor: { x: 0.38, y: 0.32, klick: true } },
  { z: 1.24, x: 0.52, y: 0.44, dz: 0, dy: 0.06 },
  { z: 1.42, x: 0.64, y: 0.30, dz: 0, dy: 0, cursor: { x: 0.62, y: 0.38, klick: true } },
  { z: 1.28, x: 0.5, y: 0.68, dz: 0, dy: 0.04 },
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
  // v51: Varianten ohne Screenshot (Startansicht der Schritt-Szenen), unabhängig vom Kamera-Zufall
  const kartenStart = hash(`${p.tool}|${p.toolUrl}|karten`) % 2;
  const promptListe = !schritte.length && pIdx > 0 && nr[pIdx] ? nr[pIdx] - 1 : -1;

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
    dz: 0,
    dy: 0,
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
    if (!hatShot) {
      // v51: ohne Screenshot wechselt jeder Takt die Ansicht (ein Schritt groß ↔ ganzer Ablauf),
      // Startansicht je Reel aus dem Hash, damit zwei Reels nicht gleich aufgebaut sind.
      const gross = (j + kartenStart) % 2 === 0;
      if (szenenIdx === 0) {
        // Hook: Bild 0 zeigt den ganzen Ablauf im Überblick, danach die Schritte einzeln als Vorschau
        if (j === 0 || listeTexte.length < 2) {
          return { von: a, bis: b, inhalt: 'liste', kam: j % 2 ? NAH : TOTAL, oben: o, szenenIdx, aktiv: -1, beat: j };
        }
        const vorschau = Math.max(0, (prompt ? j - 2 : j - 1) % listeTexte.length);
        // der Prompt-Schritt hat seine eigene Karte; als Vorschau lieber den ganzen Ablauf zeigen
        if (vorschau === promptListe) {
          return { von: a, bis: b, inhalt: 'liste', kam: TOTAL, oben: o, szenenIdx, aktiv: -1, beat: j };
        }
        return { von: a, bis: b, inhalt: 'schritt', kam: NAH, oben: o, szenenIdx, aktiv: vorschau, beat: j };
      }
      if (gross && aktiv < listeTexte.length) {
        return { von: a, bis: b, inhalt: 'schritt', kam: NAH, oben: o, szenenIdx, aktiv, beat: j };
      }
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
  const fyMax = Math.min(H, Hv * 2.2);
  if (k.fest) {
    // v45: ausgerichteter Ausschnitt; scrollt senkrecht, ein leichter Zoom (nur Totale) bleibt mittig
    const v = k.fest.v0 + (((k.dy ?? 0) * fyMax) / Math.max(1, H)) * dp;
    const uc = k.fest.u0 + Wv / (2 * W * k.z);
    const vc = v + Hv / (2 * H * k.z);
    return {
      z,
      tx: klemme(Wv / 2 - uc * W * z, Math.min(0, Wv - W * z), 0),
      ty: klemme(Hv / 2 - vc * H * z, Math.min(0, Hv - H * z), 0),
    };
  }
  const ky = klemme(k.y + (k.dy ?? 0) * dp, 0, 1);
  const tx = klemme(Wv / 2 - k.x * W * z, Math.min(0, Wv - W * z), 0);
  const ty = klemme(Hv / 2 - ky * fyMax * z, Math.min(0, Hv - H * z), 0);
  return { z, tx, ty };
};

// v45: Kantenkarte aus RGBA-Pixeln (verkleinerter Screenshot). 1 = hier ist Schrift oder eine Kante.
export const tintenKarte = (rgba: ArrayLike<number>, gw: number, gh: number): Tinte => {
  const L = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) {
    L[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  const d = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const gx = x + 1 < gw ? Math.abs(L[i + 1] - L[i]) : 0;
      const gy = y + 1 < gh ? Math.abs(L[i + gw] - L[i]) : 0;
      d[i] = gx + gy > 26 ? 1 : 0;
    }
  }
  return { gw, gh, d };
};

// v45: Summentabellen der Kantenkarte (einmal je Screenshot), damit die Suche schnell bleibt
type TintenTabellen = { I: Int32Array; PV: Int32Array; PH: Int32Array };
const tabellenCache = new WeakMap<Tinte, TintenTabellen>();
const tabellen = (t: Tinte): TintenTabellen => {
  const vorhanden = tabellenCache.get(t);
  if (vorhanden) return vorhanden;
  const { gw, gh, d } = t;
  const I = new Int32Array((gw + 1) * (gh + 1));
  for (let y = 0; y < gh; y++) {
    let zeile = 0;
    for (let x = 0; x < gw; x++) {
      zeile += d[y * gw + x];
      I[(y + 1) * (gw + 1) + x + 1] = I[y * (gw + 1) + x + 1] + zeile;
    }
  }
  // PV: je Spalte, wie viele Zeilen in einem 3 Zellen breiten Streifen Schrift haben (Präfix über y)
  const PV = new Int32Array(gw * (gh + 1));
  for (let x = 0; x < gw; x++) {
    for (let y = 0; y < gh; y++) {
      const i = y * gw + x;
      const hat = d[i] | (x > 0 ? d[i - 1] : 0) | (x + 1 < gw ? d[i + 1] : 0);
      PV[x * (gh + 1) + y + 1] = PV[x * (gh + 1) + y] + hat;
    }
  }
  // PH: je Zeile, wie viele Spalten in einem 3 Zellen hohen Streifen Schrift haben (Präfix über x)
  const PH = new Int32Array(gh * (gw + 1));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const hat = d[i] | (y > 0 ? d[i - gw] : 0) | (y + 1 < gh ? d[i + gw] : 0);
      PH[y * (gw + 1) + x + 1] = PH[y * (gw + 1) + x] + hat;
    }
  }
  const neu = { I, PV, PH };
  tabellenCache.set(t, neu);
  return neu;
};

// Geometrie des Browserfensters auf der Bühne (gleich wie in BrowserRahmen)
export const shotGeometrie = (masse: BildMasse) => {
  const Wv = BUEHNE.b - 2;
  const W = Wv;
  const H = (W * masse.h) / Math.max(1, masse.b);
  const hv = Math.min(BUEHNE.h - BAR - 2, H);
  return { W, H, Wv, hv, schmal: masse.b < 1000 || masse.h > masse.b };
};

type Ausschnitt = { u: number; v: number; cw: number; ch: number };

const ueberlappung = (a: Ausschnitt, b: Ausschnitt) => {
  const iw = Math.max(0, Math.min(a.u + a.cw, b.u + b.cw) - Math.max(a.u, b.u));
  const ih = Math.max(0, Math.min(a.v + a.ch, b.v + b.ch) - Math.max(a.v, b.v));
  const i = iw * ih;
  return i / (a.cw * a.ch + b.cw * b.ch - i || 1);
};

/**
 * v45: Zoom-Ausschnitt so legen, dass seine Ränder nicht durch Wörter schneiden.
 * Mit Kantenkarte: Suche über Zoomstufe, Lage und Scrollrichtung nach Rändern im Leerraum
 * (Seitenrand, Abstand zwischen Spalten, Karten oder Zeilen), nicht auf leerer Fläche, nahe am Plan
 * und anders als der vorige Ausschnitt; der Zeiger landet auf echtem Inhalt.
 * Ohne Karte: an die nähere Seitenkante legen, Zoom begrenzt.
 * Hochformat/schmal (Mobilansicht, ohnehin groß im Bild): höchstens 1,25-fach.
 */
export const ausrichten = (
  kam: Kamera,
  W: number,
  H: number,
  Wv: number,
  Hv: number,
  schmal: boolean,
  tinte?: Tinte,
  meiden?: Ausschnitt,
): Kamera => {
  if (W <= 0 || H <= 0) return kam;
  const totale = kam.z <= 1.01;
  if (totale && !tinte) return kam;
  const fyMax = Math.min(H, Hv * 2.2);
  const dyPlan = kam.cursor ? 0 : kam.dy ?? 0;
  const geometrie = (z: number, dy: number) => {
    const cw = Math.min(1, Wv / (W * z));
    const ch = Math.min(1, Hv / (H * z));
    const dv = (dy * fyMax) / H;
    const uMax = Math.max(0, 1 - cw);
    const vMin = Math.max(0, -dv);
    const vMax = Math.max(vMin, 1 - ch - Math.max(0, dv));
    const pu = klemme(-klemme(Wv / 2 - kam.x * W * z, Math.min(0, Wv - W * z), 0) / (W * z), 0, uMax);
    const ky = klemme(kam.y, 0, 1);
    const pv = klemme(-klemme(Hv / 2 - ky * fyMax * z, Math.min(0, Hv - H * z), 0) / (H * z), vMin, vMax);
    return { cw, ch, dv, uMax, vMin, vMax, pu, pv };
  };
  const basis = (z: number, dy: number): Kamera => ({ ...kam, z, dz: totale ? kam.dz : 0, dy });

  if (!tinte) {
    const z = Math.min(kam.z, schmal ? 1.25 : 1.35);
    const g = geometrie(z, dyPlan);
    return { ...basis(z, dyPlan), fest: { u0: g.pu < g.uMax / 2 ? 0 : g.uMax, v0: g.pv } };
  }

  const { gw, gh } = tinte;
  const { I, PV, PH } = tabellen(tinte);
  const zx = (u: number) => klemme(Math.round(u * gw), 0, gw);
  const zy = (v: number) => klemme(Math.round(v * gh), 0, gh);
  const summe = (x0: number, y0: number, x1: number, y1: number) =>
    I[y1 * (gw + 1) + x1] - I[y0 * (gw + 1) + x1] - I[y1 * (gw + 1) + x0] + I[y0 * (gw + 1) + x0];
  const innen = (u0: number, v0: number, u1: number, v1: number) => {
    const x0 = zx(u0), x1 = Math.max(x0 + 1, zx(u1)), y0 = zy(v0), y1 = Math.max(y0 + 1, zy(v1));
    return summe(x0, y0, Math.min(gw, x1), Math.min(gh, y1)) / ((x1 - x0) * (y1 - y0));
  };
  // Schnittkante trifft Schrift: jeder Schnitt kostet, mehr geschnittene Zeilen kosten mehr
  const schnittU = (u: number, v0: number, v1: number) => {
    if (u <= 0.003 || u >= 0.997) return 0;
    const x = klemme(Math.round(u * gw), 0, gw - 1);
    const y0 = zy(v0), y1 = Math.max(y0 + 1, zy(v1));
    const n = PV[x * (gh + 1) + Math.min(gh, y1)] - PV[x * (gh + 1) + y0];
    return (n >= 2 ? 1 : 0) + (8 * n) / (y1 - y0);
  };
  const schnittV = (v: number, u0: number, u1: number) => {
    if (v <= 0.003 || v >= 0.997) return 0;
    const y = klemme(Math.round(v * gh), 0, gh - 1);
    const x0 = zx(u0), x1 = Math.max(x0 + 1, zx(u1));
    const n = PH[y * (gw + 1) + Math.min(gw, x1)] - PH[y * (gw + 1) + x0];
    return (n >= 3 ? 0.6 : 0) + (4 * n) / (x1 - x0);
  };

  // Zeile y (Zelle) hat zwischen x0 und x1 Schrift?
  const zeileTinte = (y: number, x0: number, x1: number) =>
    PH[y * (gw + 1) + x1] - PH[y * (gw + 1) + x0] > 0;
  // Anteil leerer Zeilen im Ausschnitt (viel leere Fläche wirkt wie ein Zufallsausschnitt)
  const leerAnteil = (u0: number, v0: number, u1: number, v1: number) => {
    const x0 = zx(u0), x1 = Math.max(x0 + 1, zx(u1)), y0 = zy(v0), y1 = Math.max(y0 + 1, zy(v1));
    let leer = 0;
    for (let y = y0; y < Math.min(gh, y1); y++) if (!zeileTinte(y, x0, x1)) leer++;
    return leer / (y1 - y0);
  };
  // Waagerechte Kante in einer schmalen Lücke (zwischen zwei Zeilen desselben Absatzes)?
  const engeLuecke = (v: number, u0: number, u1: number, pxJeZelle: number) => {
    if (v <= 0.003 || v >= 0.997) return 0;
    const x0 = zx(u0), x1 = Math.max(x0 + 1, zx(u1));
    const y = klemme(Math.round(v * gh), 0, gh - 1);
    if (zeileTinte(y, x0, x1)) return 0; // schon als Schnitt gezählt
    const grenze = Math.ceil(56 / pxJeZelle);
    let oben = 0;
    while (oben < grenze && y - oben - 1 >= 0 && !zeileTinte(y - oben - 1, x0, x1)) oben++;
    if (y - oben - 1 < 0) return 0;
    let unten = 0;
    while (unten < grenze && y + unten + 1 < gh && !zeileTinte(y + unten + 1, x0, x1)) unten++;
    if (y + unten + 1 >= gh) return 0;
    const lueckePx = (oben + unten + 1) * pxJeZelle;
    return lueckePx < 56 ? 1 - lueckePx / 56 : 0;
  };

  const zPlan = totale ? 1 : Math.min(kam.z, schmal ? 1.25 : 1.9);
  const zMax = schmal ? 1.25 : 1.9;
  const zStufen = [zPlan];
  if (!totale) for (let z = 1.0; z <= zMax + 1e-6; z += 0.025) zStufen.push(+z.toFixed(3));
  // Scrollen nach unten wie geplant, nach oben oder (mit kleinem Abzug) stillstehen
  const scrolls = dyPlan ? [dyPlan, -dyPlan, 0] : [0];

  let best = { s: Infinity, z: zPlan, u: 0, v: 0, dy: dyPlan };
  for (const z of zStufen) {
    for (const dy of scrolls) {
      const g = geometrie(z, dy);
      const uSchritte = g.uMax > 0.002 ? 48 : 0;
      const vSpanne = g.vMax - g.vMin;
      const vSchritte = vSpanne > 0.002 ? Math.min(40, Math.ceil(vSpanne / (g.ch * 0.06))) : 0;
      const halt = dyPlan && !dy ? 0.25 : 0;
      for (let i = 0; i <= uSchritte; i++) {
        const u = uSchritte ? (g.uMax * i) / uSchritte : 0;
        for (let j = 0; j <= vSchritte; j++) {
          const v = vSchritte ? g.vMin + (vSpanne * j) / vSchritte : g.vMin;
          // senkrechte Kanten über die ganze Scrollstrecke prüfen, waagerechte im Ruhebild
          const va = Math.min(v, v + g.dv);
          const vb = Math.max(v, v + g.dv) + g.ch;
          const inh = innen(u, v, u + g.cw, v + g.ch);
          const leer = Math.max(0, 1 - inh / 0.035);
          const pxJeZelle = (H * z) / gh;
          // leere Fläche im Ruhebild und am Ende der Scrollbewegung
          const leerFlaeche =
            Math.max(0, leerAnteil(u, v, u + g.cw, v + g.ch) - 0.45) +
            (g.dv ? Math.max(0, leerAnteil(u, v + g.dv, u + g.cw, v + g.dv + g.ch) - 0.45) : 0);
          const luecke =
            engeLuecke(v, u, u + g.cw, pxJeZelle) + engeLuecke(v + g.ch, u, u + g.cw, pxJeZelle);
          const gleich = meiden
            ? Math.max(0, ueberlappung({ u, v, cw: g.cw, ch: g.ch }, meiden) - 0.6) / 0.4
            : 0;
          const s =
            schnittU(u, va, vb) +
            schnittU(u + g.cw, va, vb) +
            schnittV(v, u, u + g.cw) +
            schnittV(v + g.ch, u, u + g.cw) +
            // auch das Ende der Scrollbewegung soll sauber landen
            (g.dv ? 0.7 * (schnittV(v + g.dv, u, u + g.cw) + schnittV(v + g.dv + g.ch, u, u + g.cw)) : 0) +
            2 * leer +
            2.5 * leerFlaeche +
            0.8 * luecke +
            2 * gleich +
            halt +
            (!schmal && !totale && z < 1.12 ? 0.5 : 0) +
            0.3 * (g.uMax ? Math.abs(u - g.pu) / g.uMax : 0) +
            0.3 * Math.min(1.5, Math.abs(v - g.pv) / g.ch) +
            0.8 * Math.abs(z - zPlan);
          if (s < best.s) best = { s, z, u, v, dy };
        }
      }
    }
  }

  const g = geometrie(best.z, best.dy);
  let cursor = kam.cursor;
  if (cursor) {
    // Zeiger auf das nächste Stück echten Inhalt (Wort, Knopf) im Ausschnitt setzen
    const zu = best.u + klemme(cursor.x, 0, 1) * g.cw;
    const zv = best.v + klemme(cursor.y, 0, 1) * g.ch;
    const bu = 6 / gw;
    const bv = 2 / gh;
    let ziel = { s: -Infinity, u: zu, v: zv };
    for (let a = 0.14; a <= 0.86; a += 0.03) {
      for (let b = 0.16; b <= 0.84; b += 0.03) {
        const u = best.u + a * g.cw;
        const v = best.v + b * g.ch;
        const dd = innen(u - bu, v - bv, u + bu, v + bv);
        if (dd < 0.12) continue;
        const s = Math.min(dd, 0.4) - 1.4 * Math.hypot((u - zu) / g.cw, (v - zv) / g.ch);
        if (s > ziel.s) ziel = { s, u, v };
      }
    }
    cursor = {
      ...cursor,
      x: klemme((ziel.u - best.u) / g.cw, 0.14, 0.86),
      y: klemme((ziel.v - best.v) / g.ch, 0.16, 0.84),
    };
  }
  return { ...basis(best.z, best.dy), cursor, fest: { u0: best.u, v0: best.v } };
};

/** v45: alle Screenshot-Takte eines Reels der Reihe nach ausrichten (jeder anders als der vorige). */
const takteCache = new WeakMap<BildMasse, Map<string, Takt[]>>();
export const richteTakteAus = (takte: Takt[], masse: BildMasse): Takt[] => {
  // einmal je Screenshot und Taktplan rechnen, nicht in jedem Bild
  const schluessel = takte
    .map((t) => `${t.von}-${t.bis}-${t.inhalt}-${t.kam.z}-${t.kam.x}-${t.kam.y}-${t.loop ? 1 : 0}`)
    .join('|');
  let m = takteCache.get(masse);
  if (!m) {
    m = new Map();
    takteCache.set(masse, m);
  }
  const vorhanden = m.get(schluessel);
  if (vorhanden) return vorhanden;
  const neu = richteTakteAusRoh(takte, masse);
  m.set(schluessel, neu);
  return neu;
};

const richteTakteAusRoh = (takte: Takt[], masse: BildMasse): Takt[] => {
  const { W, H, Wv, hv, schmal } = shotGeometrie(masse);
  const fertig = new Map<Kamera, Kamera>();
  let vorher: Ausschnitt | undefined;
  return takte.map((t) => {
    if (t.inhalt !== 'shot') return t;
    if (t.loop) return { ...t, kam: fertig.get(t.kam) ?? t.kam };
    const k = ausrichten(t.kam, W, H, Wv, hv, schmal, masse.tinte, vorher);
    if (!fertig.has(t.kam)) fertig.set(t.kam, k);
    if (k.fest) {
      vorher = { u: k.fest.u0, v: k.fest.v0, cw: Math.min(1, Wv / (W * k.z)), ch: Math.min(1, hv / (H * k.z)) };
    } else {
      vorher = { u: 0, v: 0, cw: 1, ch: 1 };
    }
    return { ...t, kam: k };
  });
};

/** v51: Beginnt mit diesem Takt eine neue Ansicht (eigener Übergang mit Federung)? */
export const neueAnsicht = (vor: Takt, t: Takt) =>
  vor.inhalt !== t.inhalt || !!t.loop || (t.inhalt === 'schritt' && vor.aktiv !== t.aktiv);

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
    const neu = i > 0 && (!vor || neueAnsicht(vor, t));
    // v51: Wechsel zwischen den Karten ohne Screenshot leise wie ein Umblättern, nicht als Whoosh
    const kartenWechsel =
      !!vor && !t.loop && /^(liste|schritt)$/.test(vor.inhalt) && /^(liste|schritt)$/.test(t.inhalt);

    if (neu && kartenWechsel) {
      // nur wenn die große Schritt-Karte hereinkommt, zurück zur Liste ohne Geräusch
      if (t.inhalt === 'schritt' && t.von > 0 && t.von < gesamt - 4) {
        cues.push({ frame: t.von, art: 'pop', volume: 0.13 });
      }
    } else if (neu && t.von > 0 && t.von < gesamt - 4) {
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
