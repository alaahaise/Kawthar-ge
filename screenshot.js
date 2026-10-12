/**
 * Capture d'écran de chaque vue, avec des données de démonstration.
 * Sert à vérifier visuellement le rendu sans ouvrir l'application.
 *
 *   npx electron screenshot.js
 * Les images sont écrites dans le dossier /screenshots du projet.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const tmpUserData = path.join(os.tmpdir(), 'gestion-etudiants-shots-' + Date.now());
const useDemoData = process.argv.includes('--demo');
if (useDemoData) {
  // Capture de la base de démonstration déjà remplie (npm run demo)
  app.setPath('userData', path.join(__dirname, '.demo-data'));
} else {
  app.setPath('userData', tmpUserData);
}

require('./main.js');
const { waitForMainWindowReady } = require('./main.js');

const outDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

async function seed() {
  const api = window.api;
  const mk = (nom, prix, desc) => api.addMatiere({ nom, prix_mensuel: prix, description: desc });
  const m1 = await mk('Mathématiques', 2500, 'Algèbre, fonctions, dérivées');
  const m2 = await mk('Physique', 2000, 'Mécanique et électricité');
  const m3 = await mk('Français', 1500, 'Grammaire et conjugaison');
  const m4 = await mk('Anglais', 1500, 'Communication orale');

  const t1 = await api.addTeacher({ prenom: 'Karim', nom: 'Benali', telephone: '0555123456', specialite: 'Mathématiques' });
  const t2 = await api.addTeacher({ prenom: 'Samir', nom: 'Ait Ahmed', telephone: '0661778899', specialite: 'Physique' });
  const t3 = await api.addTeacher({ prenom: 'Leila', nom: 'Haddad', specialite: 'Français' });

  await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t1.id });
  await api.addMatiereTeacher({ matiere_id: m2.id, teacher_id: t2.id });
  await api.addMatiereTeacher({ matiere_id: m3.id, teacher_id: t3.id });
  await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t3.id });

  const eleves = [
    ['Bouzid', 'Amine', '12/05/2008', '1ère Année', '15/09/2025', '0666112233'],
    ['Cherif', 'Yanis', '01/01/2009', '2ème Année', '05/10/2025', '0552114477'],
    ['Ali', 'Nora', '20/11/2008', '1ère Année', '20/12/2024', '0779556633'],
    ['Meziane', 'Yacine', '03/02/2009', '3ème Année', '12/01/2025', '0699887766'],
    ['Kaci', 'Amel', '17/06/2008', '2ème Année', '28/09/2025', '0544332211'],
    ['Larbi', 'Sofiane', '09/09/2007', '3ème Année', '18/09/2025', ''],
    ['Benaissa', 'Meriem', '25/04/2009', '1ère Année', '03/02/2026', '0661234567']
  ];

  const ids = [];
  for (const [nom, prenom, naissance, classe, insc, tel] of eleves) {
    const s = await api.addStudent({
      nom, prenom, date_naissance: naissance, date_inscription: insc, classe,
      telephone_parent: tel, adresse: 'Sid Cheikh, Saida'
    });
    ids.push(s.id);
  }

  const matieresParEleve = [[m1, m2], [m1, m3], [m2, m3], [m1, m3, m4], [m1, m2, m4], [m2], [m1, m4]];
  const teacherOf = { [m1.id]: t1.id, [m2.id]: t2.id, [m3.id]: t3.id, [m4.id]: null };
  for (let i = 0; i < ids.length; i += 1) {
    await api.setStudentMatieres({
      student_id: ids[i],
      selections: matieresParEleve[i].map((m) => ({ matiere_id: m.id, teacher_id: teacherOf[m.id] })),
      date_inscription: eleves[i][4]
    });
  }

  // Quelques paiements pour que la grille ne soit pas vide.
  await api.togglePayment({ student_id: ids[0], matiere_id: m1.id, annee: 2026, mois: 1, paye: true });
  await api.togglePayment({ student_id: ids[0], matiere_id: m1.id, annee: 2026, mois: 2, paye: true });
  await api.togglePayment({ student_id: ids[0], matiere_id: m1.id, annee: 2026, mois: 3, paye: true, montant: 3000 });
  await api.togglePayment({ student_id: ids[1], matiere_id: m1.id, annee: 2026, mois: 1, paye: true });
  await api.togglePayment({ student_id: ids[1], matiere_id: m1.id, annee: 2026, mois: 2, paye: true });
  await api.togglePayment({ student_id: ids[3], matiere_id: m1.id, annee: 2026, mois: 1, paye: true });
  await api.togglePayment({ student_id: ids[6], matiere_id: m1.id, annee: 2026, mois: 1, paye: true });
  await api.togglePayment({ student_id: ids[6], matiere_id: m1.id, annee: 2026, mois: 4, paye: true, montant: 1800 });

  return { m1: m1.id, m2: m2.id };
}

/**
 * Redimensionne la fenêtre DANS l'écran.
 *
 * capturePage() renvoie une image vide si la fenêtre dépasse la zone de
 * travail : sur ce poste le bureau fait 816 px de haut, et une fenêtre de 900 px
 * pendait donc sous l'écran — toutes les captures sortaient vides.
 */
function fitWindow(win) {
  const { screen } = require('electron');
  const zone = screen.getPrimaryDisplay().workAreaSize;
  const largeur = Math.min(1440, zone.width - 40);
  const hauteur = Math.min(900, zone.height - 40);
  win.setSize(largeur, hauteur);
  win.center();
  win.show();
  win.focus();
}

async function shot(win, name) {
  await new Promise((r) => setTimeout(r, 700));
  const img = await win.webContents.capturePage();
  const buffer = img.toPNG();
  const file = path.join(outDir, name + '.png');
  fs.writeFileSync(file, buffer);
  console.log('  -> ' + file + (buffer.length === 0 ? '   *** VIDE ***' : ''));
  if (buffer.length === 0) throw new Error('Capture vide pour ' + name + ' — la fenêtre est-elle visible à l\'écran ?');
}

app.whenReady().then(async () => {
  try {
        const win = await waitForMainWindowReady(30000);
    fitWindow(win);
    await new Promise((r) => setTimeout(r, 800));

    let ids;
    if (useDemoData) {
      // La base est déjà remplie : on récupère un enseignant et un cours.
      ids = await win.webContents.executeJavaScript(
        `(async () => {
           const t = await window.api.listTeachers();
           const c = await window.api.listCours();
           return {
             teacher: t[0].id,
             matiere: c.find(x => x.teacher_id === t[0].id).matiere_id,
             m1: c.find(x => x.matiere_nom === 'Mathématiques').matiere_id,
             m2: c.find(x => x.matiere_nom === 'Physique').matiere_id
           };
         })()`
      );
    } else {
      ids = await win.webContents.executeJavaScript(`(${seed.toString()})()`);
      // Recharge pour repartir d'un état propre avec les données en base.
      win.webContents.reload();
      await new Promise((r) => setTimeout(r, 3000));
      fitWindow(win);
      await new Promise((r) => setTimeout(r, 900));
    }

    const go = (view) => `document.querySelector('.nav-item[data-view="${view}"]').click()`;

    await win.webContents.executeJavaScript(go('accueil'));
    await win.webContents.executeJavaScript(`document.querySelector('#view-accueil .content-pad').scrollTop = 0;`);
    await shot(win, '1-accueil');

    await win.webContents.executeJavaScript(go('etudiants'));
    await win.webContents.executeJavaScript(`document.querySelector('#view-etudiants .content-pad').scrollTop = 0;`);
    await shot(win, '2-etudiants');

    await win.webContents.executeJavaScript(`
      document.querySelector('th[data-sort="matricule"]').click();
    `);
    await shot(win, '2b-etudiants-tri');

    // Colonne Statut : choisir une matière + un mois, puis ouvrir la grille d'un élève.
    await win.webContents.executeJavaScript(`
      const m = document.querySelector('#statut-matiere');
      m.selectedIndex = 1;
      m.dispatchEvent(new Event('change'));
      const mo = document.querySelector('#statut-mois');
      mo.value = '6';
      mo.dispatchEvent(new Event('change'));
    `);
    await shot(win, '2c-etudiants-statut');

    await win.webContents.executeJavaScript(
      "const p = document.querySelector('.statut-pill.is-impaye') || document.querySelector('.statut-pill'); if (p) p.click();"
    );
    await shot(win, '2d-grille-eleve');

    await win.webContents.executeJavaScript(
      "document.querySelector('#btn-close-grille-eleve').click();"
    );

    await win.webContents.executeJavaScript(`
      document.querySelector('#btn-toggle-students-filters').click();
      document.querySelector('#filter-matiere-etudiants').value = '${ids.m1}';
      document.querySelector('#filter-matiere-etudiants').dispatchEvent(new Event('change'));
    `);
    await shot(win, '3-etudiants-filtres');

    // La grille exige une matiere ET un enseignant : la matiere d'abord
// (elle qui repeuple la liste des enseignants), puis le professeur.
await win.webContents.executeJavaScript(`
  (() => {
    const m = document.querySelector('#pay-matiere');
    m.value = '${ids.m2}';
    m.dispatchEvent(new Event('change'));
    const t = document.querySelector('#pay-teacher');
    t.selectedIndex = 1;
    t.dispatchEvent(new Event('change'));
  })();
`);
    await new Promise((r) => setTimeout(r, 900));
    await win.webContents.executeJavaScript(go('paiements'));
    await shot(win, '4-paiements');

    await win.webContents.executeJavaScript(go('matieres'));
    await shot(win, '5-matieres');

    await win.webContents.executeJavaScript(`
      document.querySelector('#view-matieres .content-pad').scrollTop = 99999;
    `);
    await shot(win, '5b-matieres-matrice');

    await win.webContents.executeJavaScript(`
      const box = document.querySelector('#students-filters-body');
      if (box) box.classList.remove('collapsed');
      document.querySelector('#pay-matiere').value='';
    `);
    await win.webContents.executeJavaScript(go('inscription'));
    await shot(win, '6-inscription');

    await win.webContents.executeJavaScript(go('cartes'));
    await shot(win, '7-cartes');

    await win.webContents.executeJavaScript(go('enseignants'));
    await shot(win, '8-enseignants');

    await win.webContents.executeJavaScript(`
      document.querySelector('#view-enseignants .content-pad').scrollTop = 99999;
    `);
    await shot(win, '8b-enseignants-bas');

    console.log('Captures terminées.');
    app.exit(0);
  } catch (err) {
    console.error('ÉCHEC :', err.stack || err.message);
    app.exit(1);
  }
});

app.on('will-quit', () => {
  if (useDemoData) return; // ne jamais supprimer la base de démo
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch (err) {
    /* sans conséquence */
  }
});

