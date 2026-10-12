/**
 * Test du modèle « cours » : une matière enseignée par plusieurs enseignants,
 * avec un tarif et des paiements distincts par professeur, sur plusieurs années.
 *
 *   npx electron cours-test.js
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

// Base jetable : ce test suppose un jeu de données vierge et ne doit jamais
// toucher la vraie base.
const tmpUserData = path.join(os.tmpdir(), 'gestion-cours-test-' + Date.now());
app.setPath('userData', tmpUserData);

require('./main.js');
const { waitForMainWindowReady } = require('./main.js');

async function run() {
  const api = window.api;
  const p = [];
  const ck = (l, c, d) => {
    if (!c) p.push(l + (d !== undefined ? ' -> ' + JSON.stringify(d) : ''));
  };

  try {
    const m1 = await api.addMatiere({ nom: 'Mathématiques', prix_mensuel: 2500, description: 'Algèbre' });
    const m2 = await api.addMatiere({ nom: 'Physique', prix_mensuel: 2000, description: 'Mécanique' });
    ck('création matière 1', m1.success, m1);
    ck('création matière 2', m2.success, m2);
    ck('matière en double refusée', (await api.addMatiere({ nom: 'Mathématiques' })).success === false);
    const upMat = await api.updateMatiere({ id: m1.id, nom: 'Mathématiques', prix_mensuel: 2500, description: 'Alg+Ana' });
    ck('modification matière', upMat.success, upMat);

    const t1 = await api.addTeacher({ prenom: 'Karim', nom: 'Benali', telephone: '0555123456', specialite: 'Maths' });
    const t2 = await api.addTeacher({ prenom: 'Samir', nom: 'Ait Ahmed' });
    const t3 = await api.addTeacher({ prenom: 'Leila', nom: 'Haddad' });
    ck('code ENS0001', t1.code === 'ENS0001', t1.code);
    ck('code ENS0002', t2.code === 'ENS0002', t2.code);
    const tch = await api.listTeachers();
    ck('nom complet', tch.find((t) => t.id === t1.id).full_name === 'Karim Benali', tch.find((t) => t.id === t1.id));
    ck('modification enseignant', (await api.updateTeacher({ id: t1.id, prenom: 'Karim', nom: 'Benali' })).success);

    // Deux profs pour les Maths, avec des TARIFS DIFFÉRENTS.
    ck('cours A', (await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t1.id, prix_mensuel: 2500 })).success);
    ck('cours B (2e prof même matière)', (await api.addMatiereTeacher({ matiere_id: m1.id, teacher_id: t3.id, prix_mensuel: 3200 })).success);
    ck('cours C', (await api.addMatiereTeacher({ matiere_id: m2.id, teacher_id: t2.id, prix_mensuel: 2000 })).success);

    const cours = await api.listCours();
    ck('3 cours', cours.length === 3, cours.length);
    ck('tarif propre au prof B', cours.find((c) => c.teacher_id === t3.id).prix_mensuel === 3200, cours.find((c) => c.teacher_id === t3.id));

    const s1 = await api.addStudent({ nom: 'Bouzid', prenom: 'Amine', date_naissance: '12/05/2008', date_inscription: '15/09/2025', classe: '1ère Année' });
    const s2 = await api.addStudent({ nom: 'Cherif', prenom: 'Yanis', date_naissance: '01/01/2009', date_inscription: '05/10/2025', classe: '2ème Année' });
    ck('matricule 20250001', s1.matricule === '20250001', s1.matricule);

    // Le MÊME élève suit les Maths chez DEUX profs, plus la Physique.
    await api.setStudentMatieres({
      student_id: s1.id,
      selections: [
        { matiere_id: m1.id, teacher_ids: [t1.id, t3.id] },
        { matiere_id: m2.id, teacher_ids: [t2.id] }
      ],
      date_inscription: '15/09/2025'
    });
    await api.setStudentMatieres({ student_id: s2.id, selections: [{ matiere_id: m1.id, teacher_ids: [t1.id] }], date_inscription: '05/10/2025' });

    const enr = await api.getStudentMatieres(s1.id);
    ck('3 inscriptions (2 profs sur la même matière)', enr.length === 3, enr.length);

    const gA = await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2026 });
    const gB = await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t3.id, annee: 2026 });
    // s1 suit les maths chez A et B ; s2 seulement chez A.
    ck('grille prof A : 2 élèves', gA.students.length === 2, gA.students.length);
    ck('grille prof B : 1 élève (le même)', gB.students.length === 1, gB.students.length);
    ck('grille B garde son tarif', gB.cours.prix_mensuel === 3200, gB.cours.prix_mensuel);

    const map = await api.studentMatieresMap();
    const pucesMaths = (map[s1.id] || []).filter((x) => x.indexOf('Math') === 0);
    ck('deux puces Maths distinctes (un par prof)', pucesMaths.length === 2, pucesMaths);

    // Paiements SÉPARÉS par professeur.
    await api.togglePayment({ student_id: s1.id, matiere_id: m1.id, teacher_id: t1.id, annee: 2026, mois: 3, paye: true });
    const gA2 = await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2026 });
    const gB2 = await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t3.id, annee: 2026 });
    ck('montant A = tarif A', gA2.students[0].payments[3].montant === 2500, gA2.students[0].payments[3]);
    ck('le paiement de A ne touche pas B', !gB2.students[0].payments[3], gB2.students[0].payments[3]);

    // Seul s1 a payé le mois 3 chez A ; s2 et l'inscription de s1 chez B restent dûs.
    ck('impayés A = 1 (s2)', (await api.unpaidStudents({ matiere_id: m1.id, teacher_id: t1.id, annee: 2026, mois: 3 })).length === 1);
    ck('impayés B = 1 (s1)', (await api.unpaidStudents({ matiere_id: m1.id, teacher_id: t3.id, annee: 2026, mois: 3 })).length === 1);

    // Tableau de bord par professeur.
    ck('revenus A', (await api.statsRevenue({ annee: 2026, teacher_id: t1.id })).total === 2500);
    ck('revenus B', (await api.statsRevenue({ annee: 2026, teacher_id: t3.id })).total === 0);
    ck('revenus globaux = A', (await api.statsRevenue({ annee: 2026 })).total === 2500);
    ck('attendu mensuel A (2 élèves x 2500)', (await api.statsGlobales({ teacher_id: t1.id })).attendu_mensuel === 5000);
    ck('attendu mensuel B (1 élève x 3200)', (await api.statsGlobales({ teacher_id: t3.id })).attendu_mensuel === 3200);

    const detail = await api.teacherDetail(t3.id);
    ck('fiche prof : 1 cours', detail.cours.length === 1, detail.cours.length);

    // Années indépendantes.
    const g27 = await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2027 });
    ck('2027 vide au départ', Object.keys(g27.students[0].payments).length === 0, g27.students[0].payments);
    await api.togglePayment({ student_id: s1.id, matiere_id: m1.id, teacher_id: t1.id, annee: 2027, mois: 1, paye: true });
    ck(
      '2027 enregistré',
      (await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2027 })).students[0].payments[1].paye === 1
    );
    ck(
      '2026 intact',
      Object.keys((await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2026 })).students[0].payments).length === 1
    );

    // Filtres par professeur.
    ck('filtre prof A', (await api.listStudents({ teacher_id: t1.id })).length === 2);
    ck('filtre prof B', (await api.listStudents({ teacher_id: t3.id })).length === 1);

    // Retrait d'un cours protégé.
    const rm = await api.removeMatiereTeacher({ matiere_id: m1.id, teacher_id: t3.id });
    ck('retrait protégé', rm.needsConfirm === true && rm.eleves === 1 && rm.paiements === 0, rm);
    ck('cours toujours là', (await api.listCours()).length === 3, (await api.listCours()).length);
    const rm2 = await api.removeMatiereTeacher({ matiere_id: m1.id, teacher_id: t3.id, force: true });
    ck('retrait forcé', rm2.success && rm2.eleves_retires === 1, rm2);
    ck('cours supprimé', (await api.listCours()).length === 2, (await api.listCours()).length);
    ck(
      'les paiements de A sont conservés',
      (await api.paymentsGrid({ matiere_id: m1.id, teacher_id: t1.id, annee: 2026 })).students[0].payments[3].paye === 1
    );
  } catch (e) {
    p.push('EXCEPTION : ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]);
  }
  return p;
}

app.whenReady().then(async () => {
    const win = await waitForMainWindowReady(30000);
  const res = await win.webContents.executeJavaScript(`(${run.toString()})()`);
  if (res.length) {
    console.error(`${res.length} ÉCHEC(S) :`);
    res.forEach((x) => console.error('  - ' + x));
    app.exit(1);
  } else {
    console.log('OK — modèle par cours validé.');
    app.exit(0);
  }
});

app.on('will-quit', () => {
  try {
    fs.rmSync(tmpUserData, { recursive: true, force: true });
  } catch (err) {
    /* sans conséquence */
  }
});

