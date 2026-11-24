import { continueRender, delayRender, staticFile } from 'remotion';
import { loadFont as loadPlusJakarta } from '@remotion/google-fonts/PlusJakartaSans';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

const lokalFamily = 'InterLokal';

// Editorial Display & Body: Plus Jakarta Sans (with local Inter fallback so offline/CI never breaks)
const jakarta = loadPlusJakarta('normal', {
  weights: ['500', '600', '700', '800'],
  subsets: ['latin', 'latin-ext'],
});

// Prompt & URL precision mono: JetBrains Mono
const mono = loadJetBrainsMono('normal', {
  weights: ['500', '600', '700'],
  subsets: ['latin', 'latin-ext'],
});

export const fontFamily = `${jakarta.fontFamily}, '${lokalFamily}', system-ui, sans-serif`;
export const monoFontFamily = `${mono.fontFamily}, ui-monospace, SFMono-Regular, Menlo, monospace`;

const weights = [500, 600, 700, 800, 900];
const handle = delayRender('Schriften laden');

const loadLokal = Promise.all(
  weights.flatMap((w) =>
    ['latin', 'latin-ext'].map((sub) => {
      const ff = new FontFace(
        lokalFamily,
        `url(${staticFile(`fonts/inter-${sub}-${w}-normal.woff2`)}) format('woff2')`,
        {
          weight: String(w),
          unicodeRange:
            sub === 'latin'
              ? 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
              : 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF',
        },
      );
      return ff.load().then((f) => (document as any).fonts.add(f));
    }),
  ),
);

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p.catch(() => undefined), new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

Promise.all([
  withTimeout(loadLokal, 3000),
  withTimeout(jakarta.waitUntilDone(), 3500),
  withTimeout(mono.waitUntilDone(), 3500),
])
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
