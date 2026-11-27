// v31: Echte Bildschirmaufnahme der offiziellen Tool-Website.
// Läuft in GitHub Actions vor dem Render (Chrome ist dort vorinstalliert, playwright-core wird
// ohne Lockfile-Änderung nachgeladen). Bilder kommen scharf über die Chrome-Bildschirmübertragung
// (CDP-Screencast, JPEG), die Remotion-eigene ffmpeg-Datei macht daraus ein MP4 mit 30 fps.
// Headless zeigt keinen Mauszeiger: Der Mausweg wird gespeichert, die Vorlage zeichnet ihn nach.
// Schlägt etwas fehl (fremde Domain, Login- oder Prüfseite, leere Seite, Zeitlimit), kommt null
// zurück und das Reel nimmt wie bisher Screenshot bzw. Schritt-Karten. Es wird nie geklickt.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BREITE = 1120;
const HOEHE = 780;
// Cookie-Hinweis: zuerst ablehnen bzw. nur Notwendiges, sonst schließen, sonst ausblenden
const ABLEHNEN =
  /^(alle\s+)?(ablehnen|alle ablehnen|nur (notwendige|erforderliche|essenzielle)( cookies)?( (akzeptieren|zulassen|erlauben))?|notwendige cookies|optionale cookies ablehnen|reject|reject all|decline|decline all|necessary only|only necessary|use necessary cookies only|reject optional cookies)$/i;
const SCHLIESSEN = /^(schließen|close|×|✕|x|dismiss|später|not now|nein danke|no thanks)$/i;
const SPERRE =
  /captcha|verify you are human|are you a robot|access denied|attention required|just a moment|checking your browser|unusual traffic|bestätigen sie, dass sie ein mensch|zugriff verweigert|enable javascript and cookies/i;
const LOGIN_PFAD = /\/(login|log-in|signin|sign-in|sign_in|auth|anmelden|account\/login|sso)(\/|$|\?)/i;
const LOGIN_WORT = /(anmelden|einloggen|log in|login|sign in|registrieren|sign up|konto erstellen|create account|weiter mit google|continue with google)/i;
const COOKIE_CSS = `#onetrust-banner-sdk,#onetrust-consent-sdk,#CybotCookiebotDialog,#usercentrics-root,#usercentrics-cmp-ui,#cookiebanner,#cookie-banner,#cookie-consent,.cc-window,.cookie-banner,.cookie-consent,.cky-consent-container,#didomi-host,#truste-consent-track,.osano-cm-window,[id^="sp_message_container"],[class*="CookieBanner"],[class*="cookie-banner"],[class*="cookieBanner"],[aria-label*="cookie" i][role="dialog"],[aria-label*="cookie" i][role="region"],[aria-label*="cookie" i][role="alertdialog"]{display:none!important}`;

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const wurzel = (h) => h.replace(/^www\./, '').split('.').slice(-2).join('.');

const ffmpegPfad = () => {
  for (const p of [
    'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg',
    'node_modules/@remotion/compositor-linux-x64-musl/ffmpeg',
  ]) {
    if (fs.existsSync(p)) return { bin: path.resolve(p), lib: path.resolve(path.dirname(p)) };
  }
  return { bin: 'ffmpeg', lib: '' };
};

export async function aufnehmen({ url, woerter = [], ziel, limitMs = 40000 }) {
  let pw;
  try {
    pw = await import('playwright-core');
  } catch {
    console.log('Bildschirmaufnahme übersprungen: playwright-core fehlt');
    return null;
  }
  const start = Date.now();
  const opts = process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' };
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true, args: ['--hide-scrollbars'], ...opts });
  } catch (e) {
    console.log('Bildschirmaufnahme übersprungen: Chrome startet nicht:', e.message.split('\n')[0]);
    return null;
  }
  const tmp = fs.mkdtempSync(path.join(ziel, '.aufnahme-'));
  let ergebnis = null;
  let abgebrochen = false;
  const notbremse = setTimeout(() => {
    abgebrochen = true;
    browser.close().catch(() => {});
  }, limitMs);
  try {
    const context = await browser.newContext({
      viewport: { width: BREITE, height: HOEHE },
      deviceScaleFactor: 1,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.6' },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    await warte(800);

    // Cookie-Hinweis: ablehnen oder schließen (auch in iframes), danach alles Übrige ausblenden
    let cookie = '-';
    for (const muster of [ABLEHNEN, SCHLIESSEN]) {
      if (cookie !== '-') break;
      for (const frame of page.frames()) {
        const knopf = frame.getByRole('button', { name: muster }).first();
        if (await knopf.isVisible({ timeout: 300 }).catch(() => false)) {
          await knopf.click({ timeout: 1500 }).catch(() => {});
          cookie = muster === ABLEHNEN ? 'abgelehnt' : 'geschlossen';
          break;
        }
      }
    }
    await page.addStyleTag({ content: COOKIE_CSS }).catch(() => {});
    await warte(600);

    // Nur die offizielle Website, keine Login-, Prüf- oder leere Seite
    const pruefe = async () => {
      const host = new URL(page.url()).hostname;
      const sollHost = new URL(url).hostname;
      const info = await page
        .evaluate(() => {
          const sichtbar = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05;
          };
          const pw = [...document.querySelectorAll('input[type="password"]')].some(sichtbar);
          // großes Fenster (Dialog) über der Seite?
          let dialog = '';
          for (const el of document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]')) {
            if (!sichtbar(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width * r.height > 0.22 * innerWidth * innerHeight) dialog += ' ' + (el.innerText || '').slice(0, 400);
          }
          // sichtbare Bausteine im ersten Bildschirm (Chat-Oberflächen haben wenig Text, aber viele Elemente)
          let elemente = 0;
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
            if (sichtbar(el)) elemente++;
            if (elemente > 400) break;
          }
          return { text: document.body?.innerText || '', pw, dialog, elemente };
        })
        .catch(() => ({ text: '', pw: false, dialog: '', elemente: 0 }));
      if (wurzel(host) !== wurzel(sollHost)) return `fremde Domain ${host}`;
      if (LOGIN_PFAD.test(new URL(page.url()).pathname)) return 'Login-Seite';
      if (info.pw) return 'Passwortfeld sichtbar';
      if (info.dialog && LOGIN_WORT.test(info.dialog)) return 'Login-Fenster';
      if (info.dialog) return 'Fenster über der Seite';
      if (SPERRE.test(info.text.slice(0, 3000))) return 'Prüfseite';
      const zeichen = info.text.trim().length;
      if (zeichen < 30 || (zeichen < 150 && info.elemente < 10))
        return `leere Seite (${zeichen} Zeichen, ${info.elemente} Elemente)`;
      return '';
    };
    let grund = await pruefe();
    if (grund && /Fenster/.test(grund)) {
      // ein Hinweisfenster einmal mit Escape schließen, dann erneut prüfen
      await page.keyboard.press('Escape').catch(() => {});
      await warte(600);
      grund = await pruefe();
    }
    if (grund) {
      console.log('Bildschirmaufnahme verworfen:', grund);
      await context.close();
      return null;
    }

    // Standbild der sauberen Seite (Ersatz, falls n8n keinen Screenshot liefert)
    const bild = 'aufnahme-bild.png';
    await page.screenshot({ path: path.join(ziel, bild), type: 'png' }).catch(() => {});
    await page.mouse.move(BREITE * 0.62, HOEHE * 0.58);
    await warte(250);

    // Ab hier wird aufgenommen
    const cdp = await context.newCDPSession(page);
    const bilder = [];
    cdp.on('Page.screencastFrame', (e) => {
      bilder.push({ data: e.data, ts: e.metadata?.timestamp ?? Date.now() / 1000 });
      cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
    });
    const t0 = Date.now() / 1000;
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: BREITE,
      maxHeight: HOEHE,
      everyNthFrame: 1,
    });

    const cursor = [];
    let mx = BREITE * 0.62;
    let my = HOEHE * 0.58;
    const jetzt = () => Date.now() / 1000 - t0;
    const merke = () =>
      cursor.push({ t: +jetzt().toFixed(3), x: +(mx / BREITE).toFixed(4), y: +(my / HOEHE).toFixed(4) });
    merke();
    // Maus wie von Hand: leicht gebogene Bahn, weich beschleunigt, kurzes Zögern am Ziel
    const fahre = async (zx, zy, ms) => {
      const sx = mx;
      const sy = my;
      const schritte = Math.max(10, Math.round(ms / 33));
      const bogen = (Math.random() < 0.5 ? -1 : 1) * Math.min(110, Math.hypot(zx - sx, zy - sy) * 0.16);
      const nx = -(zy - sy);
      const ny = zx - sx;
      const l = Math.hypot(nx, ny) || 1;
      for (let i = 1; i <= schritte; i++) {
        const t = i / schritte;
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        mx = sx + (zx - sx) * e + (nx / l) * bogen * Math.sin(Math.PI * t);
        my = sy + (zy - sy) * e + (ny / l) * bogen * Math.sin(Math.PI * t);
        await page.mouse.move(mx, my);
        merke();
        await warte(ms / schritte);
      }
      await warte(260 + Math.random() * 220);
      merke();
    };
    const scrolle = async (dy, ms) => {
      const schritte = Math.max(8, Math.round(ms / 33));
      for (let i = 0; i < schritte; i++) {
        // weich anfahren und abbremsen wie mit dem Mausrad
        const g = Math.sin((Math.PI * (i + 0.5)) / schritte) * (Math.PI / 2);
        await page.mouse.wheel(0, (dy / schritte) * g);
        await warte(ms / schritte);
      }
      merke();
    };

    await warte(650);
    merke();
    const ziel1 = await findeZiel(page, woerter);
    if (ziel1) await fahre(ziel1.x, ziel1.y, 950);
    else await fahre(BREITE * 0.38, HOEHE * 0.42, 950);
    await warte(650);
    merke();
    await scrolle(340, 1500);
    await warte(800);
    merke();
    const ziel2 = await findeZiel(page, woerter, ziel1?.text);
    if (ziel2) await fahre(ziel2.x, ziel2.y, 850);
    else await fahre(BREITE * 0.56, HOEHE * 0.5, 850);
    await warte(550);
    merke();
    await scrolle(300, 1300);
    await warte(900);
    merke();
    const dauer = +jetzt().toFixed(3);
    await cdp.send('Page.stopScreencast').catch(() => {});
    await warte(150);
    await context.close();
    if (abgebrochen) throw new Error('Zeitlimit');

    if (bilder.length < 4) {
      console.log('Bildschirmaufnahme verworfen: zu wenige Bilder', bilder.length);
      return null;
    }
    // Einzelbilder zu einem gleichmäßigen 30-fps-Video: je Videobild das zuletzt übertragene Bild
    bilder.sort((a, b) => a.ts - b.ts);
    const quellen = bilder.map((b, i) => {
      const datei = path.join(tmp, `q${String(i).padStart(4, '0')}.jpg`);
      fs.writeFileSync(datei, Buffer.from(b.data, 'base64'));
      return { datei, t: i === 0 ? 0 : b.ts - t0 };
    });
    const anzahl = Math.max(2, Math.floor(dauer * 30));
    let qi = 0;
    for (let k = 0; k < anzahl; k++) {
      while (qi + 1 < quellen.length && quellen[qi + 1].t <= k / 30 + 1e-4) qi++;
      fs.linkSync(quellen[qi].datei, path.join(tmp, `v${String(k).padStart(5, '0')}.jpg`));
    }
    const ff = ffmpegPfad();
    execFileSync(
      ff.bin,
      [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-framerate', '30', '-i', path.join(tmp, 'v%05d.jpg'),
        '-vf', `scale=${BREITE}:${HOEHE}:flags=lanczos:in_range=full:out_range=limited,format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '15', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        path.join(ziel, 'aufnahme.mp4'),
      ],
      { stdio: 'inherit', env: { ...process.env, LD_LIBRARY_PATH: [ff.lib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } },
    );
    const dauerVideo = +(anzahl / 30).toFixed(3);
    ergebnis = {
      datei: 'aufnahme.mp4',
      bild: fs.existsSync(path.join(ziel, bild)) ? bild : undefined,
      breite: BREITE,
      hoehe: HOEHE,
      dauer: dauerVideo,
      cursor: cursor.filter((c) => c.t <= dauerVideo + 0.05),
    };
    console.log(
      `Bildschirmaufnahme: ${dauerVideo.toFixed(1)} s, ${bilder.length} Bilder, Cookie ${cookie}, Ziele: ${ziel1?.text || '-'} / ${ziel2?.text || '-'} (${Date.now() - start} ms)`,
    );
  } catch (e) {
    console.log('Bildschirmaufnahme fehlgeschlagen:', String(e.message || e).split('\n')[0]);
    ergebnis = null;
  } finally {
    clearTimeout(notbremse);
    await browser.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return ergebnis;
}

// Sichtbarer Link oder Knopf, dessen Text ein Wort aus Szenen-Titeln oder Schritten enthält
async function findeZiel(page, woerter, ausser) {
  const begriffe = [
    ...new Set(
      woerter
        .flatMap((w) => String(w).split(/[\s,.:;!?„“"()/]+/))
        .filter((w) => w.length >= 4)
        .map((w) => w.toLowerCase()),
    ),
  ];
  return page
    .evaluate(
      ({ begriffe, ausser }) => {
        const kandidaten = [
          ...document.querySelectorAll('a, button, [role="button"], [role="tab"], [role="menuitem"]'),
        ];
        let best = null;
        for (const el of kandidaten) {
          const r = el.getBoundingClientRect();
          if (r.width < 20 || r.height < 12 || r.top < 8 || r.bottom > innerHeight - 40 || r.left < 0 || r.right > innerWidth)
            continue;
          const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
          if (!t || t.length > 40 || t === ausser) continue;
          const tl = t.toLowerCase();
          const treffer = begriffe.filter((b) => tl.includes(b)).length;
          if (treffer && (!best || treffer > best.treffer))
            best = { x: r.left + r.width / 2, y: r.top + r.height / 2, text: t, treffer };
        }
        return best;
      },
      { begriffe, ausser },
    )
    .catch(() => null);
}
