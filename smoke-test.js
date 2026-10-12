/**
 * Test de démarrage sans interface graphique.
 *
 * Lance l'application, attend que le renderer soit prêt, exécute une série de
 * vérifications dans la page (éléments du DOM présents, API exposée complète,
 * tables remplies) puis quitte avec un code de sortie 0 / 1.
 *
 *   npx electron smoke-test.js
 */
const path = require('path');
const { app, BrowserWindow } = require('electron');

// Lancé via `electron smoke-test.js`, Electron ne lit PAS le package.json du
// projet : sans ce réglage il nomme l'application "Electron" et ouvrirait une
// autre base (%APPDATA%/Electron) au lieu de la vraie.
app.setPath('userData', path.join(app.getPath('appData'), require('./package.json').name));

require('./main.js');
const { waitForMainWindowReady } = require('./main.js');

// Fonction exécutée DANS le renderer (le contexte doit être autonome).
function rendererCheck() {
  const problems = [];
  const ok = {};

  const required = [
    '#view-accueil',
    '#view-inscription',
    '#view-etudiants',
    '#view-cartes',
    '#view-matieres',
    '#view-enseignants',
    '#view-paiements',
    '#student-form',
    '#students-tbody',
    '#matieres-list',
    '#teachers-list',
    '#cours-body',
    '#pay-grid',
    '#students-head',
    '[data-sort="nom"]',
    '#cards-head [data-cards-sort="nom"]',
    '#cours-head [data-cours-sort="matiere_nom"]',
    '#grille-eleve-overlay',
    '#year-banner',
    '#search-input',
    '#filter-matiere-etudiants',
    '#filter-teacher-etudiants',
    '#statut-matiere',
    '#statut-mois',
    '#statut-annee',
    '#statut-etat',
    '#grille-eleve-overlay',
    '#year-banner',
    '#btn-reset-students-filters',
    // Tableau de bord
    '#chart-revenue',
    '#chart-revenue-matiere',
    '#chart-repartition',
    '#dash-repartition',
    '#dash-annee',
    '#dash-teacher',
    '#dash-total-annee',
    '#stat-goto-matieres',
    // Fiches
    '#teacher-form-title',
    '#matiere-form-title',
    // Excel
    '#btn-excel-template',
    '#btn-excel-import',
    '#btn-excel-export',
    '#import-modal-overlay',
    // Sélecteurs de cours
    '#pay-teacher',
    '#pay-matiere',
    '#assign-matiere',
    '#assign-teacher',
    '#assign-prix'
  ];
  required.forEach((sel) => {
    if (!document.querySelector(sel)) problems.push(`élément manquant : ${sel}`);
  });

  const apiKeys = [
    'listStudents', 'listClasses', 'studentMatieresMap', 'addStudent', 'updateStudent', 'deleteStudent',
    'importPhotos', 'listStudentsForTeacher',
    'excelTemplate', 'excelExport', 'excelImportPreview', 'excelImportConfirm',
    'listMatieres', 'addMatiere', 'updateMatiere', 'deleteMatiere',
    'listTeachers', 'addTeacher', 'updateTeacher', 'deleteTeacher', 'teacherDetail',
    'listCours', 'listCoursForTeacher', 'listCoursForMatiere', 'coursInfo', 'updateCours',
    'addMatiereTeacher', 'removeMatiereTeacher',
    'getStudentMatieres', 'setStudentMatieres', 'listStudentsForMatiere',
    'paymentsGrid', 'togglePayment', 'markAllPayments', 'paymentsStats', 'unpaidStudents', 'paymentsReport',
    'statsRevenue', 'statsRevenueParMatiere', 'statsGlobales'
  ];
  const missingApi = apiKeys.filter((k) => typeof window.api[k] !== 'function');
  if (missingApi.length) problems.push(`API manquante : ${missingApi.join(', ')}`);

  ok.barcodeLib = typeof window.JsBarcode === 'function';
  if (!ok.barcodeLib) problems.push('JsBarcode non chargé');

  ok.chartLib = typeof window.Chart === 'function';
  if (!ok.chartLib) problems.push('Chart.js non chargé');

  // Le renderer s'est-il exécuté jusqu'au bout de init() ?
  ok.statTotal = document.querySelector('#stat-total').textContent;
  ok.resultats = document.querySelector('#students-results-count').textContent;
  ok.lignesEtudiants = document.querySelectorAll('#students-tbody tr').length;
  ok.optionsMatieres = document.querySelectorAll('#filter-matiere-etudiants option').length;
  ok.optionsAnnees = document.querySelectorAll('#pay-annee option').length;
  ok.optionsMois = document.querySelectorAll('#pay-mois-courant option').length;

  if (ok.lignesEtudiants === 0 && ok.statTotal !== '0') {
    problems.push('des étudiants existent mais la table est vide');
  }

  return { problems, ok };
}

app.whenReady().then(async () => {
  try {
    // Laisse le temps au renderer de terminer init() et aux IPC de répondre.
        const win = await waitForMainWindowReady(30000);
    if (!win) {
      console.error('ÉCHEC : aucune fenêtre créée.');
      app.exit(1);
      return;
    }
    const result = await win.webContents.executeJavaScript(`(${rendererCheck.toString()})()`);
    console.log('État :', JSON.stringify(result.ok));
    if (result.problems.length) {
      console.error('PROBLÈMES :');
      result.problems.forEach((p) => console.error('  - ' + p));
      app.exit(1);
    } else {
      console.log('OK — toutes les vérifications sont passées.');
      app.exit(0);
    }
  } catch (err) {
    console.error('ÉCHEC :', err.message);
    app.exit(1);
  }
});

