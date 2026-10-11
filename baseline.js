/**
 * Etat de reference : lance l'application et decrit ce qui existe reellement.
 *   npx electron baseline.js
 */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

app.setPath('userData', path.join(__dirname, '.baseline'));

// Charge le processus principal de l'application : c'est lui qui cree la fenetre.
require('./main.js');

function waitForWindow(timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w && !w.isDestroyed() && !w.webContents.isLoading()) return resolve(w);
      if (Date.now() - start > (timeoutMs || 20000)) return reject(new Error('fenetre absente'));
      return setTimeout(tick, 150);
    };
    tick();
  });
}

app.whenReady().then(async () => {
  try {
    const win = await waitForWindow(20000);
    const erreurs = [];
    win.webContents.on('console-message', (e, level) => {
      try {
        if (level >= 2) erreurs.push(e.message);
      } catch (_) {
        /* ignore */
      }
    });

    await new Promise((r) => setTimeout(r, 2500));

    const out = await win.webContents.executeJavaScript(`(() => {
      const q = (s) => document.querySelectorAll(s).length;
      const vues = [...document.querySelectorAll('.view')].map((v) => v.id.replace('view-', ''));
      const nav = [...document.querySelectorAll('.nav-item')].map((n) => n.dataset.view);
      return {
        vues,
        nav,
        tableaux: q('table'),
        entetesTriables: q('th.sortable'),
        lignesEleves: q('#students-tbody tr'),
        iconesVides: q('[data-icon]:empty'),
        canvas: q('canvas'),
        aSelectFiltres: q('#view-etudiants select'),
        aChampRecherche: q('#search-input, #cards-search-input').length,
        aChampDate: q('input[placeholder="jj/mm/aaaa"]').length,
        boutonsExcel: [...document.querySelectorAll('button')].filter((b) => /excel|mod/i.test(b.textContent)).length,
        boutonPhotos: [...document.querySelectorAll('button')].filter((b) => /photo/i.test(b.textContent)).length,
        colonneDevise: /\\$|USD|dollar/i.test(document.body.innerHTML),
        boiteReinit: !!document.querySelector('#btn-reset-students-filters, #btn-reset')
      };
    })()`);

    console.log('=== ETAT DE REFERENCE (23 sept) ===');
    console.log('pages        : ' + out.vues.join(', '));
    console.log('navigation   : ' + out.nav.join(', '));
    console.log('tableaux     : ' + out.tableaux);
    console.log('entetes triables : ' + out.entetesTriables);
    console.log('canvas graphiques  : ' + out.canvas);
    console.log('filtres (select)   : ' + out.aSelectFiltres);
    console.log('champs date        : ' + out.aChampDate);
    console.log('boutons Excel      : ' + out.boutonsExcel);
    console.log('bouton Photos      : ' + out.boutonPhotos);
    console.log('mention dollar     : ' + (out.colonneDevise ? 'OUI (a corriger)' : 'non'));
    console.log('bouton reinitialiser : ' + (out.boiteReinit ? 'present' : 'absent'));
    console.log('icones non remplies  : ' + out.iconesVides);
    console.log('erreurs console      : ' + (erreurs.length ? erreurs.slice(0, 5).join(' // ') : 'aucune'));

    fs.writeFileSync(path.join(__dirname, 'screenshots', 'baseline.json'), JSON.stringify(out, null, 2));
    app.exit(0);
  } catch (e) {
    console.error('ECHEC : ' + e.message);
    app.exit(1);
  }
});