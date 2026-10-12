/**
 * Verifie le parcours de l'eleve : liste -> fiche (cours) -> mois d'un cours.
 *   npx electron fiche-check.js
 */
const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

app.setPath('userData', path.join(__dirname, '.demo-data'));
const { waitForMainWindowReady } = require('./main.js');

const outDir = path.join(__dirname, 'screenshots');
const problemes = [];

async function shot(win, name) {
  await new Promise((r) => setTimeout(r, 700));
  const buf = (await win.webContents.capturePage()).toPNG();
  fs.writeFileSync(path.join(outDir, name + '.png'), buf);
  console.log('  -> ' + name + '.png  ' + buf.length + ' octets');
  if (!buf.length) problemes.push('capture vide : ' + name);
}

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

app.whenReady().then(async () => {
  try {
    const win = await waitForMainWindowReady(30000);
    const zone = screen.getPrimaryDisplay().workAreaSize;
    win.setSize(Math.min(1440, zone.width - 40), Math.min(900, zone.height - 40));
    win.center();
    win.show();
    win.focus();
    await attendre(1200);

    // --- Etape 1 : ouvrir la fiche d'un eleve depuis la liste ---
    const etape1 = await win.webContents.executeJavaScript(`(async () => {
      document.querySelector('.nav-item[data-view="etudiants"]').click();
      await new Promise((r) => setTimeout(r, 900));
      const lignes = [...document.querySelectorAll('#students-tbody tr')];
      if (!lignes.length) return { erreur: 'aucune ligne' };
      const avecCours = lignes.find((l) => l.querySelector('[data-fiche]')) || lignes[0];
      const bouton = avecCours.querySelector('[data-fiche]');
      const nom = avecCours.children[3].textContent.trim();
      if (bouton) bouton.click();
      else avecCours.children[3].click();
      await new Promise((r) => setTimeout(r, 1000));
      const modale = document.querySelector('#matiere-modal-overlay');
      return {
        nom,
        modaleOuverte: modale.classList.contains('active'),
        titre: (document.querySelector('#matiere-modal-title') || {}).textContent || '',
        cours: document.querySelectorAll('.cours-pick').length,
        enRetard: document.querySelectorAll('.cours-pick.is-impaye').length
      };
    })()`);

    console.log('=== ETAPE 1 : fiche eleve ===');
    console.log('eleve           : ' + etape1.nom);
    console.log('fiche ouverte    : ' + (etape1.modaleOuverte ? 'oui' : 'NON'));
    console.log('titre            : ' + etape1.titre);
    console.log('cours proposes   : ' + etape1.cours + '  (dont ' + etape1.enRetard + ' en retard)');

    if (!etape1.modaleOuverte) problemes.push("la fiche de l'eleve ne s'ouvre pas");
    if (!etape1.cours) problemes.push('aucun cours affiche dans la fiche');

    await shot(win, '9a-fiche-eleve');

    // --- Etape 2 : choisir un cours -> grille des mois ---
    const etape2 = await win.webContents.executeJavaScript(`(async () => {
      const cours = document.querySelector('.cours-pick.is-impaye') || document.querySelector('.cours-pick');
      if (!cours) return { erreur: 'aucun cours cliquable' };
      cours.click();
      await new Promise((r) => setTimeout(r, 1000));
      const overlay = document.querySelector('#grille-eleve-overlay');
      const cellules = [...document.querySelectorAll('.mois-cell')];
      const parStatut = (s) => cellules.filter((c) => c.classList.contains('is-' + s)).length;
      return {
        ouverte: overlay.classList.contains('active'),
        mois: cellules.length,
        payes: parStatut('paye'),
        impayes: parStatut('impaye'),
        avenir: parStatut('avenir'),
        horsPeriode: parStatut('hors-periode'),
        annees: [...document.querySelectorAll('.annee-tab')].map((t) => t.textContent.replace(/\\s+/g, ' ').trim()),
        totaux: (document.querySelector('.grille-totaux') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '',
        cours: (document.querySelector('.grille-matiere') || {}).textContent || '',
        cliquables: cellules.filter((c) => !c.disabled).length
      };
    })()`);

    console.log('');
    console.log('=== ETAPE 2 : grille des mois ===');
    console.log('grille ouverte   : ' + (etape2.ouverte ? 'oui' : 'NON'));
    console.log('cours            : ' + etape2.cours);
    console.log('mois affiches    : ' + etape2.mois);
    console.log('etats            : ' + etape2.payes + ' paye / ' + etape2.impayes + ' impaye / ' +
      etape2.avenir + ' a venir / ' + etape2.horsPeriode + ' avant inscription');
    console.log('onglets annee    : ' + etape2.annees.join(' | '));
    console.log('totaux           : ' + etape2.totaux);

    if (!etape2.ouverte) problemes.push('la grille des mois ne s\'ouvre pas');
    if (etape2.mois !== 12) problemes.push('la grille doit afficher 12 mois, obtenu ' + etape2.mois);

    await shot(win, '9b-grille-mois');

    // --- Etape 3 : naviguer vers une autre annee ---
    const etape3 = await win.webContents.executeJavaScript(`(async () => {
      const onglets = [...document.querySelectorAll('.annee-tab')];
      if (onglets.length < 2) return { erreur: 'un seul onglet' };
      onglets[0].click();
      await new Promise((r) => setTimeout(r, 900));
      const actif = document.querySelector('.annee-tab.is-active');
      const total = (document.querySelector('.grille-totaux') || {}).textContent?.replace(/\\s+/g, ' ').trim() || '';
      return { annee: (actif || {}).textContent?.replace(/\\s+/g, ' ').trim() || '', total };
    })()`);

    console.log('');
    console.log('=== ETAPE 3 : navigation entre annees ===');
    console.log('annee affichee   : ' + etape3.annee);
    console.log('totaux           : ' + etape3.total);
    await shot(win, '9c-grille-annee-passee');

    // --- Retour aux cours ---
    const retour = await win.webContents.executeJavaScript(`(async () => {
      const b = document.querySelector('#btn-retour-cours');
      if (!b) return { ok: false };
      b.click();
      await new Promise((r) => setTimeout(r, 900));
      return {
        ok: true,
        cours: document.querySelectorAll('.cours-pick').length,
        ficheOuverte: document.querySelector('#matiere-modal-overlay').classList.contains('active')
      };
    })()`);
    console.log('');
    console.log('=== RETOUR AUX COURS ===');
    console.log('revenir possible : ' + (retour.ok ? 'oui' : 'NON'));
    console.log('cours affiches   : ' + retour.cours);
    if (!retour.ok) problemes.push('impossible de revenir a la liste des cours');
    if (!retour.cours) problemes.push('la liste des cours est vide apres retour');
  } catch (e) {
    problemes.push('exception : ' + e.message);
  }

  console.log('');
  if (problemes.length) {
    console.error('PROBLEMES :');
    problemes.forEach((p) => console.error('  - ' + p));
    app.exit(1);
  } else {
    console.log('OK — parcours eleve > cours > mois operationnel.');
    app.exit(0);
  }
});