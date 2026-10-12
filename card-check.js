/**
 * Capture dediee a la carte d'eleve : verifie que le rendu reprend le
 * modele d'origine (bandeau bordeaux, photo, code-barres SVG, pied de carte).
 *   npx electron card-check.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, screen } = require('electron');

const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

app.setPath('userData', path.join(__dirname, '.demo-data'));
const { waitForMainWindowReady } = require('./main.js');

async function shot(win, name) {
  await new Promise((r) => setTimeout(r, 700));
  const buffer = (await win.webContents.capturePage()).toPNG();
  fs.writeFileSync(path.join(outDir, name + '.png'), buffer);
  console.log('  -> ' + name + '.png  ' + buffer.length + ' octets');
  if (!buffer.length) throw new Error('capture vide : ' + name);
}

app.whenReady().then(async () => {
  const win = await waitForMainWindowReady(30000);
  const zone = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(Math.min(1440, zone.width - 40), Math.min(900, zone.height - 40));
  win.center();
  win.show();
  win.focus();
  await new Promise((r) => setTimeout(r, 1200));

  // Ouvre la carte du premier eleve ayant une photo, sinon le premier.
  const info = await win.webContents.executeJavaScript(`(async () => {
    const eleves = await window.api.listStudents({ sort: 'matricule', dir: 'asc' });
    const avecPhoto = eleves.find((s) => s.photo) || eleves[0];
    document.querySelector('.nav-item[data-view="etudiants"]').click();
    await new Promise((r) => setTimeout(r, 700));
    const btn = document.querySelector('[data-card="' + avecPhoto.id + '"]');
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 900));
    const carte = document.querySelector('#card-print-area .student-card');
    const svg = document.querySelector('#card-print-area .card-barcode');
    return {
      matricule: avecPhoto.matricule,
      aCarte: !!carte,
      entete: !!document.querySelector('#card-print-area .card-header'),
      infoBox: !!document.querySelector('#card-print-area .card-info-box'),
      pied: !!document.querySelector('#card-print-area .card-footer'),
      codeBarres: !!svg,
      barresDessinees: svg ? svg.querySelectorAll('rect').length : 0,
      largeur: carte ? Math.round(carte.getBoundingClientRect().width) : 0,
      hauteur: carte ? Math.round(carte.getBoundingClientRect().height) : 0,
      texteCarte: carte ? carte.innerText.replace(/\\s+/g, ' ').trim().slice(0, 120) : ''
    };
  })()`);

  console.log('\nCarte de ' + info.matricule);
  console.log('  conteneur .student-card : ' + (info.aCarte ? 'OK' : 'MANQUANT'));
  console.log('  bandeau  .card-header   : ' + (info.entete ? 'OK' : 'MANQUANT'));
  console.log('  encart   .card-info-box : ' + (info.infoBox ? 'OK' : 'MANQUANT'));
  console.log('  pied     .card-footer   : ' + (info.pied ? 'OK' : 'MANQUANT'));
  console.log('  code-barres             : ' + (info.codeBarres ? 'SVG OK' : 'MANQUANT'));
  console.log('  barres dessinees         : ' + info.barresDessinees);
  console.log('  dimensions               : ' + info.largeur + ' x ' + info.hauteur + ' px');
  console.log('  texte                    : ' + info.texteCarte);

  const erreurs = [];
  if (!info.aCarte || !info.entete || !info.infoBox || !info.pied || !info.codeBarres) erreurs.push('structure incomplete');
  if (info.barresDessinees === 0) erreurs.push('code-barres vide');
  // 85.6mm x 54mm a 96 dpi = 324 x 204 px
  if (Math.abs(info.largeur - 324) > 6 || Math.abs(info.hauteur - 204) > 6) {
    erreurs.push('dimensions hors format carte de visite : ' + info.largeur + 'x' + info.hauteur);
  }

  await shot(win, '7b-carte-apercu');

  // Verrouille le cadre et capture la carte seule.
  await win.webContents.executeJavaScript(`
    (() => {
      const carte = document.querySelector('#card-print-area .student-card');
      if (!carte) return;
      carte.style.position = 'fixed';
      carte.style.left = '40px';
      carte.style.top = '40px';
      carte.style.zIndex = '99999';
      carte.style.transform = 'scale(2)';
      carte.style.transformOrigin = 'top left';
      carte.style.boxShadow = '0 10px 40px rgba(0,0,0,.35)';
    })();
  `);
  await shot(win, '7c-carte-zoom');

  if (erreurs.length) {
    console.error('\nPROBLEMES :');
    erreurs.forEach((e) => console.error('  - ' + e));
    app.exit(1);
  } else {
    console.log('\nOK — carte conforme au modele d\'origine.');
    app.exit(0);
  }
});