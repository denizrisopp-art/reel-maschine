import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill, Audio, Img, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { fontFamily } from './fonts';

// Vorlage „Die Abkürzung“ (Stand v19 + v25 + v38, 23.11.2026)
// - Hook ab Bild 0 voll sichtbar, Ende führt zurück ins erste Bild (Loop)
// - Sicherer Bereich 1080 × 1920: oben 220, unten 420, rechts 140 px frei von Text, Prompt-Box und Untertiteln
//   (Untertitel enden bei y 1440, weil Instagram Caption und Audio-Leiste teils höher legt)
// - spätestens alle 1,7 bis 2 s ein sichtbarer Bildwechsel (Zoom auf Ausschnitt, Schnitt, Markierung)
// - nur echter Screenshot, Prompt oder nummerierte Schritte – keine Platzhalterbalken, keine erfundene Tool-Antwort
// - flacher Grund ohne Verlauf, Glow oder Korn; Gelb nur für Tool-Namen und Prompt-Box

const C = {
  ground: '#0E0E10', panel: '#17171B', bar: '#1E1E23', line: '#2B2B32', ink: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)', leise: 'rgba(255,255,255,0.40)', accent: '#FFD400', auswahl: 'rgba(84,140,255,0.42)',
};
const SPALTE = { links: 80, rechts: 940 };           // Textspalte (rechts 140 px frei)
const OBEN = { top: 236, unten: 566 };               // Titelzone unter Instagrams Kopfzeile
const BUEHNE = { x: 70, y: 604, b: 870, h: 690 };    // Bildfläche 70..940 × 604..1294
const UT_UNTERKANTE = 1440;                          // Untertitel enden spätestens hier (v38)
const BAR = 58;                                       // Adressleiste im Browserrahmen

export type Szene = { titel: string; text: string; start: number; ende: number };
export type Wort = { text: string; start: number; end: number };
export type ReelProps = {
  tool: string; toolUrl: string; screenshot?: string; audio?: string; promptText?: string;
  schritte?: string[]; // optional: Schritte im Wortlaut der Website (kommt später aus n8n)
  szenen: Szene[]; woerter: Wort[]; dauer: number;
};

export const reelDuration = (p: ReelProps) => Math.max(30, Math.ceil((p.dauer || 20) * 30));

const quelle = (s?: string) => (!s ? undefined : /^https?:/.test(s) ? s : staticFile(s));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const klemme = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------- deterministischer Zufall: jedes Reel bekommt eigene Varianten ----------
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const zufall = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0; let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- Tool-Namen erkennen (nur die werden gelb) ----------
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const toolMarken = (woerter: string[], tool: string): boolean[] => {
  const t = tool.split(/\s+/).map(norm).filter(Boolean);
  const res = woerter.map(() => false);
  if (!t.length) return res;
  for (let i = 0; i + t.length <= woerter.length; i++) {
    let ok = true;
    for (let j = 0; j < t.length; j++) {
      const w = norm(woerter[i + j]);
      const letztes = j === t.length - 1;
      if (!(w === t[j] || (letztes && t[j].length >= 4 && w.startsWith(t[j])))) { ok = false; break; }
    }
    if (ok) for (let j = 0; j < t.length; j++) res[i + j] = true;
  }
  return res;
};
const Gefaerbt: React.FC<{ text: string; tool: string }> = ({ text, tool }) => {
  const w = text.split(/\s+/).filter(Boolean);
  const m = toolMarken(w, tool);
  return <>{w.map((x, i) => <React.Fragment key={i}>{i > 0 ? ' ' : ''}<span style={{ color: m[i] ? C.accent : undefined }}>{x}</span></React.Fragment>)}</>;
};

// ---------- Screenshot-Größe messen (für Zoom auf Ausschnitte) ----------
const useBildMasse = (src?: string) => {
  const [masse, setMasse] = useState<{ b: number; h: number } | null>(null);
  const [handle] = useState(() => (src ? delayRender('Screenshot-Größe') : null));
  useEffect(() => {
    if (!src || handle === null) return;
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) setMasse({ b: img.naturalWidth, h: img.naturalHeight }); continueRender(handle); };
    img.onerror = () => continueRender(handle);
    img.src = src;
  }, [src, handle]);
  return masse;
};

// ---------- Prompt: Schriftgröße nach Länge, sonst Kurzfassung ----------
const promptForm = (roh: string) => {
  const s = roh.replace(/\s+/g, ' ').trim();
  let text = s, gekuerzt = false;
  if (s.length > 400) {
    gekuerzt = true;
    let cut = s.slice(0, 300);
    const satz = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    text = satz > 180 ? cut.slice(0, satz + 1) + ' …' : cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + ' …';
  }
  const groesse = Math.round(klemme(Math.sqrt(518000 / (1.12 * Math.max(1, text.length))), 34, 54));
  return { text, gekuerzt, groesse };
};
// Tipp-Animation mit unregelmäßigem Tempo: Pausen nach Wörtern und Satzzeichen
const tippKurve = (text: string, seed: number) => {
  const r = zufall(seed); const cum: number[] = []; let t = 0;
  for (let i = 0; i < text.length; i++) {
    const vor = text[i - 1] || '';
    let w = 0.55 + r() * 0.9;
    if (vor === ' ') w *= 1.4;
    if (/[,;:]/.test(vor)) w *= 2.4;
    if (/[.!?]/.test(vor)) w *= 3.2;
    if (r() < 0.04) w *= 3;
    t += w; cum.push(t);
  }
  return cum.map(c => c / (t || 1));
};

// ---------- Ablaufplan: Szenen -> Takte (Inhalt + Kamera) ----------
type Inhalt = 'shot' | 'prompt' | 'liste' | 'teilen';
type Kamera = { z: number; x: number; y: number };
type Oben = { art: 'hook' | 'schritt' | 'titel'; text: string; nr?: number };
type Takt = { von: number; bis: number; inhalt: Inhalt; kam: Kamera; oben: Oben; tippVon?: number; markieren?: boolean; aktiv?: number; beat: number; loop?: boolean };

const TOTAL: Kamera = { z: 1, x: 0.5, y: 0 };
const SHOT: Kamera[] = [
  { z: 1.0, x: 0.5, y: 0 },
  { z: 1.5, x: 0.3, y: 0.3 },
  { z: 1.25, x: 0.45, y: 0.45 },
  { z: 1.45, x: 0.7, y: 0.3 },
  { z: 1.3, x: 0.5, y: 0.75 },
];
const NAH: Kamera = { z: 1.001, x: 0.5, y: 0.5 }; // Markierung statt Zoom (Prompt-Box bleibt im sicheren Bereich)

// Rollen der Szenen: Hook, Schritte, Prompt, Schluss
const rollen = (p: ReelProps) => {
  const sz = p.szenen.length ? p.szenen : [{ titel: p.tool, text: '', start: 0, ende: p.dauer }];
  const n = sz.length, letzte = n - 1;
  const prompt = (p.promptText || '').trim();
  let pIdx = -1;
  if (prompt && n > 1) {
    pIdx = sz.findIndex((s, i) => i > 0 && /prompt/i.test(`${s.titel} ${s.text}`));
    if (pIdx < 0) pIdx = n >= 3 ? n - 2 : letzte;
  }
  const mitte = sz.map((_, i) => i > 0 && i !== pIdx && i !== letzte);
  const nr: number[] = []; let k = 0;
  sz.forEach((_, i) => { if (mitte[i]) nr[i] = ++k; });
  if (pIdx > 0 && pIdx !== letzte && k > 0) nr[pIdx] = ++k;
  const schritte = (p.schritte || []).map(s => String(s).trim()).filter(Boolean);
  let listeTexte = schritte.length ? schritte : sz.filter((_, i) => nr[i]).map(s => s.titel);
  if (!listeTexte.length) listeTexte = sz.filter((_, i) => i > 0).map(s => s.titel);
  if (!listeTexte.length) listeTexte = [p.toolUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')];
  return { sz, n, letzte, prompt, pIdx, mitte, nr, schritte, listeTexte: listeTexte.slice(0, 5) };
};

const plane = (p: ReelProps, fps: number, gesamt: number, hatShot: boolean) => {
  const { sz, n, letzte, prompt, pIdx, mitte, nr, schritte, listeTexte } = rollen(p);
  const r = zufall(hash(`${p.tool}|${sz[0].titel}`));
  const von = sz.map((s, i) => (i === 0 ? 0 : Math.round(klemme(s.start * fps, 1, gesamt - 2))));
  for (let i = 1; i < n; i++) von[i] = Math.max(von[i], von[i - 1] + 1);
  const bis = (i: number) => (i >= letzte ? gesamt : von[i + 1]);

  // Kamera-Reihenfolge je Reel gemischt (keine Schablone)
  const ord = SHOT.map((c, i) => ({ c, s: r() + (i === 0 ? 0.3 : 0) })).sort((a, b) => a.s - b.s).map(x => x.c);
  let si = 0;
  const naechsteShot = () => ord[si++ % ord.length];

  // Takte: höchstens ~1,9 s, leicht unregelmäßig
  const teile = (a: number, b: number, maxLen = 1.7 * fps): [number, number][] => {
    const L = b - a; if (L <= 0) return [];
    const anz = Math.max(1, Math.ceil(L / maxLen));
    const w = Array.from({ length: anz }, () => 0.85 + r() * 0.3);
    const sum = w.reduce((x, y) => x + y, 0);
    const out: [number, number][] = []; let t = a;
    w.forEach((wi, i) => { const e = i === anz - 1 ? b : Math.round(t + (L * wi) / sum); out.push([t, e]); t = e; });
    return out;
  };

  const takte: Takt[] = [];
  const oben = (i: number): Oben => (i === 0 ? { art: 'hook', text: sz[0].titel } : nr[i] ? { art: 'schritt', text: sz[i].titel, nr: nr[i] } : { art: 'titel', text: sz[i].titel });
  const bildTakt = (a: number, b: number, o: Oben, j: number, aktiv: number, mitListe: boolean): Takt => {
    if (hatShot && !(mitListe && j % 2 === 1)) return { von: a, bis: b, inhalt: 'shot', kam: naechsteShot(), oben: o, beat: j };
    // ohne Screenshot: Schritte und Prompt wechseln sich ab, damit sich das Bild sichtbar ändert
    if (!hatShot && prompt && j % 2 === 1) return { von: a, bis: b, inhalt: 'prompt', kam: TOTAL, oben: o, beat: j };
    return { von: a, bis: b, inhalt: 'liste', kam: j % 2 ? NAH : TOTAL, oben: o, aktiv, beat: j };
  };

  // Teilen-Stelle im letzten Satz finden („Schick …“, „Teil …“, „Speicher …“)
  let cue = gesamt, loopVon = gesamt;
  if (n > 1) {
    const lStart = von[letzte] / fps - 0.05;
    const w = p.woerter.find(x => x.start >= lStart && /^(schick|teil|send|speicher|leit|merk)/i.test(x.text));
    cue = w ? Math.round(w.start * fps) - 3 : Math.max(von[letzte], gesamt - Math.round(3.2 * fps));
    cue = klemme(cue, von[letzte], gesamt - 1);
    if (cue - von[letzte] < 0.8 * fps) cue = von[letzte];
    loopVon = Math.max(cue + 20, gesamt - 15);
    if (loopVon > gesamt - 8) loopVon = gesamt;
  }

  // 1) Hook: Prompt oder Ergebnis zuerst, dann der echte Screenshot
  const hookEnde = n === 1 ? gesamt : bis(0);
  teile(0, hookEnde).forEach(([a, b], j) => {
    const teaser = !!prompt && (prompt.length <= 200 || !hatShot);
    if (j === 0 && teaser) takte.push({ von: a, bis: b, inhalt: 'prompt', kam: TOTAL, oben: oben(0), beat: j });
    else takte.push(bildTakt(a, b, oben(0), teaser ? j + 1 : j, 0, false));
  });
  if (n === 1) return { takte, pIdx };

  // 2) Mittlere Szenen: Schritt-Karte oben, Screenshot mit Zoom auf Ausschnitte
  for (let i = 1; i < n; i++) {
    if (!mitte[i]) continue;
    teile(von[i], bis(i)).forEach(([a, b], j) => takte.push(bildTakt(a, b, oben(i), j, (nr[i] || 1) - 1, schritte.length > 0)));
  }
  // 3) Prompt: tippen, markieren, nah ran – steht bis zur Teilen-Stelle, wenn er kurz vor dem Schluss kommt
  const promptBisSchluss = pIdx > 0 && pIdx >= letzte - 1;
  if (pIdx > 0) {
    const a0 = von[pIdx], b0 = promptBisSchluss ? cue : bis(pIdx);
    const o = oben(pIdx);
    const pf = promptForm(prompt);
    const tipp = Math.round(klemme(pf.text.length / 55, 0.9, 2.4) * fps);
    const erst = Math.min(b0, a0 + tipp + Math.round(0.4 * fps));
    if (erst > a0) takte.push({ von: a0, bis: erst, inhalt: 'prompt', kam: TOTAL, oben: o, tippVon: a0, beat: 0 });
    teile(erst, b0).forEach(([a, b], j) => takte.push({ von: a, bis: b, inhalt: 'prompt', kam: TOTAL, markieren: j % 2 === 0, oben: o, tippVon: a0, beat: j + 1 }));
  }
  if (!promptBisSchluss) {
    // Anfang der letzten Szene zeigt weiter das Tool, Titel der Szene davor bleibt stehen
    const o = oben(letzte - 1);
    teile(von[letzte], cue).forEach(([a, b], j) => takte.push(bildTakt(a, b, o, j + 1, Math.max(0, (nr[letzte - 1] || listeTexte.length) - 1), schritte.length > 0)));
  }
  takte.sort((x, y) => x.von - y.von);
  // 4) Teilen-Symbol zum letzten Satz
  teile(cue, loopVon).forEach(([a, b], j) => takte.push({ von: a, bis: b, inhalt: 'teilen', kam: TOTAL, oben: oben(letzte), beat: j }));
  // 5) Loop: zurück zum ersten Bild
  if (loopVon < gesamt) takte.push({ ...takte[0], von: loopVon, bis: gesamt, loop: true });
  // Takte sauber aneinander (keine Lücken, keine Überlappung)
  const sauber = takte.filter(t => t.bis > t.von).sort((x, y) => x.von - y.von);
  for (let i = 0; i < sauber.length - 1; i++) sauber[i].bis = sauber[i + 1].von;
  if (sauber.length) { sauber[0].von = 0; sauber[sauber.length - 1].bis = gesamt; }
  return { takte: sauber.filter(t => t.bis > t.von), pIdx };
};

// ---------- Kamera: Fokuspunkt + Zoom, nie über den Bildrand hinaus ----------
const kameraPx = (k: Kamera, W: number, H: number, Wv: number, Hv: number) => {
  const z = k.z;
  const fyMax = Math.min(H, Hv * 2.2);
  const tx = klemme(Wv / 2 - k.x * W * z, Math.min(0, Wv - W * z), 0);
  const ty = klemme(Hv / 2 - k.y * fyMax * z, Math.min(0, Hv - H * z), 0);
  return { z, tx, ty };
};

// ---------- Bausteine ----------
const Nummer: React.FC<{ n: number; gross?: boolean }> = ({ n, gross }) => (
  <div style={{ flex: 'none', width: gross ? 76 : 64, height: gross ? 76 : 64, borderRadius: 18, background: C.ink, color: C.ground,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: gross ? 44 : 36 }}>{n}</div>
);

const ObenText: React.FC<{ o: Oben; tool: string; seit: number }> = ({ o, tool, seit }) => {
  const { fps } = useVideoConfig();
  const s = seit === Infinity ? 1 : spring({ frame: seit, fps, config: o.art === 'hook' ? { damping: 22, stiffness: 320, mass: 0.6 } : { damping: 18, stiffness: 170, mass: 0.7 } });
  const stil: React.CSSProperties = { position: 'absolute', top: OBEN.top, height: OBEN.unten - OBEN.top, left: SPALTE.links, width: SPALTE.rechts - SPALTE.links,
    display: 'flex', alignItems: 'flex-end', transform: `translateY(${(1 - s) * 28}px)`, opacity: Math.min(1, s * 1.5), color: C.ink };
  if (o.art === 'hook') {
    const L = o.text.length;
    const fs = L <= 24 ? 96 : L <= 40 ? 88 : L <= 56 ? 78 : 68;
    return <div style={{ ...stil, justifyContent: 'center', textAlign: 'center', fontWeight: 900, fontSize: fs, lineHeight: 1.04, letterSpacing: -2.5 }}>
      <div><Gefaerbt text={o.text} tool={tool} /></div></div>;
  }
  const fs = o.text.length <= 30 ? 66 : o.text.length <= 48 ? 58 : 50;
  return <div style={{ ...stil, gap: 26, alignItems: 'flex-end' }}>
    {o.nr ? <div style={{ paddingBottom: fs * 0.14 }}><Nummer n={o.nr} gross /></div> : null}
    <div style={{ fontWeight: 800, fontSize: fs, lineHeight: 1.08, letterSpacing: -1.5 }}><Gefaerbt text={o.text} tool={tool} /></div>
  </div>;
};

const Adressleiste: React.FC<{ url: string }> = ({ url }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: C.bar, borderBottom: `2px solid ${C.line}`, zIndex: 2 }}>
    {[0, 1, 2].map(i => <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: '#3A3A42' }} />)}
    <div style={{ marginLeft: 14, flex: 1, height: 38, borderRadius: 19, background: '#121216', display: 'flex', alignItems: 'center', padding: '0 20px',
      fontWeight: 500, fontSize: 24, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden' }}>{url}</div>
  </div>
);

const PromptKarte: React.FC<{ text: string; gekuerzt: boolean; groesse: number; n: number; tippt: boolean; auswahl: number }> = ({ text, gekuerzt, groesse, n, tippt, auswahl }) => {
  const f = useCurrentFrame();
  const sichtbar = text.slice(0, n);
  const m = Math.min(sichtbar.length, Math.round(auswahl * sichtbar.length));
  return (
    <div style={{ width: BUEHNE.b, boxSizing: 'border-box', maxHeight: BUEHNE.h, minHeight: 300, borderRadius: 28, border: `3px solid ${C.accent}`, background: '#141417',
      padding: '30px 36px 34px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, color: C.accent, marginBottom: 16 }}>PROMPT ZUM KOPIEREN</div>
      <div style={{ position: 'relative', fontWeight: 600, fontSize: groesse, lineHeight: 1.32, color: C.ink }}>
        {/* voller Text unsichtbar: die Box hat von Anfang an ihre endgültige Höhe */}
        <div style={{ visibility: 'hidden' }}>{text}</div>
        <div style={{ position: 'absolute', inset: 0 }}>
          {m > 0 && <span style={{ background: C.auswahl, borderRadius: 4 }}>{sichtbar.slice(0, m)}</span>}
          {sichtbar.slice(m)}
          {tippt && <span style={{ color: C.accent, opacity: f % 20 < 11 ? 1 : 0 }}>▍</span>}
        </div>
      </div>
      {gekuerzt && <div style={{ marginTop: 14, fontSize: 26, fontWeight: 700, color: C.muted }}>Vollständig in der Caption</div>}
    </div>
  );
};

const Liste: React.FC<{ items: string[]; aktiv: number; tool: string; markiert: number }> = ({ items, aktiv, tool, markiert }) => (
  <div style={{ width: BUEHNE.b, boxSizing: 'border-box', borderRadius: 28, background: C.panel, border: `2px solid ${C.line}`, padding: '40px 40px 44px', display: 'flex', flexDirection: 'column', gap: 26 }}>
    <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.leise }}>SO GEHT'S</div>
    {items.map((t, i) => (
      <div key={i} style={{ position: 'relative', display: 'flex', gap: 24, alignItems: 'flex-start', opacity: i === aktiv ? 1 : 0.42 }}>
        {i === aktiv && markiert > 0 && <div style={{ position: 'absolute', left: -16, right: -12, top: -12, bottom: -12, borderRadius: 18, border: `4px solid ${C.ink}`, background: 'rgba(255,255,255,0.07)',
          opacity: markiert, transform: `scale(${1.03 - 0.03 * markiert})` }} />}
        <Nummer n={i + 1} />
        <div style={{ fontSize: items.length > 3 ? 44 : 52, fontWeight: 700, lineHeight: 1.16, color: C.ink, paddingTop: 4 }}><Gefaerbt text={t} tool={tool} /></div>
      </div>
    ))}
  </div>
);

const Flieger: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <svg width="300" height="300" viewBox="0 0 24 24" style={{ position: 'absolute', ...style }}>
    <path d="M21.5 2.5 L2.8 10.2 L10.2 13.6 L13.6 21.2 Z M21.5 2.5 L10.2 13.6" fill="none" stroke={C.ink} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);
const Teilen: React.FC<{ seit: number; beat: number }> = ({ seit, beat }) => {
  const { fps } = useVideoConfig();
  const rein = spring({ frame: seit - (beat > 0 ? 7 : 0), fps, config: { damping: 12, stiffness: 150, mass: 0.7 } });
  const raus = beat > 0 ? spring({ frame: seit, fps, config: { damping: 22, stiffness: 110 } }) : 1;
  return (
    <div style={{ position: 'relative', width: BUEHNE.b, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {beat > 0 && raus < 0.97 && <Flieger style={{ transform: `translate(${raus * 280}px, ${-raus * 300}px) rotate(${raus * 14}deg)`, opacity: 1 - raus }} />}
      <Flieger style={{ transform: `translate(${(1 - rein) * -70}px, ${(1 - rein) * 70}px) scale(${0.55 + 0.45 * rein})`, opacity: klemme(rein * 1.6, 0, 1) }} />
    </div>
  );
};

// ---------- Untertitel: Phrasen statt Einzelwörter, groß, im sicheren Bereich ----------
type Gruppe = { woerter: { text: string; tool: boolean }[]; start: number; end: number };
const gruppiere = (woerter: Wort[], tool: string): Gruppe[] => {
  const marken = toolMarken(woerter.map(w => w.text), tool);
  const gruppen: Gruppe[] = []; let akt: Gruppe | null = null; let zeichen = 0;
  woerter.forEach((w, i) => {
    if (akt && (zeichen + 1 + w.text.length > 28 || akt.woerter.length >= 5)) { gruppen.push(akt); akt = null; }
    if (!akt) { akt = { woerter: [], start: w.start, end: w.end }; zeichen = 0; }
    akt.woerter.push({ text: w.text, tool: marken[i] }); akt.end = w.end; zeichen += (zeichen ? 1 : 0) + w.text.length;
    if (/[.!?:]$/.test(w.text) || (/,$/.test(w.text) && zeichen > 14)) { gruppen.push(akt); akt = null; }
  });
  if (akt) gruppen.push(akt);
  return gruppen;
};
const Untertitel: React.FC<{ gruppen: Gruppe[] }> = ({ gruppen }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const idx = gruppen.findIndex((g, i) => {
    const naechste = gruppen[i + 1];
    const ende = naechste && naechste.start - g.end < 0.6 ? naechste.start : g.end + 0.25;
    return t >= (i === 0 ? 0 : g.start) && t < ende;
  });
  if (idx < 0) return null;
  const g = gruppen[idx];
  const seit = idx === 0 ? Infinity : f - Math.round(g.start * fps);
  const s = seit === Infinity ? 1 : spring({ frame: seit, fps, config: { damping: 20, stiffness: 240, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', bottom: 1920 - UT_UNTERKANTE, left: SPALTE.links, width: SPALTE.rechts - SPALTE.links, textAlign: 'center',
      fontWeight: 800, fontSize: 64, lineHeight: 1.15, letterSpacing: -1, color: C.ink, textShadow: '0 3px 0 rgba(0,0,0,0.55)',
      transform: `scale(${0.96 + 0.04 * s})`, opacity: Math.min(1, s * 2) }}>
      {g.woerter.map((w, i) => <React.Fragment key={i}>{i > 0 ? ' ' : ''}<span style={{ color: w.tool ? C.accent : undefined }}>{w.text}</span></React.Fragment>)}
    </div>
  );
};

// ---------- Ganzes Reel ----------
export const Reel: React.FC<ReelProps> = (p) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const shot = quelle(p.screenshot);
  const masse = useBildMasse(shot);
  const { takte } = useMemo(() => plane(p, fps, durationInFrames, !!masse), [p, fps, durationInFrames, masse]);
  const gruppen = useMemo(() => gruppiere(p.woerter || [], p.tool), [p.woerter, p.tool]);
  const pf = useMemo(() => promptForm(p.promptText || ''), [p.promptText]);
  const kurve = useMemo(() => tippKurve(pf.text, hash(pf.text)), [pf.text]);
  const { listeTexte } = useMemo(() => rollen(p), [p]);

  let ti = takte.findIndex(t => f >= t.von && f < t.bis);
  if (ti < 0) ti = takte.length - 1;
  const takt = takte[ti];
  const vor = ti > 0 ? takte[ti - 1] : undefined;

  // Titel oben: läuft weiter, solange sich der Text nicht ändert
  let oi = ti;
  while (oi > 0 && !takte[oi].loop && takte[oi - 1].oben.text === takt.oben.text && takte[oi - 1].oben.art === takt.oben.art) oi--;
  const obenSeit = oi === 0 ? Infinity : f - takte[oi].von;

  // Bildfläche: Schnitt mit Federung bei neuem Inhalt, sonst Kamerafahrt zum nächsten Ausschnitt
  const neu = ti > 0 && (!vor || vor.inhalt !== takt.inhalt || takt.loop);
  const seit = f - takt.von;
  const rein = ti === 0 || !neu ? 1 : spring({ frame: seit, fps, config: takt.loop ? { damping: 22, stiffness: 320, mass: 0.6 } : { damping: 18, stiffness: 170, mass: 0.7 } });
  const fahrt = ti === 0 || neu || !vor ? 1 : spring({ frame: seit, fps, config: { damping: 24, stiffness: 75, mass: 1 } });

  const Wv = BUEHNE.b - 4; // innen (Rahmen 2 px)

  let inhalt: React.ReactNode = null;
  if (takt.inhalt === 'shot' && shot && masse) {
    // Browserfenster passt sich dem Screenshot an: volle Breite sichtbar, hohe Seiten werden gescrollt
    const ar = masse.h / masse.b;
    const W = Wv, H = W * ar, hv = Math.min(BUEHNE.h - BAR - 4, H);
    const ziel = kameraPx(takt.kam, W, H, Wv, hv);
    const alt = vor && fahrt < 1 ? kameraPx(vor.kam, W, H, Wv, hv) : ziel;
    const c = { z: lerp(alt.z, ziel.z, fahrt), tx: lerp(alt.tx, ziel.tx, fahrt), ty: lerp(alt.ty, ziel.ty, fahrt) };
    inhalt = (
      <div style={{ position: 'relative', width: BUEHNE.b, height: hv + BAR + 4, boxSizing: 'border-box', borderRadius: 28, overflow: 'hidden', background: C.panel, border: `2px solid ${C.line}` }}>
        <Adressleiste url={p.toolUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} />
        <div style={{ position: 'absolute', top: BAR, left: 0, width: Wv, height: hv, overflow: 'hidden', background: '#fff' }}>
          <Img src={shot} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${c.tx}px, ${c.ty}px) scale(${c.z})` }} />
        </div>
      </div>
    );
  } else if (takt.inhalt === 'prompt') {
    let nZeichen = pf.text.length, tippt = false;
    if (takt.tippVon !== undefined) {
      const tipp = Math.round(klemme(pf.text.length / 55, 0.9, 2.4) * fps);
      const q = klemme((f - takt.tippVon) / tipp, 0, 1);
      nZeichen = q >= 1 ? pf.text.length : kurve.filter(x => x <= q).length;
      tippt = q < 1;
    }
    const auswahl = takt.markieren ? spring({ frame: seit, fps, config: { damping: 26, stiffness: 120 } }) : 0;
    inhalt = <div><PromptKarte text={pf.text} gekuerzt={pf.gekuerzt} groesse={pf.groesse} n={nZeichen} tippt={tippt} auswahl={auswahl} /></div>;
  } else if (takt.inhalt === 'liste' || takt.inhalt === 'shot') {
    const markiert = takt.kam.z > 1 ? spring({ frame: seit - 2, fps, config: { damping: 20, stiffness: 160 } }) : 0;
    inhalt = <div><Liste items={listeTexte} aktiv={takt.aktiv ?? 0} tool={p.tool} markiert={markiert} /></div>;
  } else if (takt.inhalt === 'teilen') {
    inhalt = <Teilen seit={seit} beat={takt.beat} />;
  }

  return (
    <AbsoluteFill style={{ fontFamily, background: C.ground }}>
      {p.audio && <Audio src={quelle(p.audio)!} />}
      <ObenText o={takt.oben} tool={p.tool} seit={obenSeit} />
      <div style={{ position: 'absolute', left: BUEHNE.x, top: BUEHNE.y, width: BUEHNE.b, height: BUEHNE.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `translateY(${(1 - rein) * 60}px) scale(${0.965 + 0.035 * rein})`, opacity: klemme(rein * 1.7, 0, 1) }}>
          {inhalt}
        </div>
      </div>
      <Untertitel gruppen={gruppen} />
    </AbsoluteFill>
  );
};
