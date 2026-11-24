import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { monoFontFamily } from '../../fonts';
import { cleanDomain, toolMarken } from '../planner';
import { C, OBEN, Oben, SPALTE } from '../types';

export const Gefaerbt: React.FC<{
  text: string;
  tool: string;
  underlineProgress?: number;
}> = ({ text, tool, underlineProgress = 0 }) => {
  const w = text.split(/\s+/).filter(Boolean);
  const m = toolMarken(w, tool);
  return (
    <>
      {w.map((x, i) => (
        <React.Fragment key={i}>
          {i > 0 ? ' ' : ''}
          <span
            style={{
              position: 'relative',
              display: 'inline-block',
              color: m[i] ? C.accent : undefined,
            }}
          >
            {x}
            {m[i] && underlineProgress > 0.01 && (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 2,
                  height: 6,
                  borderRadius: 3,
                  background: C.accent,
                  opacity: 0.36,
                  transformOrigin: '0 50%',
                  transform: `scaleX(${underlineProgress})`,
                }}
              />
            )}
          </span>
        </React.Fragment>
      ))}
    </>
  );
};

export const Nummer: React.FC<{
  n: number;
  gross?: boolean;
  erledigt?: boolean;
  aktiv?: boolean;
}> = ({ n, gross, erledigt, aktiv }) => {
  const size = gross ? 70 : 54;
  const gefuellt = gross || aktiv;
  return (
    <div
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: gross ? 18 : 14,
        background: erledigt ? C.successBg : gefuellt ? C.ink : 'rgba(255,255,255,0.08)',
        border: erledigt
          ? `1.5px solid ${C.successBorder}`
          : gefuellt
            ? 'none'
            : `1.5px solid ${C.lineStrong}`,
        color: erledigt ? C.success : gefuellt ? C.ground : C.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: monoFontFamily,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        fontSize: gross ? 32 : 24,
        letterSpacing: -0.5,
      }}
    >
      {erledigt ? (
        <svg width={gross ? 30 : 24} height={gross ? 30 : 24} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke={C.success}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        String(n).padStart(2, '0')
      )}
    </div>
  );
};

type ObenTextProps = {
  o: Oben;
  tool: string;
  toolUrl: string;
  seit: number;
};

export const ObenText: React.FC<ObenTextProps> = ({ o, tool, toolUrl, seit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s =
    seit === Infinity
      ? 1
      : spring({
          frame: seit,
          fps,
          config:
            o.art === 'hook'
              ? { damping: 24, stiffness: 300, mass: 0.65 }
              : { damping: 20, stiffness: 185, mass: 0.7 },
        });

  const underline =
    o.art === 'hook'
      ? spring({
          frame: Math.max(0, frame - Math.round(0.12 * fps)),
          fps,
          config: { damping: 22, stiffness: 140, mass: 0.8 },
        })
      : 0;

  const domain = cleanDomain(toolUrl);
  const stil: React.CSSProperties = {
    position: 'absolute',
    top: OBEN.top,
    height: OBEN.unten - OBEN.top,
    left: SPALTE.links,
    width: SPALTE.rechts - SPALTE.links,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: 14,
    transform: `translateY(${(1 - s) * 24}px)`,
    opacity: Math.min(1, s * 1.6),
    color: C.ink,
  };

  if (o.art === 'hook') {
    const L = o.text.length;
    const fs = L <= 24 ? 86 : L <= 38 ? 78 : L <= 54 ? 68 : 60;
    return (
      <div style={{ ...stil, alignItems: 'center', textAlign: 'center', gap: 18 }}>
        {/* Clean unboxed editorial kicker (zero pill clutter) */}
        <div
          style={{
            fontFamily: monoFontFamily,
            fontSize: 23,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: C.muted,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ color: C.accent }}>{tool}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{domain}</span>
        </div>
        <div
          style={{
            fontWeight: 800,
            fontSize: fs,
            lineHeight: 1.06,
            letterSpacing: -2.2,
            wordSpacing: '0.14em',
            textWrap: 'balance',
          }}
        >
          <Gefaerbt text={o.text} tool={tool} underlineProgress={underline} />
        </div>
      </div>
    );
  }

  if (o.art === 'titel') {
    const fs = o.text.length <= 28 ? 66 : o.text.length <= 44 ? 58 : 50;
    return (
      <div style={{ ...stil, alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: fs,
            lineHeight: 1.08,
            letterSpacing: -1.6,
            wordSpacing: '0.14em',
            textWrap: 'balance',
          }}
        >
          <Gefaerbt text={o.text} tool={tool} />
        </div>
      </div>
    );
  }

  const fs = o.text.length <= 28 ? 62 : o.text.length <= 44 ? 54 : 46;
  return (
    <div style={{ ...stil, gap: 14 }}>
      {o.nr ? (
        <div
          style={{
            fontFamily: monoFontFamily,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 1.2,
            color: C.muted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          SCHRITT {String(o.nr).padStart(2, '0')}
          {o.gesamtSchritte ? ` / ${String(o.gesamtSchritte).padStart(2, '0')}` : ''}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
        {o.nr ? <Nummer n={o.nr} gross /> : null}
        <div
          style={{
            fontWeight: 800,
            fontSize: fs,
            lineHeight: 1.09,
            letterSpacing: -1.4,
            wordSpacing: '0.14em',
            textWrap: 'balance',
          }}
        >
          <Gefaerbt text={o.text} tool={tool} />
        </div>
      </div>
    </div>
  );
};
