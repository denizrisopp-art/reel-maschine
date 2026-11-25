export const REEL_FPS = 30;
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;

// Calibrated editorial dark studio palette — zero neon, zero purple AI slop
export const C = {
  ground: '#0B0B0D',
  groundLift: '#131317',
  panel: '#151519',
  panelElevated: '#1C1C22',
  bar: '#19191F',
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.18)',
  ink: '#F7F7F8',
  inkSoft: 'rgba(247,247,248,0.72)',
  muted: 'rgba(247,247,248,0.52)',
  leise: 'rgba(247,247,248,0.34)',
  accent: '#FFD400',
  accentSoft: 'rgba(255,212,0,0.14)',
  accentBorder: 'rgba(255,212,0,0.55)',
  auswahl: 'rgba(84,148,255,0.36)',
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.14)',
  successBorder: 'rgba(52,211,153,0.42)',
};

// Instagram Safe Zones (1080 x 1920):
// Top 188px clear of camera/status bar; right 140px clear of heart/comment/share rail;
// bottom 480px clear of caption & audio bar (subtitles end <= 1440)
export const SPALTE = { links: 76, rechts: 940 };
export const FORTSCHRITT_Y = 186;
export const OBEN = { top: 220, unten: 548 };
export const BUEHNE = { x: 68, y: 586, b: 872, h: 696 };
export const UT_UNTERKANTE = 1440;
export const BAR = 56;

export type Szene = {
  titel: string;
  text: string;
  start: number;
  ende: number;
};

export type Wort = {
  text: string;
  start: number;
  end: number;
};

export type FokusPunkt = {
  x: number;
  y: number;
  z?: number;
};

export type ReelProps = {
  tool: string;
  toolUrl: string;
  screenshot?: string;
  ergebnisBild?: string;
  audio?: string;
  promptText?: string;
  schritte?: string[];
  fokus?: FokusPunkt[];
  szenen: Szene[];
  woerter: Wort[];
  dauer: number;
  sfx?: boolean;
  musik?: boolean;
  safeZone?: boolean;
};

export type Inhalt = 'shot' | 'prompt' | 'liste' | 'teilen';

export type Kamera = {
  z: number;
  x: number;
  y: number;
  /** Subtle continuous drift during the beat so the frame never feels frozen */
  dz?: number;
  dy?: number;
  /** Optional cursor target inside the viewport (0..1) */
  cursor?: { x: number; y: number; klick?: boolean };
  /** v45: fester Bildausschnitt (linke/obere Kante als Anteil des Screenshots), von ausrichten() gesetzt */
  fest?: { u0: number; v0: number };
};

/** v45: grobe Karte, wo im Screenshot Schrift/Kanten sind (1 = Kante), zum Ausrichten der Zooms */
export type Tinte = { gw: number; gh: number; d: Uint8Array };

export type BildMasse = { b: number; h: number; tinte?: Tinte };

export type Oben = {
  art: 'hook' | 'schritt' | 'titel';
  text: string;
  nr?: number;
  gesamtSchritte?: number;
};

export type Takt = {
  von: number;
  bis: number;
  inhalt: Inhalt;
  kam: Kamera;
  oben: Oben;
  szenenIdx: number;
  tippVon?: number;
  markieren?: boolean;
  kopiertAb?: number;
  aktiv?: number;
  beat: number;
  loop?: boolean;
};

export type WortEintrag = {
  text: string;
  start: number;
  end: number;
  tool: boolean;
};

export type Gruppe = {
  woerter: WortEintrag[];
  start: number;
  end: number;
};

export type SfxArt = 'whoosh' | 'pop' | 'key1' | 'key2' | 'key3' | 'copy' | 'send';

export type SfxCue = {
  frame: number;
  art: SfxArt;
  volume: number;
};
