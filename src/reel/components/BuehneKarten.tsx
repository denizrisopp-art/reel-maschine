import React from 'react';
import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { monoFontFamily } from '../../fonts';
import { cleanDomain, kameraPx, klemme, lerp } from '../planner';
import { BAR, BUEHNE, C, Kamera } from '../types';
import { Gefaerbt, Nummer } from './ObenText';

/** Authentic macOS-inspired crisp vector pointer with subtle drop shadow */
const Zeiger: React.FC<{ x: number; y: number; opacity: number; press: number }> = ({
  x,
  y,
  opacity,
  press,
}) => {
  if (opacity <= 0.01) return null;
  const s = 1 - press * 0.14;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        pointerEvents: 'none',
        opacity,
        transform: `scale(${s})`,
        transformOrigin: '4px 4px',
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.55))',
        zIndex: 10,
      }}
    >
      <svg width="42" height="46" viewBox="0 0 28 32" fill="none">
        <path
          d="M3.5 2.5L23.5 16.5L14.2 18.2L18.4 27.6L14.6 29.3L10.4 19.9L4.2 25.4L3.5 2.5Z"
          fill="#FFFFFF"
          stroke="#0B0B0D"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const KlickRing: React.FC<{ x: number; y: number; progress: number }> = ({ x, y, progress }) => {
  if (progress <= 0.01 || progress >= 0.99) return null;
  const radius = 14 + progress * 34;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: '50%',
        border: `2.5px solid ${C.accent}`,
        opacity: (1 - progress) * 0.85,
        pointerEvents: 'none',
        zIndex: 9,
      }}
    />
  );
};

const Adressleiste: React.FC<{ url: string }> = ({ url }) => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: BAR,
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '0 22px',
      background: C.bar,
      borderBottom: `1px solid ${C.line}`,
      zIndex: 3,
    }}
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 11,
          height: 11,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.16)',
        }}
      />
    ))}
    <div
      style={{
        marginLeft: 14,
        flex: 1,
        height: 34,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.34)',
        border: `1px solid rgba(255,255,255,0.06)`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 16px',
        fontFamily: monoFontFamily,
        fontWeight: 500,
        fontSize: 21,
        color: C.inkSoft,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', opacity: 0.65 }}>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2.2" />
        <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span>{url}</span>
    </div>
  </div>
);

type BrowserRahmenProps = {
  shot: string;
  masse: { b: number; h: number };
  toolUrl: string;
  kam: Kamera;
  vorKam?: Kamera;
  fahrt: number;
  driftProgress: number;
  seit: number;
};

export const BrowserRahmen: React.FC<BrowserRahmenProps> = ({
  shot,
  masse,
  toolUrl,
  kam,
  vorKam,
  fahrt,
  driftProgress,
  seit,
}) => {
  const { fps } = useVideoConfig();
  const Wv = BUEHNE.b - 2;
  const ar = masse.h / masse.b;
  const W = Wv;
  const H = W * ar;
  const hv = Math.min(BUEHNE.h - BAR - 2, H);
  const ziel = kameraPx(kam, W, H, Wv, hv, driftProgress);
  const alt = vorKam && fahrt < 1 ? kameraPx(vorKam, W, H, Wv, hv, 1) : ziel;
  const c = {
    z: lerp(alt.z, ziel.z, fahrt),
    tx: lerp(alt.tx, ziel.tx, fahrt),
    ty: lerp(alt.ty, ziel.ty, fahrt),
  };

  // Optional smooth editorial pointer glide & tactile click on zoomed focus beats
  const cursorGlide = kam.cursor
    ? spring({ frame: Math.max(0, seit - Math.round(0.22 * fps)), fps, config: { damping: 24, stiffness: 120, mass: 0.9 } })
    : 0;
  const clickStart = Math.round(0.65 * fps);
  const clickProgress = kam.cursor?.klick
    ? klemme((seit - clickStart) / Math.round(0.35 * fps), 0, 1)
    : 0;
  const press =
    kam.cursor?.klick && seit >= clickStart && seit < clickStart + Math.round(0.16 * fps)
      ? Math.sin(((seit - clickStart) / Math.round(0.16 * fps)) * Math.PI)
      : 0;

  const cx = kam.cursor ? lerp(Wv * 0.84, Wv * kam.cursor.x, cursorGlide) : 0;
  const cy = kam.cursor ? lerp(hv * 0.88, hv * kam.cursor.y, cursorGlide) : 0;

  return (
    <div
      style={{
        position: 'relative',
        width: BUEHNE.b,
        height: hv + BAR + 2,
        boxSizing: 'border-box',
        borderRadius: 24,
        overflow: 'hidden',
        background: C.panel,
        border: `1px solid ${C.lineStrong}`,
        boxShadow: '0 28px 72px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <Adressleiste url={cleanDomain(toolUrl)} />
      <div
        style={{
          position: 'absolute',
          top: BAR,
          left: 0,
          width: Wv,
          height: hv,
          overflow: 'hidden',
          background: '#FFFFFF',
        }}
      >
        <Img
          src={shot}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            transformOrigin: '0 0',
            transform: `translate(${c.tx}px, ${c.ty}px) scale(${c.z})`,
          }}
        />
        {/* Subtle edge depth vignette inside browser viewport */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 36px rgba(0,0,0,0.12)',
          }}
        />
        {kam.cursor && (
          <>
            <KlickRing x={cx} y={cy} progress={clickProgress} />
            <Zeiger x={cx} y={cy} opacity={klemme(cursorGlide * 2.2, 0, 1)} press={press} />
          </>
        )}
      </div>
    </div>
  );
};

type PromptKarteProps = {
  text: string;
  gekuerzt: boolean;
  groesse: number;
  n: number;
  tippt: boolean;
  auswahl: number;
  kopiertAb?: number;
  driftScale: number;
};

export const PromptKarte: React.FC<PromptKarteProps> = ({
  text,
  gekuerzt,
  groesse,
  n,
  tippt,
  auswahl,
  kopiertAb,
  driftScale,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sichtbar = text.slice(0, n);
  const m = Math.min(sichtbar.length, Math.round(auswahl * sichtbar.length));

  // Cursor glides to the top-right "Kopieren" button right before kopiertAb, presses, and confirms
  const hatKopie = kopiertAb !== undefined;
  const glideStart = hatKopie ? kopiertAb - Math.round(0.45 * fps) : Infinity;
  const glide = hatKopie
    ? spring({ frame: Math.max(0, f - glideStart), fps, config: { damping: 24, stiffness: 135, mass: 0.85 } })
    : 0;
  const istKopiert = hatKopie && f >= kopiertAb;
  const kopiePop = istKopiert
    ? spring({ frame: f - kopiertAb, fps, config: { damping: 16, stiffness: 260, mass: 0.65 } })
    : 0;
  const pressFrames = Math.round(0.14 * fps);
  const press =
    hatKopie && f >= kopiertAb - Math.round(0.06 * fps) && f < kopiertAb + pressFrames
      ? Math.sin(((f - (kopiertAb - Math.round(0.06 * fps))) / (pressFrames + Math.round(0.06 * fps))) * Math.PI)
      : 0;
  const ringProgress = istKopiert ? klemme((f - kopiertAb) / Math.round(0.36 * fps), 0, 1) : 0;

  const exitStart = hatKopie ? kopiertAb + Math.round(0.24 * fps) : Infinity;
  const exitProgress = hatKopie
    ? klemme((f - exitStart) / Math.round(0.32 * fps), 0, 1)
    : 0;

  const btnX = BUEHNE.b - 118;
  const btnY = 46;
  const cursorX = lerp(BUEHNE.b - 220, btnX, glide) + exitProgress * 36;
  const cursorY = lerp(290, btnY, glide) + exitProgress * 44;
  const enterOpacity = hatKopie ? klemme((f - glideStart) / Math.round(0.14 * fps), 0, 1) : 0;
  const cursorOpacity = enterOpacity * (1 - exitProgress);

  // Smooth blink cadence independent of 30/60fps
  const caretOn = Math.floor(f / (fps * 0.34)) % 2 === 0;

  return (
    <div
      style={{
        position: 'relative',
        width: BUEHNE.b,
        boxSizing: 'border-box',
        maxHeight: BUEHNE.h,
        minHeight: 320,
        borderRadius: 24,
        border: `1.5px solid ${istKopiert ? C.successBorder : C.accentBorder}`,
        background: C.panel,
        boxShadow: '0 28px 72px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.10)',
        padding: '28px 36px 34px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: `scale(${driftScale})`,
      }}
    >
      {/* Header row: clean mono label + live tactile Copy button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 20,
          marginBottom: 22,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            fontFamily: monoFontFamily,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 1.4,
            color: C.accent,
          }}
        >
          PROMPT
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderRadius: 12,
            background: istKopiert ? C.successBg : 'rgba(255,255,255,0.06)',
            border: `1px solid ${istKopiert ? C.successBorder : C.lineStrong}`,
            color: istKopiert ? C.success : C.inkSoft,
            fontFamily: monoFontFamily,
            fontSize: 21,
            fontWeight: 600,
            transform: `scale(${1 - press * 0.06 + kopiePop * 0.02})`,
          }}
        >
          {istKopiert ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke={C.success}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2.1" />
              <path
                d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span>{istKopiert ? 'Kopiert' : 'Kopieren'}</span>
        </div>
      </div>

      {/* Prompt body */}
      <div
        style={{
          position: 'relative',
          fontWeight: 600,
          fontSize: groesse,
          lineHeight: 1.36,
          letterSpacing: -0.4,
          color: C.ink,
        }}
      >
        <div style={{ visibility: 'hidden' }}>{text}</div>
        <div style={{ position: 'absolute', inset: 0 }}>
          {m > 0 && (
            <span
              style={{
                background: C.auswahl,
                borderRadius: 6,
                padding: '2px 4px',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {sichtbar.slice(0, m)}
            </span>
          )}
          {sichtbar.slice(m)}
          {tippt && (
            <span
              style={{
                display: 'inline-block',
                width: 4,
                height: '0.9em',
                marginLeft: 4,
                verticalAlign: '-0.08em',
                borderRadius: 2,
                background: C.accent,
                opacity: caretOn ? 1 : 0,
              }}
            />
          )}
        </div>
      </div>

      {gekuerzt && (
        <div
          style={{
            marginTop: 18,
            fontFamily: monoFontFamily,
            fontSize: 22,
            fontWeight: 500,
            color: C.muted,
          }}
        >
          Vollständig in der Beschreibung
        </div>
      )}

      {hatKopie && cursorOpacity > 0.01 && (
        <>
          <KlickRing x={btnX} y={btnY} progress={ringProgress} />
          <Zeiger x={cursorX} y={cursorY} opacity={cursorOpacity} press={press} />
        </>
      )}
    </div>
  );
};

type SchritteListeProps = {
  items: string[];
  aktiv: number;
  tool: string;
  markiert: number;
  driftScale: number;
};

export const SchritteListe: React.FC<SchritteListeProps> = ({
  items,
  aktiv,
  tool,
  markiert,
  driftScale,
}) => {
  const safeAktiv = klemme(aktiv, 0, Math.max(0, items.length - 1));
  return (
    <div
      style={{
        width: BUEHNE.b,
        boxSizing: 'border-box',
        borderRadius: 24,
        background: C.panel,
        border: `1px solid ${C.lineStrong}`,
        boxShadow: '0 28px 72px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.10)',
        padding: '32px 34px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transform: `scale(${driftScale})`,
      }}
    >
      {/* Editorial header: clean text + tabular counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 16,
          marginBottom: 4,
          borderBottom: `1px solid ${C.line}`,
          fontFamily: monoFontFamily,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ color: C.muted }}>ABLAUF</span>
        <span style={{ color: C.leise }}>
          {String(safeAktiv + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
      </div>

      {items.map((t, i) => {
        const istAktiv = i === safeAktiv;
        const erledigt = i < safeAktiv;
        const fokus = istAktiv ? Math.max(0.6, markiert) : 0;

        return (
          <div
            key={i}
            style={{
              position: 'relative',
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              padding: '18px 20px',
              borderRadius: 16,
              background: istAktiv ? C.panelElevated : 'transparent',
              border: istAktiv
                ? `1.5px solid rgba(255,255,255,${(0.14 + 0.14 * fokus).toFixed(2)})`
                : '1.5px solid transparent',
              boxShadow: istAktiv ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
              opacity: istAktiv ? 1 : erledigt ? 0.68 : 0.36,
              transform: istAktiv ? `scale(${1 + 0.012 * fokus})` : 'scale(1)',
            }}
          >
            <Nummer n={i + 1} erledigt={erledigt} aktiv={istAktiv} />
            <div
              style={{
                fontSize: items.length > 3 ? 38 : 44,
                fontWeight: istAktiv ? 700 : 600,
                lineHeight: 1.18,
                letterSpacing: -0.6,
                color: C.ink,
              }}
            >
              <Gefaerbt text={t} tool={tool} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Flieger: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <svg width="240" height="240" viewBox="0 0 24 24" style={{ position: 'absolute', ...style }}>
    <path
      d="M21.5 2.5 L2.8 10.2 L10.2 13.6 L13.6 21.2 Z M21.5 2.5 L10.2 13.6"
      fill="rgba(255,255,255,0.05)"
      stroke={C.ink}
      strokeWidth="1.35"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

export const TeilenSzene: React.FC<{ seit: number; beat: number }> = ({ seit, beat }) => {
  const { fps } = useVideoConfig();
  const rein = spring({
    frame: seit - (beat > 0 ? Math.round(0.18 * fps) : 0),
    fps,
    config: { damping: 14, stiffness: 155, mass: 0.72 },
  });
  const raus =
    beat > 0 ? spring({ frame: seit, fps, config: { damping: 22, stiffness: 115 } }) : 1;
  const trail = klemme(rein, 0, 1);
  const pathLen = 360;

  return (
    <div
      style={{
        position: 'relative',
        width: BUEHNE.b,
        height: 440,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Dynamic curved flight trail terminating cleanly behind the centered paper plane's rear notch */}
      <svg
        width="872"
        height="440"
        viewBox="0 0 872 440"
        fill="none"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <path
          d="M 155 348 Q 275 318 338 258 T 418 222"
          stroke={C.accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="10 14"
          strokeDashoffset={pathLen * (1 - trail)}
          opacity={0.52 * trail}
        />
      </svg>

      {beat > 0 && raus < 0.97 && (
        <Flieger
          style={{
            transform: `translate(${raus * 270}px, ${-raus * 290}px) rotate(${raus * 14}deg)`,
            opacity: 1 - raus,
          }}
        />
      )}
      <Flieger
        style={{
          transform: `translate(${(1 - rein) * -75}px, ${(1 - rein) * 75}px) scale(${0.58 + 0.42 * rein})`,
          opacity: klemme(rein * 1.7, 0, 1),
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 10,
          fontFamily: monoFontFamily,
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: C.muted,
          opacity: klemme(rein * 1.4, 0, 1),
        }}
      >
        TEILEN · SPEICHERN
      </div>
    </div>
  );
};
