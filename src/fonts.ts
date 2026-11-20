import { continueRender, delayRender, staticFile } from 'remotion';
export const fontFamily = 'InterLokal';
const weights = [500, 600, 700, 800, 900];
const handle = delayRender('Schriften laden');
Promise.all(weights.flatMap(w => ['latin', 'latin-ext'].map(sub => {
  const ff = new FontFace(fontFamily, `url(${staticFile(`fonts/inter-${sub}-${w}-normal.woff2`)}) format('woff2')`, { weight: String(w),
    unicodeRange: sub === 'latin' ? 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' : 'U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF' });
  return ff.load().then(f => (document as any).fonts.add(f));
}))).then(() => continueRender(handle)).catch(() => continueRender(handle));
