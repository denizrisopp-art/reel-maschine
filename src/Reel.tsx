import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, staticFile,
} from 'remotion';
import { fontFamily } from './fonts';

// Design-Tokens „Die Abkürzung“
const C = { ground: '#0B0B0E', panel: '#16161B', line: '#2A2A33', ink: '#FFFFFF', muted: 'rgba(255,255,255,0.62)', accent: '#FFD400' };

export type Szene = { titel: string; text: string; start: number; ende: number };
export type Wort = { text: string; start: number; end: number };
export type ReelProps = {
  tool: string; toolUrl: string; screenshot?: string; audio?: string; promptText?: string;
  szenen: Szene[]; woerter: Wort[]; dauer: number;
};

export const reelDuration = (p: ReelProps) => Math.max(30, Math.ceil((p.dauer || 20) * 30));

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const quelle = (s?: string) => (!s ? undefined : /^https?:/.test(s) ? s : staticFile(s));

// ---------- Hintergrund: dunkel, langsam wandernder Lichtschein, feines Korn ----------
const Hintergrund: React.FC = () => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 18;
  const y = 30 + Math.cos(f / 110) * 10;
  return (
    <AbsoluteFill style={{ background: C.ground }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${x}% ${y}%, rgba(255,212,0,0.10), transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(800px 900px at ${100 - x}% ${85 - y / 3}%, rgba(120,140,255,0.07), transparent 70%)` }} />
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: 'overlay' }}>
        <svg width="1080" height="1920">
          <filter id="korn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(f / 2) % 10} /></filter>
          <rect width="100%" height="100%" filter="url(#korn)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- Überschrift: Wörter springen nacheinander rein, Tool-Name mit gelbem Marker ----------
const Kopf: React.FC<{ text: string; tool: string; gross?: boolean; y: number }> = ({ text, tool, gross, y }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const woerter = text.split(/\s+/).filter(Boolean);
  const toolWoerter = tool.toLowerCase().split(/\s+/);
  return (
    <div style={{ position: 'absolute', top: y, left: 80, right: 80, textAlign: 'center', fontFamily, fontWeight: 900,
      fontSize: gross ? 92 : 72, lineHeight: 1.08, letterSpacing: -2, color: C.ink }}>
      {woerter.map((w, i) => {
        const s = spring({ frame: f - i * 3, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
        const istTool = toolWoerter.includes(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
        const marker = interpolate(f - i * 3 - 6, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        return (
          <span key={i} style={{ display: 'inline-block', margin: '0 12px', transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + s * 0.1})`, opacity: s, position: 'relative' }}>
            {istTool && <span style={{ position: 'absolute', left: -14, right: -14, top: '6%', bottom: '2%', background: C.accent, transformOrigin: 'left', transform: `scaleX(${marker})`, borderRadius: 14, zIndex: 0 }} />}
            <span style={{ position: 'relative', color: istTool && marker > 0.5 ? '#0B0B0E' : C.ink }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

// ---------- Browserfenster mit echtem Screenshot oder neutraler Oberfläche ----------
const Browser: React.FC<{ url: string; screenshot?: string; tool: string; ausschnitt: number; versatz?: number; children?: React.ReactNode }> = ({ url, screenshot, tool, ausschnitt, versatz = 0, children }) => {
  const f = useCurrentFrame() + versatz;
  const { fps, durationInFrames } = useVideoConfig();
  const rein = spring({ frame: f, fps, config: { damping: 16, stiffness: 120 } });
  const zoom = interpolate(f, [0, durationInFrames], [1.0, 1.08], clamp);
  const scroll = interpolate(f, [0, durationInFrames], [ausschnitt, ausschnitt + 6], clamp);
  const getippt = Math.floor(interpolate(f, [4, 26], [0, url.length], clamp));
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 600, height: 1000, borderRadius: 34, overflow: 'hidden', background: C.panel,
      border: `2px solid ${C.line}`, boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      transform: `translateY(${(1 - rein) * 260}px) scale(${0.94 + rein * 0.06})`, opacity: rein }}>
      <div style={{ height: 86, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', background: '#1C1C22', borderBottom: `2px solid ${C.line}` }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />)}
        <div style={{ marginLeft: 18, flex: 1, height: 50, borderRadius: 25, background: '#0F0F13', display: 'flex', alignItems: 'center', padding: '0 24px',
          fontFamily, fontWeight: 500, fontSize: 28, color: C.muted }}>
          🔒&nbsp;{url.slice(0, getippt)}<span style={{ opacity: f % 30 < 15 ? 1 : 0 }}>|</span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 86, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        {screenshot ? (
          <Img src={quelle(screenshot)!} style={{ width: '100%', transform: `translateY(-${scroll}%) scale(${zoom})`, transformOrigin: 'top center' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30,
            background: 'linear-gradient(180deg,#14141A,#0F0F13)', transform: `scale(${zoom})` }}>
            <div style={{ fontFamily, fontWeight: 900, fontSize: 96, color: C.ink, letterSpacing: -3 }}>{tool}</div>
            <div style={{ width: 520, height: 22, borderRadius: 11, background: C.line }} />
            <div style={{ width: 380, height: 22, borderRadius: 11, background: C.line }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

// ---------- Chat-Eingabe: Prompt wird live getippt, Mauszeiger klickt auf Senden, Antwort baut sich auf ----------
const PromptDemo: React.FC<{ prompt: string; tool: string; versatz: number; gesamt: number }> = ({ prompt, tool, versatz, gesamt }) => {
  const f = useCurrentFrame() + versatz;
  const { fps } = useVideoConfig();
  const tippEnde = Math.min(gesamt * 0.5, 12 + prompt.length * 0.8);
  const n = Math.floor(interpolate(f, [12, tippEnde], [0, prompt.length], clamp));
  const klick = tippEnde + 12;
  const zeiger = interpolate(f, [tippEnde - 6, klick], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ripple = interpolate(f, [klick, klick + 14], [0, 1], clamp);
  const antwort = f > klick + 6;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#121217,#0E0E12)', padding: 44, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 26 }}>
      <div style={{ fontFamily, fontWeight: 700, fontSize: 30, color: C.muted, marginBottom: 'auto', marginTop: 20 }}>{tool}</div>
      {antwort && [0.92, 0.8, 0.86, 0.6].map((w, i) => {
        const s = spring({ frame: f - klick - 6 - i * 5, fps, config: { damping: 18 } });
        return <div key={i} style={{ height: 26, width: `${w * 100}%`, borderRadius: 13, opacity: s,
          background: 'linear-gradient(90deg,#2A2A33,#3A3A45,#2A2A33)', backgroundSize: '200% 100%', backgroundPosition: `${(f * 4) % 200}% 0` }} />;
      })}
      <div style={{ position: 'relative', borderRadius: 30, border: `3px solid ${n > 0 ? C.accent : C.line}`, background: '#0B0B0E', padding: '30px 120px 30px 34px',
        fontFamily, fontWeight: 600, fontSize: 36, lineHeight: 1.35, color: C.ink, minHeight: 120 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: C.accent, marginBottom: 10 }}>PROMPT ZUM KOPIEREN</div>
        {prompt.slice(0, n)}<span style={{ opacity: f % 24 < 12 && n < prompt.length ? 1 : 0, color: C.accent }}>▍</span>
        <div style={{ position: 'absolute', right: 26, bottom: 26, width: 70, height: 70, borderRadius: 35, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${1 - Math.sin(ripple * Math.PI) * 0.12})` }}>
          <svg width="34" height="34" viewBox="0 0 24 24"><path d="M3 12l18-9-7 18-2-7-9-2z" fill="#0B0B0E" /></svg>
        </div>
        {ripple > 0 && ripple < 1 && <div style={{ position: 'absolute', right: 26 + 35 - 70 * ripple, bottom: 26 + 35 - 70 * ripple, width: 140 * ripple, height: 140 * ripple,
          borderRadius: '50%', border: `4px solid ${C.accent}`, opacity: 1 - ripple }} />}
      </div>
      <svg width="64" height="64" viewBox="0 0 24 24" style={{ position: 'absolute',
        left: interpolate(zeiger, [0, 1], [500, 880]), top: interpolate(zeiger, [0, 1], [380, 760]), filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.6))' }}>
        <path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#000" strokeWidth="1.2" />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- Abschluss: Weiterschicken-Symbol ----------
const Abschluss: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 10, stiffness: 120 } });
  const flug = interpolate(f, [18, 40], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', top: 760, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 300, height: 300, borderRadius: 80, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${s})`, boxShadow: '0 30px 100px rgba(255,212,0,0.35)' }}>
        <svg width="150" height="150" viewBox="0 0 24 24" style={{ transform: `translate(${flug * 300}px, ${-flug * 300}px) rotate(${flug * 20}deg)`, opacity: 1 - flug * 0.8 }}>
          <path d="M3 12l18-9-7 18-2-7-9-2z" fill="#0B0B0E" />
        </svg>
      </div>
    </div>
  );
};

// ---------- Untertitel: 3 Wörter, das gesprochene Wort leuchtet gelb ----------
const Untertitel: React.FC<{ woerter: Wort[] }> = ({ woerter }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const idx = woerter.findIndex(w => t >= w.start && t < w.end + 0.15);
  if (idx < 0) return null;
  const g0 = Math.floor(idx / 3) * 3;
  const gruppe = woerter.slice(g0, g0 + 3);
  const gStart = Math.round(gruppe[0].start * fps);
  const s = spring({ frame: f - gStart, fps, config: { damping: 14, stiffness: 200 } });
  return (
    <div style={{ position: 'absolute', bottom: 190, left: 70, right: 70, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: 4, fontFamily, fontWeight: 900, fontSize: 62,
      letterSpacing: -1, transform: `scale(${0.85 + s * 0.15})`, opacity: s }}>
      {gruppe.map((w, i) => (
        <span key={i} style={{ margin: '0 10px', color: g0 + i === idx ? C.accent : C.ink,
          textShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 24px rgba(0,0,0,0.6)' }}>{w.text}</span>
      ))}
    </div>
  );
};

// ---------- Ganzes Reel ----------
export const Reel: React.FC<ReelProps> = (p) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const promptIdx = p.promptText ? Math.max(1, p.szenen.findIndex(s => /prompt/i.test(s.text))) : -1;
  const letzte = p.szenen.length - 1;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Hintergrund />
      {p.audio && <Audio src={quelle(p.audio)!} />}
      {p.szenen.map((sz, i) => {
        const von = Math.round(sz.start * fps);
        const bis = i === letzte ? durationInFrames : Math.round(sz.ende * fps);
        const typ = i === 0 ? 'hook' : (promptIdx > 0 && i >= promptIdx) ? 'prompt' : i === letzte ? 'ende' : 'browser';
        return (
          <Sequence key={i} from={von} durationInFrames={Math.max(1, bis - von)}>
            <SzeneRahmen>
              {typ === 'hook' && <Kopf text={sz.titel} tool={p.tool} gross y={420} />}
              {typ === 'hook' && <div style={{ position: 'absolute', inset: 0, transform: 'translateY(380px) scale(0.92)', opacity: 0.9 }}><Browser url={p.toolUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} screenshot={p.screenshot} tool={p.tool} ausschnitt={0} /></div>}
              {typ !== 'hook' && <Kopf text={sz.titel} tool={p.tool} y={300} />}
              {typ === 'browser' && <Browser url={p.toolUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} screenshot={p.screenshot} tool={p.tool} ausschnitt={[0, 12, 24][i % 3]} />}
              {typ === 'prompt' && (
                <Browser url={p.toolUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} tool={p.tool} ausschnitt={0} versatz={von - Math.round((p.szenen[promptIdx]?.start || 0) * fps)}>
                  <PromptDemo prompt={p.promptText || ''} tool={p.tool} versatz={von - Math.round((p.szenen[promptIdx]?.start || 0) * fps)} gesamt={durationInFrames - Math.round((p.szenen[promptIdx]?.start || 0) * fps)} />
                </Browser>
              )}
              {typ === 'ende' && <Abschluss />}
            </SzeneRahmen>
          </Sequence>
        );
      })}
      <Untertitel woerter={p.woerter} />
      {/* Fortschrittsbalken + Handle */}
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: `${(f / durationInFrames) * 100}%`, background: C.accent }} />
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily, fontWeight: 600, fontSize: 30, color: C.muted, letterSpacing: 1 }}>@abkuerzung.ki</div>
    </AbsoluteFill>
  );
};

// Weicher Szenenwechsel: kurz einblenden, leicht hochgleiten
const SzeneRahmen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6], [0, 1], clamp);
  const y = interpolate(f, [0, 8], [30, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <AbsoluteFill style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
};
