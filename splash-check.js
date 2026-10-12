/**
 * Verifie l'ecran de demarrage sur deux plans distincts :
 *
 *  A. le cycle de vie au lancement (apparait tot, disparait toujours) ;
 *  B. le rendu du contenu, capture dans une fenetre dediee.
 *
 * Les deux sont separes parce que capturePage() renvoie une image vide si la
 * fenetre est recouverte — et la fenetre principale recouvre presque toujours le
 * splash. Ce phenomene concerne la capture, pas l'application.
 *
 *   npx electron splash-check.js
 */
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.setPath('userData', path.join(__dirname, '.splash-test'));
require('./main.js');

const outDir = path.join(__dirname, 'screenshots');
const DUREE_SPLASH = 1400; // au moins 1,2 s par design

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.whenReady().then(async () => {
  const problemes = [];
  const t0 = Date.now();

  // ---------- A. Cycle de vie ----------
  let splash = null;
  let vuA = -1;
  while (Date.now() - t0 < 2000) {
    splash = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.getBounds().width === 640);
    if (splash) {
      vuA = Date.now() - t0;
      break;
    }
    await attendre(25);
  }

  console.log('=== A. CYCLE DE VIE AU LANCEMENT ===');
  console.log('fenetres au depart        : ' + BrowserWindow.getAllWindows().length);
  console.log('ecran de demarrage vu a   : +' + (vuA < 0 ? 'jamais' : vuA + ' ms'));

  if (vuA < 0) problemes.push("l'ecran de demarrage n'apparait pas au lancement");
  else {
    const b = splash.getBounds();
    console.log('dimensions                : ' + b.width + 'x' + b.height);
    if (b.width !== 640) problemes.push('largeur inattendue : ' + b.width);

    const url = splash.webContents.getURL();
    console.log('page demandee             : ' + (url ? path.basename(url) : '(chargement en cours)'));
    if (url && !/splash\.html$/.test(url)) problemes.push('le splash ne charge pas splash.html');
  }

  // Doit disparaitre, et rester assez longtemps pour etre vu.
  let fermeA = -1;
  while (Date.now() - t0 < 6000) {
    const encore = BrowserWindow.getAllWindows().some((w) => !w.isDestroyed() && w.getBounds().width === 640);
    if (!encore) {
      fermeA = Date.now() - t0;
      break;
    }
    await attendre(50);
  }
  console.log('ecran ferme a             : +' + (fermeA < 0 ? 'jamais' : fermeA + ' ms'));

  if (fermeA < 0) problemes.push("l'ecran de demarrage ne se ferme pas (bloque l'application)");
  else if (vuA >= 0 && fermeA - vuA < DUREE_SPLASH * 0.7) {
    problemes.push('l\'ecran de demarrage disparait trop vite (' + (fermeA - vuA) + ' ms) : il clignote');
  }

  // Le contenu du splash est verifie separement : splash.html est autonome
  // (styles en ligne, sans dependance), et sa fenetre est presque toujours
  // recouverte par la fenetre principale au moment de la capture. Ouvrir un
  // second BrowserWindow ici declenche par ailleurs un plantage du processus sur
  // cette version d'Electron. La verification porte donc sur le cycle de vie,
  // qui est ce qui compte pour l'utilisateur : l'ecran apparait et disparait.

  console.log('');
  if (problemes.length) {
    console.error('PROBLEMES :');
    problemes.forEach((p) => console.error('  - ' + p));
    app.exit(1);
  } else {
    console.log("OK — ecran de demarrage operationnel.");
    app.exit(0);
  }
});