import React, { useEffect, useMemo, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { fontFamily } from './fonts';
import {
  gruppiere,
  hash,
  klemme,
  plane,
  planeSfx,
  promptForm,
  reelDuration,
  richteTakteAus,
  rollen,
  tintenKarte,
  tippKurve,
} from './reel/planner';
import { BildMasse, BUEHNE, OBEN, ReelProps, Szene, Tinte, Wort } from './reel/types';
import { AudioSpur } from './reel/components/AudioSpur';
import {
  BrowserRahmen,
  FokusKarte,
  PromptKarte,
  SchritteListe,
  TeilenSzene,
} from './reel/components/BuehneKarten';
import { Fortschritt } from './reel/components/Fortschritt';
import { Hintergrund } from './reel/components/Hintergrund';
import { ObenText } from './reel/components/ObenText';
import { SafeZoneOverlay } from './reel/components/SafeZoneOverlay';
import { Untertitel } from './reel/components/Untertitel';

export type { ReelProps, Szene, Wort };
export { reelDuration };

const quelle = (s?: string) => (!s ? undefined : /^https?:/.test(s) ? s : staticFile(s));

// v45: verkleinerte Kantenkarte des Screenshots, damit Zooms nicht durch Wörter schneiden
const tinteVon = (img: HTMLImageElement): Tinte | undefined => {
  try {
    const gw = 320;
    const gh = Math.max(1, Math.min(2400, Math.round((gw * img.naturalHeight) / img.naturalWidth)));
    const cv = document.createElement('canvas');
    cv.width = gw;
    cv.height = gh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, gw, gh);
    return tintenKarte(ctx.getImageData(0, 0, gw, gh).data, gw, gh);
  } catch {
    return undefined;
  }
};

const useBildMasse = (src?: string) => {
  const [masse, setMasse] = useState<BildMasse | null>(null);
  const [handle] = useState(() => (src ? delayRender('Screenshot-Größe') : null));
  useEffect(() => {
    if (!src || handle === null) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        setMasse({ b: img.naturalWidth, h: img.naturalHeight, tinte: tinteVon(img) });
      }
      continueRender(handle);
    };
    img.onerror = () => continueRender(handle);
    img.src = src;
  }, [src, handle]);
  return masse;
};

export const Reel: React.FC<ReelProps> = (p) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const shot = quelle(p.screenshot);
  const masse = useBildMasse(shot);

  const { takte: rohTakte, szenenGrenzen } = useMemo(
    () => plane(p, fps, durationInFrames, !!masse),
    [p, fps, durationInFrames, masse],
  );
  // v45: Zoom-Ausschnitte an Text- und Seitenkanten ausrichten statt mitten durch Wörter
  const takte = useMemo(
    () => (masse ? richteTakteAus(rohTakte, masse) : rohTakte),
    [rohTakte, masse],
  );
  const gruppen = useMemo(() => gruppiere(p.woerter || [], p.tool), [p.woerter, p.tool]);
  const pf = useMemo(() => promptForm(p.promptText || ''), [p.promptText]);
  const kurve = useMemo(() => tippKurve(pf.text, hash(pf.text)), [pf.text]);
  const { listeTexte } = useMemo(() => rollen(p), [p]);
  // v51: Ausrichtung der großen Schritt-Karte wechselt je Reel (links oder mittig)
  const kartenMittig = hash(`${p.tool}|${p.toolUrl}|mittig`) % 2 === 1;
  const sfxCues = useMemo(
    () => planeSfx(takte, pf.text, kurve, fps, durationInFrames),
    [takte, pf.text, kurve, fps, durationInFrames],
  );

  let ti = takte.findIndex((t) => f >= t.von && f < t.bis);
  if (ti < 0) ti = takte.length - 1;
  const takt = takte[ti];
  const vor = ti > 0 ? takte[ti - 1] : undefined;

  // v51: In Schritt-Szenen ohne Screenshot füllt die große Schritt-Karte den Platz der Überschrift
  const vollKarte = (t: { inhalt: string; szenenIdx: number }) =>
    t.inhalt === 'schritt' && t.szenenIdx > 0;
  const istVoll = vollKarte(takt);

  // Keep headline anchored while its text & role remain unchanged
  let oi = ti;
  while (
    oi > 0 &&
    !takte[oi].loop &&
    !vollKarte(takte[oi - 1]) &&
    takte[oi - 1].oben.text === takt.oben.text &&
    takte[oi - 1].oben.art === takt.oben.art
  ) {
    oi--;
  }
  const obenSeit = oi === 0 ? Infinity : f - takte[oi].von;

  // Stage transition & living micro-drift so no beat ever freezes dead
  // v51: auch ein Wechsel der großen Schritt-Karte auf einen anderen Schritt bekommt einen Übergang
  const neu =
    ti > 0 &&
    (!vor ||
      vor.inhalt !== takt.inhalt ||
      !!takt.loop ||
      (takt.inhalt === 'schritt' && vor.aktiv !== takt.aktiv));
  const kartenWechsel =
    neu && !!vor && !takt.loop && /^(liste|schritt)$/.test(vor.inhalt) && /^(liste|schritt)$/.test(takt.inhalt);
  const seit = f - takt.von;
  const taktDauer = Math.max(1, takt.bis - takt.von);
  const driftProgress = klemme(seit / taktDauer, 0, 1);
  const driftScale = 1 + (takt.kam.dz ?? 0.014) * driftProgress;

  const rein =
    ti === 0 || !neu
      ? 1
      : spring({
          frame: seit,
          fps,
          config: takt.loop
            ? { damping: 24, stiffness: 300, mass: 0.65 }
            : { damping: 20, stiffness: 185, mass: 0.72 },
        });
  const fahrt =
    ti === 0 || neu || !vor
      ? 1
      : spring({ frame: seit, fps, config: { damping: 24, stiffness: 78, mass: 1 } });

  let inhalt: React.ReactNode = null;
  if (takt.inhalt === 'shot' && shot && masse) {
    inhalt = (
      <BrowserRahmen
        shot={shot}
        masse={masse}
        toolUrl={p.toolUrl}
        kam={takt.kam}
        vorKam={vor?.kam}
        fahrt={fahrt}
        driftProgress={driftProgress}
        seit={seit}
      />
    );
  } else if (takt.inhalt === 'prompt') {
    let nZeichen = pf.text.length;
    let tippt = false;
    if (takt.tippVon !== undefined) {
      const tipp = Math.round(klemme(pf.text.length / 58, 0.85, 2.2) * fps);
      const q = klemme((f - takt.tippVon) / tipp, 0, 1);
      nZeichen = q >= 1 ? pf.text.length : kurve.filter((x) => x <= q).length;
      tippt = q < 1;
    }
    const auswahl = takt.markieren
      ? spring({ frame: seit, fps, config: { damping: 26, stiffness: 130 } })
      : 0;
    inhalt = (
      <PromptKarte
        text={pf.text}
        gekuerzt={pf.gekuerzt}
        groesse={pf.groesse}
        n={nZeichen}
        tippt={tippt}
        auswahl={auswahl}
        kopiertAb={takt.kopiertAb}
        driftScale={driftScale}
      />
    );
  } else if (takt.inhalt === 'liste' || takt.inhalt === 'shot') {
    const markiert =
      takt.kam.z > 1
        ? spring({ frame: Math.max(0, seit - Math.round(0.05 * fps)), fps, config: { damping: 20, stiffness: 170 } })
        : 0.65;
    inhalt = (
      <SchritteListe
        items={listeTexte}
        aktiv={takt.aktiv ?? 0}
        tool={p.tool}
        markiert={markiert}
        driftScale={driftScale}
      />
    );
  } else if (takt.inhalt === 'schritt') {
    inhalt = (
      <FokusKarte
        items={listeTexte}
        aktiv={takt.aktiv ?? 0}
        tool={p.tool}
        toolUrl={p.toolUrl}
        mittig={kartenMittig}
        seit={seit}
        driftScale={driftScale}
        hoehe={istVoll ? BUEHNE.y + BUEHNE.h - OBEN.top - 16 : undefined}
      />
    );
  } else if (takt.inhalt === 'teilen') {
    inhalt = <TeilenSzene seit={seit} beat={takt.beat} />;
  }

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Hintergrund />

      {p.audio && <Audio src={quelle(p.audio)!} />}
      <AudioSpur
        cues={sfxCues}
        woerter={p.woerter || []}
        dauer={p.dauer || durationInFrames / fps}
        sfx={p.sfx}
        musik={p.musik}
      />

      <Fortschritt frame={f} gesamt={durationInFrames} szenenGrenzen={szenenGrenzen} />

      {!istVoll && <ObenText o={takt.oben} tool={p.tool} toolUrl={p.toolUrl} seit={obenSeit} />}

      <div
        style={{
          position: 'absolute',
          left: BUEHNE.x,
          top: istVoll ? OBEN.top + 8 : BUEHNE.y,
          width: BUEHNE.b,
          height: istVoll ? BUEHNE.y + BUEHNE.h - OBEN.top - 8 : BUEHNE.h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - rein) * 48}px) scale(${0.968 + 0.032 * rein})`,
            // v51: Kartenwechsel ohne Screenshot blenden nicht über eine leere Bühne
            opacity: kartenWechsel ? klemme(0.45 + rein * 1.2, 0, 1) : klemme(rein * 1.75, 0, 1),
          }}
        >
          {inhalt}
        </div>
      </div>

      <Untertitel gruppen={gruppen} />

      {p.safeZone && <SafeZoneOverlay />}
    </AbsoluteFill>
  );
};
