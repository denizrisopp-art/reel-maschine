import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { aktivesWortIndex } from '../planner';
import { C, Gruppe, SPALTE, UT_UNTERKANTE } from '../types';

/**
 * Editorial active-word karaoke subtitles:
 * - Clean 3-4 word phrases (no jarring 1-word flashing)
 * - Exact ElevenLabs word timestamps highlight the spoken word live
 * - Spoken words remain crisp white, active word pops subtly, upcoming words softly recessed
 * - Strictly respects Instagram's bottom & right safe zones
 */
export const Untertitel: React.FC<{ gruppen: Gruppe[] }> = ({ gruppen }) => {
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
  const s =
    seit === Infinity
      ? 1
      : spring({ frame: seit, fps, config: { damping: 22, stiffness: 260, mass: 0.55 } });

  const aktivIdx = aktivesWortIndex(g, t);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 1920 - UT_UNTERKANTE,
        left: SPALTE.links,
        width: SPALTE.rechts - SPALTE.links,
        textAlign: 'center',
        fontWeight: 800,
        fontSize: 60,
        lineHeight: 1.18,
        letterSpacing: -1.1,
        wordSpacing: '0.14em',
        textWrap: 'balance',
        textShadow: '0 4px 16px rgba(0,0,0,0.72), 0 2px 0 rgba(0,0,0,0.45)',
        transform: `translateY(${(1 - s) * 10}px) scale(${0.97 + 0.03 * s})`,
        opacity: Math.min(1, s * 2.2),
      }}
    >
      {g.woerter.map((w, i) => {
        const istAktiv = i === aktivIdx;
        const gesprochen = i < aktivIdx;
        const wortSeit = Math.max(0, f - Math.round(w.start * fps));
        const wortPop = istAktiv
          ? spring({ frame: wortSeit, fps, config: { damping: 18, stiffness: 320, mass: 0.45 } })
          : 0;

        const farbe = w.tool
          ? istAktiv || gesprochen
            ? C.accent
            : 'rgba(255,212,0,0.46)'
          : istAktiv
            ? '#FFFFFF'
            : gesprochen
              ? 'rgba(247,247,248,0.88)'
              : 'rgba(247,247,248,0.38)';

        return (
          <React.Fragment key={`${idx}-${i}`}>
            {i > 0 ? ' ' : ''}
            <span
              style={{
                display: 'inline-block',
                color: farbe,
                // Kein scale mehr: das vergrößerte aktive Wort schob sich über die Leerzeichen
                // ("UrheberrechtsfreieMusik"), Reel 25.11.
                transform: istAktiv ? `translateY(${-2.5 * wortPop}px)` : 'none',
              }}
            >
              {w.text}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
